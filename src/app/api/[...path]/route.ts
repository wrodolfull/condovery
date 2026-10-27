import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { query, transaction } from '@/lib/db';
import { clearSession, inviteHash, issueSession, sessionViewer, tokenHash, type Viewer } from '@/lib/auth';
import { normalizeWhatsApp, orderMessage, unitPrice, optionGroupsSchema, selectedOptions, extrasTotal, validArrivalInstructions, type OptionGroup, type Selection } from '@/lib/orders';
import { passwordAuthClient,emailConfigured,recoveryConfigured,googleAuthClient,googleConfigured,storageAdmin,storageConfigured,STORAGE_BUCKET } from '@/lib/supabase';
import { oauthCookie,randomToken,safeAppOrigin } from '@/lib/security';
import { violatesCommunityLanguage } from '@/lib/content-policy';
import {processAccountDeletionJob} from '@/lib/account-deletion';
import {processShopDeletionJob} from '@/lib/shop-deletion';
import {slugifyShopName} from '@/lib/shop-slug';
import {randomBytes} from 'node:crypto';
import {towerLabels,currentTowerScheme} from '@/lib/towers';
import {IMAGE_MIME_TYPES, imageSizeIsAllowed} from '@/lib/image-limits';
import {tenantForRequest,isTenantHostname,tenantLabel} from '@/lib/tenant-host';
import {normalizeCondominiumSlug,normalizeTenantDomain} from '@/lib/tenancy';
import {logApiRequestMetric} from '@/lib/api-observability';

export const runtime='nodejs';
export const dynamic='force-dynamic';
type Verb='GET'|'POST'|'PATCH'|'DELETE';
type Args={req:NextRequest;method:Verb;parts:string[]};
class ApiError extends Error { constructor(public status:number, message:string){super(message);} }
const bad=(text:string,status=400):never=>{throw new ApiError(status,text);};
const out=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
const clean=(value:unknown,max=500)=>String(value??'').trim().slice(0,max);
const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
async function body(req:NextRequest) {return await req.json().catch(()=>bad('JSON inválido.'));}
async function viewer(req:NextRequest) {const u=await sessionViewer(req);if(!u)bad('Faça login para continuar.',401);return u!;}
function approved(u:Viewer){if(u.status!=='approved')bad('Sua conta está suspensa.',403);}
function admin(u:Viewer){approved(u);if(u.role!=='admin')bad('Acesso restrito à administração.',403);}
async function shopOwned(u:Viewer,requireApproved=false){
  const r=await query("SELECT * FROM shops WHERE condominium_id=$1 AND owner_id=$2 AND status<>'deleted'",[u.condominium_id,u.id]);
  const shop=r.rows[0];
  if(!shop) bad('Cadastre sua loja primeiro.',404);
  if(shop.status==='suspended')bad('Esta loja está suspensa.',403);
  if(requireApproved && shop.status!=='approved')bad('Sua loja está suspensa.',403);
  return shop;
}
function imagePath(input:unknown) {
  const url=clean(input,400);
  if(!url)return null;
  if(!/^\/api\/media\/[0-9a-f-]{36}$/.test(url))bad('Utilize uma imagem enviada pela plataforma.');
  return url;
}
const credentials=z.object({email:z.string().email().max(250).transform(v=>v.trim().toLowerCase()),password:z.string().min(1).max(100)});
const signup=credentials.extend({
  name:z.string().trim().min(2).max(90),phone:z.string().trim().min(10).max(20),
  password:z.string().min(10).max(100),invite:z.string().trim().min(10).max(150),
  tower:z.string().trim().min(1).max(60),apartment:z.string().trim().min(1).max(24)
});
// The allowed arrival values and conflicts are checked against a shared rule.
const paymentMethodSchema=z.enum(['pix','credit_card','debit_card','cash']);
const paymentMethodsSchema=z.array(paymentMethodSchema).min(1).max(4).refine(items=>new Set(items).size===items.length,'Não repita meios de pagamento.');
const orderSchema=z.object({
  shop_id:z.string().uuid(),
  items:z.array(z.object({id:z.string().uuid(),quantity:z.number().int().min(1).max(30),
    note:z.string().max(200).optional(),
    selections:z.record(z.array(z.string().uuid()).max(15)).optional()})).min(1).max(25),
  payment_method:paymentMethodSchema,
  fulfillment:z.enum(['delivery','pickup']),delivery_day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  delivery_window:z.string().max(70).optional(),instructions:z.array(z.enum(['Bater na porta','Tocar a campainha','Não tocar a campainha','Deixar na porta','Entregar pessoalmente','Retirar na portaria']))
    .max(5).optional().refine(values=>validArrivalInstructions(values??[]),{
      message:'Não é possível escolher tocar a campainha junto com bater na porta ou não tocar.'
    }),
  note:z.string().max(400).optional(),
  client_order_key:z.string().uuid().optional(),
  expected_total_cents:z.number().int().min(1).max(2_147_483_647).optional()
});
const googleRegister=z.object({
  invite:z.string().trim().min(10).max(150),
  name:z.string().trim().min(2).max(90),
  phone:z.string().trim().min(10).max(20),
  tower:z.string().trim().min(1).max(60),
  apartment:z.string().trim().min(1).max(24)
});
type SavedOrder={
  id:string;code:number;shop_name:string;whatsapp:string;total_cents:number;subtotal_cents:number;delivery_fee_cents:number;
  payment_method?:'pix'|'credit_card'|'debit_card'|'cash'|null;
  fulfillment:'delivery'|'pickup';delivery_day?:string|null;delivery_window?:string;
  delivery_instructions?:string[];note?:string
};
async function savedWhatsApp(order:SavedOrder,u:Viewer){
  const items=await query(
    'SELECT name_snapshot AS name,quantity,unit_price_cents,note,options FROM order_items WHERE order_id=$1 ORDER BY id',
    [order.id]
  );
  const message=orderMessage({
    code:order.code,shop:order.shop_name,buyer:u.name,tower:u.tower,apartment:u.apartment,
    items:items.rows.map(i=>({name:String(i.name),quantity:Number(i.quantity),unit_price_cents:Number(i.unit_price_cents),
      note:String(i.note??''),options:i.options??[]})),
    total_cents:order.total_cents,subtotal_cents:order.subtotal_cents,delivery_fee_cents:order.delivery_fee_cents,fulfillment:order.fulfillment,
    delivery_day:order.delivery_day,delivery_window:order.delivery_window,
    instructions:order.delivery_instructions??[],note:order.note,payment_method:order.payment_method
  });
  return 'https://wa.me/'+normalizeWhatsApp(order.whatsapp)+'?text='+encodeURIComponent(message);
}
async function issueAppLogin(userId:string):Promise<{token:string;response:NextResponse}> {
  const token=randomToken();
  await query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '14 days')",[tokenHash(token),userId]);
  const response=out({ok:true});
  issueSession(response,token);
  return {token,response};
}
function oauthRedirect(req:NextRequest,code?:string){
  const url=new URL('/',safeAppOrigin(req));
  if(code)url.searchParams.set('auth_error',code);
  const res=NextResponse.redirect(url);
  res.cookies.set(oauthCookie('condovery_google_flow','',0));
  return res;
}
async function processApi({req,method,parts}:Args):Promise<NextResponse> {
  const path=parts.join('/');
  const requestedTenant=await tenantForRequest(req);
  if(path==='public/condominium'&&method==='POST'){
    const input=z.object({invite:z.string().min(10).max(150)}).parse(await body(req));
    const invite=input.invite;
    if(invite.length<10)bad('Informe um convite válido.');
    const result=await query(
      'SELECT name,towers FROM condominiums WHERE invite_code_hash=$1 AND is_active=true',
      [inviteHash(invite)]
    );
    if(!result.rowCount)bad('Código de convite inválido.',404);
    if(requestedTenant){const match=await query('SELECT id FROM condominiums WHERE invite_code_hash=$1 AND id=$2',[inviteHash(invite),requestedTenant.id]);if(!match.rowCount)bad('Código não pertence a este condomínio.',403);}
    return out({name:result.rows[0].name,towers:result.rows[0].towers});
  }
  if(path==='auth/providers'&&method==='GET')return out({google:googleConfigured(),email:emailConfigured(),passwordRecovery:recoveryConfigured()});
  if(path==='auth/google'&&method==='GET'){
    if(!googleConfigured())bad('Login Google não configurado.',503);
    const {client,pkceValues}=googleAuthClient();
    const callback=safeAppOrigin(req)+'/api/auth/google/callback';
    const {data,error}=await client.auth.signInWithOAuth({
      provider:'google',options:{redirectTo:callback,skipBrowserRedirect:true}
    });
    if(error||!data.url||!pkceValues.size)bad('Não foi possível iniciar o login Google.',502);
    const flow=randomToken();
    await query("INSERT INTO google_oauth_flows(token_hash,pkce_storage) VALUES($1,$2::jsonb)",
      [tokenHash(flow),JSON.stringify(Object.fromEntries(pkceValues))]);
    const response=NextResponse.redirect(data.url!);
    response.cookies.set(oauthCookie('condovery_google_flow',flow));
    return response;
  }
  if(path==='auth/google/callback'&&method==='GET'){
    const code=req.nextUrl.searchParams.get('code');
    const flow=req.cookies.get('condovery_google_flow')?.value;
    if(!code||!flow||!googleConfigured())return oauthRedirect(req,'google_cancelled');
    // Consume the flow exactly once: no replay or other-device callback allowed.
    const existing=await query(
      'DELETE FROM google_oauth_flows WHERE token_hash=$1 AND expires_at>now() RETURNING pkce_storage',
      [tokenHash(flow)]
    );
    if(!existing.rowCount)return oauthRedirect(req,'google_expired');
    const {client}=googleAuthClient(existing.rows[0].pkce_storage as Record<string,string>);
    const {data,error}=await client.auth.exchangeCodeForSession(code);
    const identity=data?.user;
    const verified=Boolean(identity?.email_confirmed_at&&identity.identities?.some(i=>i.provider==='google'));
    if(error||!identity?.id||!identity.email||!verified)return oauthRedirect(req,'google_failed');
    const email=identity.email.trim().toLowerCase();
    // Existing email/password residents may also use a verified Google identity.
    const matched=await query(
      'SELECT id,supabase_auth_user_id FROM users WHERE supabase_auth_user_id=$1 OR email=$2 LIMIT 1',
      [identity.id,email]
    );
    if(matched.rowCount){
      if(matched.rows[0].supabase_auth_user_id&&matched.rows[0].supabase_auth_user_id!==identity.id){
        return oauthRedirect(req,'google_account_conflict');
      }
      await query('UPDATE users SET supabase_auth_user_id=$1,google_auth_user_id=$1 WHERE id=$2 AND (supabase_auth_user_id IS NULL OR supabase_auth_user_id=$1)',
        [identity.id,matched.rows[0].id]);
      const token=randomToken();
      await query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '14 days')",
        [tokenHash(token),matched.rows[0].id]);
      const res=oauthRedirect(req);
      issueSession(res,token);
      res.cookies.set(oauthCookie('condovery_google_signup','',0));
      return res;
    }
    const pending=randomToken();
    await query(
      'INSERT INTO google_signup_pending(token_hash,google_auth_user_id,email,name) VALUES($1,$2,$3,$4)',
      [tokenHash(pending),identity.id,email,clean(identity.user_metadata?.full_name||identity.user_metadata?.name||'',90)]
    );
    const res=oauthRedirect(req);
    res.cookies.set(oauthCookie('condovery_google_signup',pending,900));
    return res;
  }
  if(path==='auth/register-google'&&method==='POST'){
    const pending=req.cookies.get('condovery_google_signup')?.value;
    if(!pending)bad('Inicie o cadastro pelo Google.',401);
    const b=googleRegister.parse(await body(req));
    const result=await transaction(async tx=>{
      const waiting=await tx.query(
        'DELETE FROM google_signup_pending WHERE token_hash=$1 AND expires_at>now() RETURNING *',
        [tokenHash(pending!)]
      );
      if(!waiting.rowCount)bad('Cadastro Google expirado. Entre novamente.',401);
      const deleting=await tx.query('SELECT 1 FROM account_deletion_jobs WHERE email_hash=$1 AND finished_at IS NULL',
        [crypto.createHash('sha256').update(waiting.rows[0].email).digest('hex')]);
      if(deleting.rowCount)bad('A exclusão anterior ainda está em processamento.',409);
      const linked=await tx.query('SELECT id FROM users WHERE email=$1 OR google_auth_user_id=$2',
        [waiting.rows[0].email,waiting.rows[0].google_auth_user_id]);
      if(linked.rowCount)bad('E-mail já cadastrado. Entre com o Google novamente.',409);
      const condo=await tx.query(
        'SELECT id,towers FROM condominiums WHERE invite_code_hash=$1 AND is_active=true',
        [inviteHash(b.invite)]
      );
      if(!condo.rowCount)bad('Convite inválido.');
      if(requestedTenant&&condo.rows[0].id!==requestedTenant.id)bad('Convite de outro condomínio.',403);
      if(!Array.isArray(condo.rows[0].towers)||!condo.rows[0].towers.includes(b.tower))bad('Torre inválida.');
      const created=await tx.query(
        "INSERT INTO users(condominium_id,name,email,phone,password_hash,google_auth_user_id,supabase_auth_user_id,tower,apartment,status) VALUES($1,$2,$3,$4,NULL,$5,$5,$6,$7,'approved') RETURNING id",
        [condo.rows[0].id,b.name,waiting.rows[0].email,b.phone,waiting.rows[0].google_auth_user_id,b.tower,b.apartment]
      );
      const token=randomToken();
      await tx.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '14 days')",
        [tokenHash(token),created.rows[0].id]);
      return token;
    });
    const response=out({message:'Conta criada! Você já pode explorar seu condomínio.'},201);
    issueSession(response,result);
    response.cookies.set(oauthCookie('condovery_google_signup','',0));
    return response;
  }
  if(path==='auth/password/request'&&method==='POST'){
    if(!recoveryConfigured())bad('Recuperação do Supabase Auth não configurada.',503);
    const b=z.object({email:z.string().email().max(250).transform(v=>v.trim().toLowerCase())}).parse(await body(req));
    const ip=clean(req.headers.get('x-real-ip')||req.headers.get('cf-connecting-ip')||'unknown',80);
    const hits=await query(
      "SELECT (SELECT count(*)::int FROM password_reset_attempts WHERE email=$1 AND created_at>now()-interval '1 hour') AS email_count,(SELECT count(*)::int FROM password_reset_attempts WHERE ip=$2 AND created_at>now()-interval '1 hour') AS ip_count",
      [b.email,ip]
    );
    const generic='Se houver uma conta cadastrada, você receberá um e-mail de recuperação do Supabase Auth.';
    if(hits.rows[0].email_count>=3||hits.rows[0].ip_count>=15)return out({message:generic});
    await query('INSERT INTO password_reset_attempts(email,ip) VALUES($1,$2)',[b.email,ip]);
    const {error}=await passwordAuthClient().auth.resetPasswordForEmail(b.email,{
      redirectTo:safeAppOrigin(req)+'/api/auth/recovery/verify'
    });
    if(error)console.error('supabase_recovery_request_failed',error.status||'unknown');
    return out({message:generic});
  }
  if(path==='auth/recovery/verify'&&method==='GET'){
    const hash=req.nextUrl.searchParams.get('token_hash');
    const type=req.nextUrl.searchParams.get('type');
    if(!hash||type!=='recovery')return oauthRedirect(req,'recovery_invalid');
    const {data,error}=await passwordAuthClient().auth.verifyOtp({token_hash:hash,type:'recovery'});
    if(error||!data.user?.id||!data.user.email_confirmed_at)return oauthRedirect(req,'recovery_expired');
    const found=await query('SELECT id FROM users WHERE supabase_auth_user_id=$1',
      [data.user.id]);
    if(!found.rowCount)return oauthRedirect(req,'recovery_unavailable');
    const ticket=randomToken();
    await transaction(async tx=>{
      await tx.query('DELETE FROM password_reset_tokens WHERE user_id=$1',[found.rows[0].id]);
      await tx.query(
        "INSERT INTO password_reset_tokens(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '15 minutes')",
        [tokenHash(ticket),found.rows[0].id]
      );
    });
    const res=NextResponse.redirect(new URL('/?reset=1',safeAppOrigin(req)));
    res.cookies.set(oauthCookie('condovery_recovery',ticket,900));
    return res;
  }
  if(path==='auth/password/confirm'&&method==='POST'){
    if(!recoveryConfigured())bad('Recuperação não configurada.',503);
    const cookie=req.cookies.get('condovery_recovery')?.value;
    if(!cookie||!/^[0-9a-f]{64}$/.test(cookie))bad('Abra primeiro o link enviado por e-mail.',401);
    const b=z.object({password:z.string().min(10).max(100)}).parse(await body(req));
    const result=await query(
      'DELETE FROM password_reset_tokens WHERE token_hash=$1 AND expires_at>now() RETURNING user_id',
      [tokenHash(cookie!)]
    );
    if(!result.rowCount)bad('Link expirado ou já utilizado.',400);
    const found=await query('SELECT supabase_auth_user_id FROM users WHERE id=$1',[result.rows[0].user_id]);
    if(!found.rows[0]?.supabase_auth_user_id)bad('Identidade Supabase não vinculada.',409);
    const {error}=await storageAdmin().auth.admin.updateUserById(found.rows[0].supabase_auth_user_id,{
      password:b.password
    });
    if(error){
      console.error('supabase_password_update_failed',error.status||'unknown');
      bad('Não foi possível alterar a senha. Solicite um novo link.',502);
    }
    await query('DELETE FROM sessions WHERE user_id=$1',[result.rows[0].user_id]);
    const res=out({message:'Senha atualizada pelo Supabase Auth. Faça login novamente.'});
    res.cookies.set(oauthCookie('condovery_recovery','',0));
    return res;
  }
  if(path==='auth/register'&&method==='POST'){
    if(!emailConfigured())bad('Cadastro por e-mail não configurado.',503);
    const b=signup.parse(await body(req));
    const reRegHash=crypto.createHash('sha256').update(b.email).digest('hex');
    const deleting=await query('SELECT 1 FROM account_deletion_jobs WHERE email_hash=$1 AND finished_at IS NULL',
      [reRegHash]);
    if(deleting.rowCount)bad('A exclusão anterior deste e-mail ainda está em processamento.',409);
    const condo=await query(
      "SELECT id,towers FROM condominiums WHERE invite_code_hash=$1 AND is_active=true",
      [inviteHash(b.invite)]
    );
    if(!condo.rowCount)bad('Código de convite inválido.');
    if(requestedTenant&&condo.rows[0].id!==requestedTenant.id)bad('Código de outro condomínio.',403);
    if(!Array.isArray(condo.rows[0].towers)||!condo.rows[0].towers.includes(b.tower))bad('Torre inválida.');
    const exists=await query('SELECT id FROM users WHERE email=$1',[b.email]);
    if(exists.rowCount)bad('E-mail já cadastrado. Faça login ou recupere a senha.',409);
    const {data,error}=await passwordAuthClient().auth.signUp({
      email:b.email,password:b.password,
      options:{
        emailRedirectTo:safeAppOrigin(req)+'/?email_confirmed=1',
        data:{name:b.name}
      }
    });
    if(error){
      if(error.status===429)bad('Muitas tentativas de cadastro. Tente novamente mais tarde.',429);
      bad('Não foi possível cadastrar este e-mail no Supabase Auth.',400);
    }
    const authUser=data.user;
    if(!authUser?.id||!authUser.identities?.some(i=>i.provider==='email')){
      bad('Conta já existente. Faça login ou utilize a recuperação de senha.',409);
    }
    try{
      await query(
        "INSERT INTO users(condominium_id,name,email,phone,password_hash,supabase_auth_user_id,tower,apartment,status) VALUES($1,$2,$3,$4,NULL,$5,$6,$7,'approved')",
        [condo.rows[0].id,b.name,b.email,b.phone,authUser!.id,b.tower,b.apartment]
      );
    }catch(e:unknown){
      if((e as {code?:string}).code==='23505')bad('E-mail já cadastrado.',409);
      throw e;
    }
    return out({
      message:'Conta criada! Confirme seu e-mail para entrar no Condovery.',
      verificationRequired:!authUser!.email_confirmed_at
    },201);
  }
  if(path==='auth/login'&&method==='POST'){
    if(!emailConfigured())bad('Login por e-mail não configurado.',503);
    const b=credentials.parse(await body(req));
    const failures=await query(
      "SELECT count(*)::int AS count FROM login_attempts WHERE email=$1 AND occurred_at>now()-interval '15 minutes'",
      [b.email]
    );
    if(failures.rows[0].count>=8)bad('Muitas tentativas. Tente novamente em 15 minutos.',429);
    const {data,error}=await passwordAuthClient().auth.signInWithPassword({email:b.email,password:b.password});
    if(error||!data.user?.id||!data.user.email_confirmed_at){
      await query('INSERT INTO login_attempts(email,ip) VALUES($1,$2)',
        [b.email,clean(req.headers.get('x-real-ip')||'unknown',80)]);
      bad('Credenciais inválidas ou e-mail ainda não confirmado.',401);
    }
    const verifiedUser=data.user!;
    const member=await query(
      'SELECT id,status,supabase_auth_user_id FROM users WHERE supabase_auth_user_id=$1 OR email=$2 LIMIT 1',
      [verifiedUser.id,b.email]
    );
    if(!member.rowCount)bad('Conta sem vínculo com um condomínio. Solicite um convite.',403);
    if(member.rows[0].supabase_auth_user_id&&member.rows[0].supabase_auth_user_id!==verifiedUser.id){
      bad('Esta conta está vinculada a outra identidade. Entre em contato com a administração.',403);
    }
    if(member.rows[0].status==='suspended')bad('Conta suspensa.',403);
    if(requestedTenant){const access=await query('SELECT condominium_id FROM users WHERE id=$1',[member.rows[0].id]);if(access.rows[0]?.condominium_id!==requestedTenant.id)bad('Esta conta pertence a outro condomínio.',403);}
    if(!member.rows[0].supabase_auth_user_id){
      await query('UPDATE users SET supabase_auth_user_id=$1 WHERE id=$2 AND supabase_auth_user_id IS NULL',
        [verifiedUser.id,member.rows[0].id]);
    }
    await query('DELETE FROM login_attempts WHERE email=$1',[b.email]);
    return (await issueAppLogin(member.rows[0].id)).response;
  }
  if(path==='auth/logout'&&method==='POST'){
    const token=req.cookies.get('condovery_session')?.value;
    if(token)await query('DELETE FROM sessions WHERE token_hash=$1',[tokenHash(token)]);
    const response=out({ok:true});clearSession(response);return response;
  }
  if(path==='me'&&method==='GET'){
    const u=await sessionViewer(req);
    const pendingToken=req.cookies.get('condovery_google_signup')?.value;
    let googleSignup:null|{email:string;name:string}=null;
    if(!u&&pendingToken){
      const result=await query(
        'SELECT email,name FROM google_signup_pending WHERE token_hash=$1 AND expires_at>now()',
        [tokenHash(pendingToken)]
      );
      if(result.rowCount)googleSignup={email:result.rows[0].email,name:result.rows[0].name};
    }
    return out({viewer:u,googleSignup});
  }
  const u=await viewer(req);
  if(path.startsWith('platform/')&&requestedTenant)bad('A gestão global deve ser acessada pelo domínio principal.',403);
  // Only the server-owned platform_admins table can authorize these routes.
  // Sessions of ordinary condo administrators can never choose another tenant.
  // Campanhas pagas: nenhum dado de campanha pode ser alterado por administradores locais.
  if(path==='platform/ads'&&method==='GET'){
    if(!u.is_superadmin)bad('Acesso exclusivo do superadmin.',403);
    const [settings,campaigns]=await Promise.all([
      query('SELECT enabled FROM ads_settings WHERE id=true'),
      query('SELECT id,condominium_id,merchant_name,headline,description,location,image_url,destination_url,starts_at,expires_at,enabled FROM advertising_campaigns ORDER BY created_at DESC LIMIT 300')
    ]);
    return out({enabled:settings.rows[0]?.enabled??false,campaigns:campaigns.rows});
  }
  if(path==='platform/ads/settings'&&method==='PATCH'){
    if(!u.is_superadmin)bad('Acesso exclusivo do superadmin.',403);
    const b=z.object({enabled:z.boolean()}).parse(await body(req));
    await query('UPDATE ads_settings SET enabled=$1,updated_at=now() WHERE id=true',[b.enabled]);
    return out({ok:true});
  }
  if(path==='platform/ads'&&method==='POST'){
    if(!u.is_superadmin)bad('Acesso exclusivo do superadmin.',403);
    const b=z.object({
      condominium_id:z.string().uuid(),
      merchant_name:z.string().trim().min(2).max(100),
      headline:z.string().trim().min(2).max(140),
      description:z.string().trim().max(400),
      location:z.string().trim().min(2).max(120),
      image_url:z.string().regex(/^\/api\/media\/[0-9a-f-]{36}$/i,'Envie a imagem pelo upload.'),
      destination_url:z.string().url().max(2000).refine(v=>v.startsWith('https://'),'Use link HTTPS.'),
      starts_at:z.string().datetime({offset:true}),
      expires_at:z.string().datetime({offset:true}),
      enabled:z.boolean().default(false)
    }).parse(await body(req));
    if(new Date(b.expires_at)<=new Date(b.starts_at))bad('A data de expiração deve ser posterior ao início.');
    const target=await query('SELECT 1 FROM condominiums WHERE id=$1 AND is_active=true',[b.condominium_id]);
    if(!target.rowCount)bad('Condomínio inválido.');
    const result=await query(
      'INSERT INTO advertising_campaigns(condominium_id,merchant_name,headline,description,location,image_url,destination_url,starts_at,expires_at,enabled) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',
      [b.condominium_id,b.merchant_name,b.headline,b.description,b.location,b.image_url,b.destination_url,b.starts_at,b.expires_at,b.enabled]);
    return out({id:result.rows[0].id},201);
  }
  if(path.startsWith('platform/ads/')&&method==='PATCH'&&path!=='platform/ads/settings'){
    if(!u.is_superadmin)bad('Acesso exclusivo do superadmin.',403);
    const id=parts[2];
    if(!uuid(id))bad('Anúncio inválido.');
    const b=z.object({enabled:z.boolean()}).parse(await body(req));
    const result=await query('UPDATE advertising_campaigns SET enabled=$1,updated_at=now() WHERE id=$2 RETURNING id',[b.enabled,id]);
    if(!result.rowCount)bad('Anúncio não encontrado.',404);
    return out({ok:true});
  }
  if(path.startsWith('platform/ads/')&&method==='DELETE'){
    if(!u.is_superadmin)bad('Acesso exclusivo do superadmin.',403);
    const id=parts[2];
    if(!uuid(id))bad('Anúncio inválido.');
    await query('DELETE FROM advertising_campaigns WHERE id=$1',[id]);
    return out({ok:true});
  }
  if(path==='platform/condominiums'&&method==='GET'){
    if(!u.is_superadmin)bad('Acesso exclusivo do superadmin.',403);
    const list=await query(
      "SELECT c.id,c.name,c.slug,c.subdomain,c.custom_domain,c.is_active,c.created_at,"+
      " (SELECT count(*)::int FROM users m WHERE m.condominium_id=c.id AND m.role='resident' AND m.status='approved') AS residents,"+
      " (SELECT count(*)::int FROM shops s WHERE s.condominium_id=c.id AND s.status='approved') AS shops"+
      " FROM condominiums c ORDER BY c.created_at DESC LIMIT 250"
    );
    return out({condominiums:list.rows,active_condominium_id:u.condominium_id});
  }
  if(path==='platform/condominiums'&&method==='POST'){
    if(!u.is_superadmin)bad('Acesso exclusivo do superadmin.',403);
    const b=z.object({
      name:z.string().trim().min(3).max(100),
      slug:z.string().trim().min(3).max(60),
      invite_code:z.string().trim().min(10).max(150),
      tower_scheme:z.enum(['letters','numbers']).default('letters'),
      tower_count:z.number().int().min(1).max(30).default(30),
      custom_domain:z.string().trim().max(253).optional()
    }).parse(await body(req));
    const slug=normalizeCondominiumSlug(b.slug);
    const baseSubdomain=tenantLabel(slug);
    const existsSubdomain=await query('SELECT id FROM condominiums WHERE subdomain=$1',[baseSubdomain]);
    const subdomain=existsSubdomain.rowCount?baseSubdomain.slice(0,38)+crypto.randomBytes(4).toString('hex'):baseSubdomain;
    if(slug.length<3)bad('Identificador do condomínio inválido.');
    const hostname=b.custom_domain?normalizeTenantDomain(b.custom_domain):null;
    const hash=inviteHash(b.invite_code);
    const existing=await query('SELECT id FROM condominiums WHERE invite_code_hash=$1',[hash]);
    if(existing.rowCount)bad('Este código de condomínio já está em uso.',409);
    const created=await transaction(async tx=>{
      const result=await tx.query(
        "INSERT INTO condominiums(name,slug,invite_code_hash,towers,custom_domain,subdomain) VALUES($1,$2,$3,$4::jsonb,$5,$6) "+
        "ON CONFLICT DO NOTHING RETURNING id,name,slug,subdomain,custom_domain,is_active",
        [b.name,slug,hash,JSON.stringify(towerLabels(b.tower_scheme,b.tower_count)),hostname,subdomain]
      );
      if(!result.rowCount)bad('Já existe condomínio com este endereço.',409);
      const defaultCategories=[
        ['Bolos e doces','cake-slice'],['Pães e salgados','sandwich'],['Refeições','utensils'],
        ['Bebidas','coffee'],['Lanches','pizza'],['Sobremesas e sorvetes','ice-cream-cone'],
        ['Mercadinho','shopping-basket']
      ];
      for(let i=0;i<defaultCategories.length;i++){
        await tx.query("INSERT INTO categories(condominium_id,name,icon,sort_order) VALUES($1,$2,$3,$4)",
          [result.rows[0].id,defaultCategories[i][0],defaultCategories[i][1],i]);
      }
      for(const [name,icon,order] of [['Serviços','wrench',70],['Moda','shirt',71],['Desapego','gift',72]] as const){
        await tx.query('INSERT INTO categories(condominium_id,name,icon,sort_order,is_active) VALUES($1,$2,$3,$4,false) ON CONFLICT(condominium_id,name) DO NOTHING',
          [result.rows[0].id,name,icon,order]);
      }
      return result.rows[0];
    });
    return out({condominium:created},201);
  }
  if(path==='platform/condominiums/switch'&&method==='POST'){
    if(!u.is_superadmin)bad('Acesso exclusivo do superadmin.',403);
    const b=z.object({condominium_id:z.string().uuid()}).parse(await body(req));
    const target=await query('SELECT id FROM condominiums WHERE id=$1 AND is_active=true',[b.condominium_id]);
    if(!target.rowCount)bad('Condomínio indisponível.',404);
    const token=req.cookies.get('condovery_session')?.value;
    if(!token)bad('Sessão expirada.',401);
    await query(
      "UPDATE sessions SET active_condominium_id=$1 WHERE token_hash=$2 AND user_id=$3",
      [b.condominium_id,tokenHash(token!),u.id]
    );
    return out({ok:true,condominium_id:b.condominium_id});
  }
  if(path==='platform/condominiums/admin'&&method==='POST'){
    if(!u.is_superadmin)bad('Acesso exclusivo do superadmin.',403);
    const b=z.object({
      condominium_id:z.string().uuid(),
      name:z.string().trim().min(2).max(90),
      email:z.string().email().transform(v=>v.trim().toLowerCase()),
      password:z.string().min(12).max(100)
    }).parse(await body(req));
    const condo=await query('SELECT id FROM condominiums WHERE id=$1 AND is_active=true',[b.condominium_id]);
    if(!condo.rowCount)bad('Condomínio indisponível.',404);
    const duplicated=await query('SELECT id FROM users WHERE email=$1',[b.email]);
    if(duplicated.rowCount)bad('E-mail já cadastrado. Utilize outro e-mail de administrador.',409);
    const supa=storageAdmin();
    const {data,error}=await supa.auth.admin.createUser({
      email:b.email,password:b.password,email_confirm:true,user_metadata:{name:b.name}
    });
    if(error||!data.user)bad('Não foi possível criar a identidade do administrador: '+(error?.message??'erro desconhecido'),409);
    const adminAuthId=data.user!.id;
    try{
      const added=await query(
        "INSERT INTO users(condominium_id,name,email,phone,password_hash,supabase_auth_user_id,role,status,tower,apartment)"+
        " VALUES($1,$2,$3,'',NULL,$4,'admin','approved','Admin','Admin') RETURNING id,name,email",
        [b.condominium_id,b.name,b.email,adminAuthId]
      );
      return out({admin:added.rows[0]},201);
    }catch(error){
      await supa.auth.admin.deleteUser(adminAuthId).catch(()=>{});
      throw error;
    }
  }
  if(path==='me'&&method==='PATCH'){
    approved(u);
    const b=z.object({name:z.string().trim().min(2).max(90),phone:z.string().trim().min(10).max(20),tower:z.string().min(1).max(60),apartment:z.string().min(1).max(24),avatar_image:z.string().nullable().optional()}).parse(await body(req));
    if(b.avatar_image){
      const avatar=await query('SELECT id FROM media_assets WHERE id=$1 AND condominium_id=$2 AND user_id=$3',
        [imagePath(b.avatar_image)?.split('/').pop(),u.condominium_id,u.id]);
      if(!avatar.rowCount)bad('Escolha uma foto enviada no seu perfil.',403);
    }
    if(!u.towers.includes(b.tower))bad('Torre inválida.');
    await query(
      "UPDATE users SET name=$1,phone=$2,tower=$3,apartment=$4,avatar_image=COALESCE($7,avatar_image) WHERE id=$5 AND condominium_id=$6",
      [b.name,b.phone,b.tower,b.apartment,u.id,u.condominium_id,b.avatar_image??null]
    );
    return out({ok:true});
  }
  if(path==='me'&&method==='DELETE'){
    if(u.role!=='resident')bad('A conta administrativa não pode ser excluída sem transferir a gestão do condomínio.',403);
    approved(u);
    const input=z.object({confirmation:z.literal('EXCLUIR'),password:z.string().max(100).optional()})
      .parse(await body(req));
    const member=await query(
      'SELECT id,email,supabase_auth_user_id FROM users WHERE id=$1 AND condominium_id=$2 AND status=\'approved\'',
      [u.id,u.condominium_id]
    );
    if(!member.rowCount||!member.rows[0].supabase_auth_user_id)bad('Identidade não encontrada para exclusão.',409);
    const email=member.rows[0].email as string;
    const authId=member.rows[0].supabase_auth_user_id as string;
    if(!storageConfigured())bad('Serviço de remoção de identidade indisponível.',503);
    // Password accounts require reauthentication; Google-only sessions must be recent.
    const identity=await storageAdmin().auth.admin.getUserById(authId);
    const currentIdentity=identity.data.user;
    if(identity.error||!currentIdentity)throw new ApiError(502,'Não foi possível confirmar sua identidade. Tente novamente.');
    if(currentIdentity.identities?.some(item=>item.provider==='email')){
      const currentPassword=input.password;
      if(!currentPassword)throw new ApiError(400,'Informe sua senha atual para confirmar a exclusão.');
      const verified=await passwordAuthClient().auth.signInWithPassword({email,password:currentPassword});
      if(verified.error||verified.data.user?.id!==authId)bad('Senha incorreta. Conta não excluída.',401);
    }else{
      const cookie=req.cookies.get('condovery_session')?.value;
      const fresh=cookie?await query(
        "SELECT 1 FROM sessions WHERE token_hash=$1 AND user_id=$2 AND created_at>now()-interval '15 minutes'",
        [tokenHash(cookie),u.id]
      ):null;
      if(!fresh?.rowCount)bad('Por segurança, entre novamente com o Google e repita a exclusão.',403);
    }
    const deletion=await transaction(async tx=>{
      const locked=await tx.query(
        "SELECT id,email,supabase_auth_user_id FROM users WHERE id=$1 AND condominium_id=$2 AND status='approved' FOR UPDATE",
        [u.id,u.condominium_id]
      );
      if(!locked.rowCount||locked.rows[0].supabase_auth_user_id!==authId)
        bad('Esta conta já foi encerrada.',409);
      const ongoing=await tx.query(
        "SELECT EXISTS(SELECT 1 FROM orders o WHERE "+
        "(o.buyer_id=$1 OR o.shop_id IN (SELECT id FROM shops WHERE owner_id=$1)) "+
        "AND o.status IN ('awaiting_confirmation','confirmed')) AS active",
        [u.id]
      );
      if(ongoing.rows[0].active)bad(
        'Você possui pedidos aguardando ou confirmados. Conclua ou cancele esses pedidos antes de excluir a conta.',409
      );
      const stores=await tx.query('SELECT id FROM shops WHERE owner_id=$1 AND condominium_id=$2 FOR UPDATE',
        [u.id,u.condominium_id]);
      const shopIds=stores.rows.map(row=>row.id as string);
      const media=await tx.query(
        'SELECT storage_key FROM media_assets WHERE user_id=$1 OR shop_id=ANY($2::uuid[])',
        [u.id,shopIds]
      );
      const keys=[...new Set(media.rows.map(row=>row.storage_key).filter(
        (v):v is string=>typeof v==='string'&&v.length>0
      ))];
      const job=await tx.query(
        'INSERT INTO account_deletion_jobs(user_id,auth_user_id,email_hash,storage_keys) VALUES($1,$2,$3,$4::jsonb) RETURNING id',
        [u.id,authId,crypto.createHash('sha256').update(email).digest('hex'),JSON.stringify(keys)]
      );
      // Review texts, favorites, reports and image objects are no longer needed.
      await tx.query('DELETE FROM shop_reviews WHERE buyer_id=$1 OR shop_id=ANY($2::uuid[])',
        [u.id,shopIds]);
      await tx.query('DELETE FROM content_reports WHERE reporter_id=$1 OR '+
        "(target_type='shop' AND target_id=ANY($2::uuid[])) OR "+
        "(target_type='product' AND target_id IN (SELECT id FROM products WHERE shop_id=ANY($2::uuid[])))",
        [u.id,shopIds]);
      await tx.query('DELETE FROM favorites WHERE user_id=$1 OR product_id IN '+
        '(SELECT id FROM products WHERE shop_id=ANY($2::uuid[]))',[u.id,shopIds]);
      await tx.query('DELETE FROM media_assets WHERE user_id=$1 OR shop_id=ANY($2::uuid[])',
        [u.id,shopIds]);
      // Historical orders/line-item monetary snapshots are retained without free-text PII.
      await tx.query(
        "UPDATE orders SET note='',delivery_instructions='[]'::jsonb,delivery_window='',delivery_day=NULL "+
        "WHERE buyer_id=$1 OR shop_id=ANY($2::uuid[])",[u.id,shopIds]
      );
      await tx.query(
        "UPDATE order_items SET note='' WHERE order_id IN "+
        "(SELECT id FROM orders WHERE buyer_id=$1 OR shop_id=ANY($2::uuid[]))",
        [u.id,shopIds]
      );
      await tx.query(
        "UPDATE products SET name='Produto indisponível',description='',image_url=NULL,"+
        "option_groups='[]'::jsonb,visibility='hidden',is_available=false "+
        "WHERE shop_id=ANY($1::uuid[])",[shopIds]
      );
      await tx.query(
        "UPDATE shops SET status='deleted',is_open=false,name='Loja encerrada',"+
        "description='',whatsapp='',cover_image=NULL,logo_image=NULL,pickup_instructions='' "+
        "WHERE owner_id=$1 AND condominium_id=$2",[u.id,u.condominium_id]
      );
      await tx.query('DELETE FROM sessions WHERE user_id=$1',[u.id]);
      await tx.query('DELETE FROM password_reset_tokens WHERE user_id=$1',[u.id]);
      await tx.query('DELETE FROM login_attempts WHERE email=$1',[email]);
      await tx.query('DELETE FROM password_reset_attempts WHERE email=$1',[email]);
      await tx.query('DELETE FROM google_signup_pending WHERE email=$1',[email]);
      await tx.query(
        "UPDATE users SET name='Conta excluída',email='excluida-'||replace(id::text,'-','')||'@deleted.invalid',"+
        "phone='',tower='Não disponível',apartment='—',avatar_image=NULL,password_hash=NULL,"+
        "supabase_auth_user_id=NULL,google_auth_user_id=NULL,status='deleted',deleted_at=now() "+
        "WHERE id=$1 AND condominium_id=$2",[u.id,u.condominium_id]
      );
      return job.rows[0].id as string;
    });
    const cleanup=await processAccountDeletionJob(deletion);
    const response=out({
      status:cleanup,
      message:cleanup==='completed'?'Sua conta foi excluída.':
        'Sua conta foi encerrada. A remoção final da identidade está pendente de processamento técnico.'
    },cleanup==='completed'?200:202);
    clearSession(response);
    return response;
  }
  approved(u);
  if(path==='favorites'&&method==='GET'){
    const r=await query(
      "SELECT p.id,p.shop_id,p.category_id,p.name,p.description,p.price_cents,p.promo_price_cents,p.image_url,p.stock,p.visibility,p.lead_time,p.is_featured,p.option_groups,s.name AS shop_name,s.is_open FROM favorites f JOIN products p ON p.id=f.product_id AND p.condominium_id=f.condominium_id JOIN categories c ON c.id=p.category_id AND c.condominium_id=p.condominium_id AND c.is_active=true JOIN shops s ON s.id=p.shop_id AND s.condominium_id=f.condominium_id WHERE f.condominium_id=$1 AND f.user_id=$2 AND p.visibility<>'hidden' AND p.deleted_at IS NULL AND s.status='approved' ORDER BY f.created_at DESC LIMIT 150",
      [u.condominium_id,u.id]
    );
    return out({ids:r.rows.map(row=>row.id),products:r.rows});
  }
  if(path==='favorites'&&method==='POST'){
    const b=z.object({product_id:z.string().uuid()}).parse(await body(req));
    const valid=await query(
      "SELECT p.id FROM products p JOIN categories c ON c.id=p.category_id AND c.condominium_id=p.condominium_id AND c.is_active=true JOIN shops s ON s.id=p.shop_id AND s.condominium_id=p.condominium_id WHERE p.id=$1 AND p.condominium_id=$2 AND p.visibility<>'hidden' AND p.deleted_at IS NULL AND s.status='approved'",
      [b.product_id,u.condominium_id]
    );
    if(!valid.rowCount)bad('Produto indisponível.',404);
    await query('INSERT INTO favorites(condominium_id,user_id,product_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [u.condominium_id,u.id,b.product_id]);
    return out({ok:true});
  }
  if(parts[0]==='favorites'&&parts[1]&&method==='DELETE'){
    if(!uuid(parts[1]))bad('Produto inválido.');
    await query('DELETE FROM favorites WHERE condominium_id=$1 AND user_id=$2 AND product_id=$3',
      [u.condominium_id,u.id,parts[1]]);
    return out({ok:true});
  }
  if(path==='catalog'&&method==='GET'){
    const pageText=req.nextUrl.searchParams.get('page')??'0';
    const limitText=req.nextUrl.searchParams.get('limit')??'24';
    const page=Number(pageText),limit=Number(limitText);
    if(!Number.isInteger(page)||page<0||page>250||!Number.isInteger(limit)||limit<1||limit>48){
      bad('Paginação inválida.');
    }
    const search=clean(req.nextUrl.searchParams.get('search'),100);
    const category=req.nextUrl.searchParams.get('category')||null;
    if(category&&!uuid(category))bad('Categoria inválida.');
    const escaped='%'+search.replace(/[%_\\]/g,'')+'%';
    const result=await query(
      "SELECT p.id,p.shop_id,p.category_id,p.name,p.description,p.price_cents,p.promo_price_cents,p.image_url,p.stock,p.visibility,p.lead_time,p.is_featured,p.option_groups,s.name AS shop_name,s.is_open FROM products p JOIN categories c ON c.id=p.category_id AND c.condominium_id=p.condominium_id AND c.is_active=true JOIN shops s ON s.id=p.shop_id AND s.condominium_id=p.condominium_id WHERE p.condominium_id=$1 AND p.visibility<>'hidden' AND p.deleted_at IS NULL AND s.status='approved' AND ($2::uuid IS NULL OR p.category_id=$2::uuid) AND ($3::text='' OR p.name ILIKE $3 ESCAPE '\\' OR s.name ILIKE $3 ESCAPE '\\') ORDER BY p.created_at DESC,p.id DESC LIMIT $4 OFFSET $5",
      [u.condominium_id,category,search?escaped:'',limit+1,page*limit]
    );
    return out({products:result.rows.slice(0,limit),hasMore:result.rows.length>limit,page});
  }
  if(path==='ads'&&method==='GET'){
    const result=await query(
      "SELECT a.id,a.merchant_name,a.headline,a.description,a.location,a.image_url,a.destination_url FROM advertising_campaigns a JOIN ads_settings settings ON settings.id=true AND settings.enabled=true WHERE a.condominium_id=$1 AND a.enabled=true AND a.starts_at<=now() AND a.expires_at>now() ORDER BY a.created_at DESC LIMIT 20",
      [u.condominium_id]
    );
    return out({campaigns:result.rows});
  }
  // Desapego: classificados gratuitos por morador, sem loja ou pagamento.
  if(path==='giveaways'||path.startsWith('giveaways/')){
    const active=await query("SELECT 1 FROM categories WHERE condominium_id=$1 AND name='Desapego' AND is_active=true",[u.condominium_id]);
    if(!active.rowCount)bad('Desapego não está habilitado neste condomínio.',404);
    if(path==='giveaways'&&method==='GET'){
      const listings=await query(
        "SELECT g.id,g.user_id,g.title,g.description,g.image_url,g.status,g.created_at,m.name AS owner_name,m.phone AS owner_phone FROM giveaway_items g JOIN users m ON m.id=g.user_id AND m.condominium_id=g.condominium_id AND m.status='approved' WHERE g.condominium_id=$1 AND (g.status='available' OR g.user_id=$2) ORDER BY CASE WHEN g.status='available' THEN 0 ELSE 1 END,g.created_at DESC LIMIT 150",
        [u.condominium_id,u.id]);
      return out({items:listings.rows});
    }
    if(path==='giveaways'&&method==='POST'){
      approved(u);
      const b=z.object({title:z.string().trim().min(3).max(120),description:z.string().trim().max(600),image_url:z.union([z.literal(''),z.string().regex(/^\/api\/media\/[0-9a-f-]{36}$/i)]).default('')}).parse(await body(req));
      const result=await query("INSERT INTO giveaway_items(condominium_id,user_id,title,description,image_url) VALUES($1,$2,$3,$4,$5) RETURNING id",[u.condominium_id,u.id,b.title,b.description,b.image_url||null]);
      return out({id:result.rows[0].id},201);
    }
    if(path.startsWith('giveaways/')&&method==='PATCH'){
      approved(u);
      const id=parts[1];if(!uuid(id))bad('Item inválido.');
      const b=z.object({status:z.enum(['available','reserved','donated'])}).parse(await body(req));
      const result=await query("UPDATE giveaway_items SET status=$1,donated_at=CASE WHEN $1='donated' THEN COALESCE(donated_at,now()) ELSE NULL END,updated_at=now() WHERE id=$2 AND user_id=$3 AND condominium_id=$4 RETURNING id",[b.status,id,u.id,u.condominium_id]);
      if(!result.rowCount)bad('Item não encontrado ou sem permissão.',404);
      return out({ok:true});
    }
    if(path.startsWith('giveaways/')&&method==='DELETE'){
      approved(u);
      const id=parts[1];if(!uuid(id))bad('Item inválido.');
      const result=await query('DELETE FROM giveaway_items WHERE id=$1 AND user_id=$2 AND condominium_id=$3 RETURNING id',[id,u.id,u.condominium_id]);
      if(!result.rowCount)bad('Item não encontrado ou sem permissão.',404);
      return out({ok:true});
    }
  }
  if(path==='home'&&method==='GET'){
    const [categories,shops,products]=await Promise.all([
      query('SELECT id,name,icon FROM categories WHERE condominium_id=$1 AND is_active=true ORDER BY sort_order,name',[u.condominium_id]),
      query("SELECT id,name,slug,description,cover_image,logo_image,is_open,delivery_enabled,pickup_enabled,delivery_fee_cents,payment_methods,lead_time FROM shops WHERE condominium_id=$1 AND status='approved' ORDER BY is_open DESC,created_at DESC LIMIT 100",[u.condominium_id]),
      query("SELECT p.id,p.shop_id,p.category_id,p.name,p.description,p.price_cents,p.promo_price_cents,p.image_url,p.stock,p.visibility,p.lead_time,p.is_featured,p.option_groups,s.name AS shop_name,s.is_open FROM products p JOIN categories c ON c.id=p.category_id AND c.condominium_id=p.condominium_id AND c.is_active=true JOIN shops s ON s.id=p.shop_id WHERE p.condominium_id=$1 AND s.condominium_id=$1 AND p.visibility<>'hidden' AND p.deleted_at IS NULL AND s.status='approved' ORDER BY p.is_featured DESC,p.created_at DESC LIMIT 48",[u.condominium_id])
    ]);
    return out({categories:categories.rows,shops:shops.rows,products:products.rows});
  }
  if(path==='shops/mine/reviews'&&method==='GET'){
    const shop=await shopOwned(u,true);
    const result=await query(
      "SELECT rv.id,rv.order_id,o.code AS order_code,rv.rating,rv.description,rv.status,rv.created_at,rv.moderated_at "+
      "FROM shop_reviews rv JOIN orders o ON o.id=rv.order_id AND o.condominium_id=rv.condominium_id "+
      "WHERE rv.condominium_id=$1 AND rv.shop_id=$2 ORDER BY CASE WHEN rv.status='pending' THEN 0 ELSE 1 END,rv.created_at DESC LIMIT 100",
      [u.condominium_id,shop.id]
    );
    return out({reviews:result.rows,pending:result.rows.filter(r=>r.status==='pending').length});
  }
  if(parts[0]==='shops'&&parts[1]==='mine'&&parts[2]==='reviews'&&parts[3]&&method==='PATCH'){
    if(!uuid(parts[3]))bad('Avaliação inválida.');
    const shop=await shopOwned(u,true);
    const b=z.object({status:z.enum(['approved','rejected'])}).parse(await body(req));
    const updated=await query(
      "UPDATE shop_reviews SET status=$1,moderated_by=$2,moderated_at=now() "+
      "WHERE id=$3 AND condominium_id=$4 AND shop_id=$5 AND status='pending' RETURNING id,status",
      [b.status,u.id,parts[3],u.condominium_id,shop.id]
    );
    if(!updated.rowCount)bad('Avaliação não encontrada ou já moderada.',409);
    return out({review:updated.rows[0]});
  }
  if(parts[0]==='orders'&&parts[1]&&parts[2]==='review'&&method==='POST'){
    if(!uuid(parts[1]))bad('Pedido inválido.');
    const b=z.object({
      rating:z.number().int().min(1).max(5),
      description:z.string().trim().min(1).max(200)
    }).parse(await body(req));
    // Check why a review is ineligible before attempting the INSERT, so a
    // buyer never sees a generic message for their own completed test order.
    const match=await query(
      "SELECT o.buyer_id,o.status,s.owner_id,s.status AS shop_status FROM orders o "+
      "JOIN shops s ON s.id=o.shop_id AND s.condominium_id=o.condominium_id "+
      "WHERE o.id=$1 AND o.condominium_id=$2",
      [parts[1],u.condominium_id]
    );
    const order=match.rows[0];
    if(!order||order.buyer_id!==u.id)bad('Somente o comprador deste pedido pode avaliar.',403);
    if(order.status!=='completed')bad('Este pedido ainda não foi concluído.',403);
    if(order.owner_id===u.id)bad('Você não pode avaliar uma compra na sua própria loja.',403);
    if(order.shop_status!=='approved')bad('A loja não está disponível para avaliações.',403);
    const inserted=await query(
      "INSERT INTO shop_reviews(condominium_id,shop_id,order_id,buyer_id,rating,description) "+
      "SELECT o.condominium_id,o.shop_id,o.id,o.buyer_id,$3,$4 FROM orders o "+
      "JOIN shops s ON s.id=o.shop_id AND s.condominium_id=o.condominium_id "+
      "WHERE o.id=$1 AND o.condominium_id=$5 AND o.buyer_id=$2 AND o.status='completed' "+
      "AND s.owner_id<>$2 AND s.status='approved' "+
      "ON CONFLICT (order_id) DO NOTHING RETURNING id,status",
      [parts[1],u.id,b.rating,b.description,u.condominium_id]
    );
    if(!inserted.rowCount){
      const duplicate=await query('SELECT id FROM shop_reviews WHERE order_id=$1 AND condominium_id=$2 AND buyer_id=$3',
        [parts[1],u.condominium_id,u.id]);
      if(duplicate.rowCount)bad('Este pedido já foi avaliado.',409);
      bad('Somente o comprador de um pedido concluído pode avaliar.',403);
    }
    return out({review:inserted.rows[0]},201);
  }
  if(parts[0]==='shops'&&parts[1]&&parts[2]==='reviews'&&method==='GET'){
    if(!uuid(parts[1]))bad('Loja inválida.');
    const shop=await query(
      "SELECT id FROM shops WHERE id=$1 AND condominium_id=$2 AND status='approved'",
      [parts[1],u.condominium_id]
    );
    if(!shop.rowCount)bad('Loja não encontrada.',404);
    const [totals,list]=await Promise.all([
      query(
        "SELECT count(*)::int AS count,round(avg(rating)::numeric,1)::float AS average FROM shop_reviews "+
        "WHERE condominium_id=$1 AND shop_id=$2 AND status='approved'",
        [u.condominium_id,parts[1]]
      ),
      query(
        "SELECT id,rating,description,created_at FROM shop_reviews "+
        "WHERE condominium_id=$1 AND shop_id=$2 AND status='approved' ORDER BY created_at DESC LIMIT 30",
        [u.condominium_id,parts[1]]
      )
    ]);
    return out({summary:{
      average:totals.rows[0].average??null,count:totals.rows[0].count
    },reviews:list.rows});
  }
  if(path==='shops/mine/status'&&method==='PATCH'){
    const input=z.object({is_open:z.boolean()}).parse(await body(req));
    const shop=await shopOwned(u,true);
    const updated=await query(
      "UPDATE shops SET is_open=$1 WHERE id=$2 AND owner_id=$3 AND condominium_id=$4 AND status='approved' RETURNING *",
      [input.is_open,shop.id,u.id,u.condominium_id]
    );
    if(!updated.rowCount)bad('Loja indisponível para alteração.',403);
    return out({shop:updated.rows[0]});
  }
  if(path==='shops/mine'){
    if(method==='GET'){
      const r=await query("SELECT * FROM shops WHERE condominium_id=$1 AND owner_id=$2 AND status<>'deleted'",[u.condominium_id,u.id]);
      const shop=r.rows[0]??null;
      const products=shop?(await query('SELECT * FROM products WHERE condominium_id=$1 AND shop_id=$2 AND deleted_at IS NULL ORDER BY created_at DESC',[u.condominium_id,shop.id])).rows:[];
      return out({shop,products});
    }
    if(method==='DELETE'){
      const input=z.object({confirmation:z.literal('EXCLUIR LOJA')}).parse(await body(req));
      if(input.confirmation!=='EXCLUIR LOJA')bad('Confirmação inválida.');
      const cleanupId=await transaction(async tx=>{
        const found=await tx.query(
          "SELECT id FROM shops WHERE condominium_id=$1 AND owner_id=$2 AND status<>'deleted' FOR UPDATE",
          [u.condominium_id,u.id]
        );
        if(!found.rowCount)bad('Loja não encontrada.',404);
        const shopId=found.rows[0].id;
        const ongoing=await tx.query(
          "SELECT count(*)::int AS count FROM orders WHERE shop_id=$1 AND status IN ('awaiting_confirmation','confirmed')",
          [shopId]
        );
        if(ongoing.rows[0].count>0)
          bad('Finalize ou cancele os pedidos aguardando ou confirmados antes de excluir sua loja.',409);
        const media=await tx.query('SELECT storage_key FROM media_assets WHERE shop_id=$1',[shopId]);
        const keys=[...new Set(media.rows.map(row=>row.storage_key).filter(
          (value):value is string=>typeof value==='string'&&value.length>0
        ))];
        await tx.query('DELETE FROM media_assets WHERE shop_id=$1',[shopId]);
        await tx.query(
          "DELETE FROM favorites WHERE product_id IN (SELECT id FROM products WHERE shop_id=$1)",[shopId]
        );
        await tx.query('DELETE FROM shop_reviews WHERE shop_id=$1',[shopId]);
        await tx.query(
          "DELETE FROM content_reports WHERE (target_type='shop' AND target_id=$1) OR "+
          "(target_type='product' AND target_id IN (SELECT id FROM products WHERE shop_id=$1))",
          [shopId]
        );
        await tx.query(
          "UPDATE products SET name='Produto indisponível',description='',image_url=NULL,"+
          "option_groups='[]'::jsonb,visibility='hidden',is_available=false WHERE shop_id=$1",
          [shopId]
        );
        await tx.query(
          "UPDATE shops SET status='deleted',is_open=false,name='Loja encerrada',description='',"+
          "whatsapp='',logo_image=NULL,cover_image=NULL,pickup_instructions='',lead_time='' WHERE id=$1",
          [shopId]
        );
        const job=await tx.query(
          'INSERT INTO shop_deletion_jobs(shop_id,storage_keys) VALUES($1,$2::jsonb) RETURNING id',
          [shopId,JSON.stringify(keys)]
        );
        return job.rows[0].id as string;
      });
      const cleanup=await processShopDeletionJob(cleanupId);
      return out({ok:true,status:cleanup,message:cleanup==='completed'?
        'Loja excluída. Seus pedidos anteriores permanecem no histórico.':
        'Loja removida. A limpeza dos arquivos de imagem está pendente.'},cleanup==='completed'?200:202);
    }
    if(method==='POST'){
      const b=z.object({name:z.string().trim().min(3).max(75),description:z.string().max(500).optional(),whatsapp:z.string().min(10).max(20),accept_guidelines:z.literal(true)}).parse(await body(req));
      if(violatesCommunityLanguage(b.name,b.description))bad('Revise o texto: linguagem imprópria não é permitida.');
      normalizeWhatsApp(b.whatsapp);
      const existing=await query("SELECT id FROM shops WHERE owner_id=$1 AND status<>'deleted'",[u.id]);
      if(existing.rowCount)bad('Você já possui uma loja.',409);
      const base=slugifyShopName(b.name);
       let created=null;
       for(let attempt=0;attempt<7;attempt++){
         const slug=attempt===0?base:base.slice(0,60)+'-'+randomBytes(4).toString('hex');
         const result=await query(
           "INSERT INTO shops(condominium_id,owner_id,name,description,whatsapp,status,slug) "+
           "VALUES($1,$2,$3,$4,$5,'approved',$6) ON CONFLICT (slug) DO NOTHING RETURNING *",
           [u.condominium_id,u.id,b.name,b.description??'',b.whatsapp,slug]
         );
         if(result.rowCount){created=result.rows[0];break;}
       }
       if(!created)bad('Não foi possível criar um endereço exclusivo para a loja. Tente novamente.',409);
       return out({shop:created},201);
    }
    if(method==='PATCH'){
      const shop=await shopOwned(u);
      const b=z.object({name:z.string().trim().min(3).max(75),description:z.string().max(500),
        whatsapp:z.string().min(10).max(20),logo_image:z.string().nullable().optional(),is_open:z.boolean(),delivery_enabled:z.boolean(),
        pickup_enabled:z.boolean(),delivery_fee_cents:z.number().int().min(0).max(1_000_000).default(0),lead_time:z.string().max(100),pickup_instructions:z.string().max(250),
        cover_image:z.string().nullable().optional(),payment_methods:paymentMethodsSchema}).parse(await body(req));
      normalizeWhatsApp(b.whatsapp);
      if(violatesCommunityLanguage(b.name,b.description,b.pickup_instructions))bad('Revise o texto: linguagem imprópria não é permitida.');
      if(!b.delivery_enabled&&!b.pickup_enabled)bad('Habilite entrega ou retirada.');
      const r=await query(
        'UPDATE shops SET name=$1,description=$2,whatsapp=$3,is_open=$4,delivery_enabled=$5,pickup_enabled=$6,lead_time=$7,pickup_instructions=$8,cover_image=$9,logo_image=$12,delivery_fee_cents=$13,payment_methods=$14::text[] WHERE id=$10 AND condominium_id=$11 RETURNING *',
        [b.name,b.description,b.whatsapp,b.is_open,b.delivery_enabled,b.pickup_enabled,b.lead_time,b.pickup_instructions,imagePath(b.cover_image),shop.id,u.condominium_id,imagePath(b.logo_image),b.delivery_fee_cents,b.payment_methods]);
      return out({shop:r.rows[0]});
    }
  }
  if(parts[0]==='shops'&&parts[1]&&parts[1]!=='mine'&&method==='GET'){
    if(!uuid(parts[1])&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[1]))bad('Loja inválida.');
    const s=await query("SELECT id,name,slug,description,cover_image,logo_image,is_open,delivery_enabled,pickup_enabled,delivery_fee_cents,payment_methods,lead_time,pickup_instructions FROM shops WHERE (id::text=$1 OR slug=$1) AND condominium_id=$2 AND status='approved'",[parts[1],u.condominium_id]);
    if(!s.rowCount)bad('Loja não encontrada.',404);
    const p=await query("SELECT id,shop_id,category_id,name,description,price_cents,promo_price_cents,image_url,stock,visibility,lead_time,option_groups FROM products p WHERE shop_id=$1 AND condominium_id=$2 AND visibility<>'hidden' AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM categories c WHERE c.id=p.category_id AND c.condominium_id=p.condominium_id AND c.is_active=true) ORDER BY created_at DESC",[s.rows[0].id,u.condominium_id]);
    return out({shop:s.rows[0],products:p.rows});
  }
  if((path==='media'||path==='media/profile'||path==='media/ad'||path==='media/giveaway')&&method==='POST'){
    const personal=path==='media/profile';
    const adImage=path==='media/ad',giveawayImage=path==='media/giveaway';
    if(adImage&&!u.is_superadmin)bad('Acesso restrito ao superadmin.',403);
    if(giveawayImage){
      approved(u);
      const active=await query("SELECT 1 FROM categories WHERE condominium_id=$1 AND name='Desapego' AND is_active=true",[u.condominium_id]);
      if(!active.rowCount)bad('Desapego desabilitado.',403);
    }
    const shop=personal||adImage||giveawayImage?null:await shopOwned(u);
    const form=await req.formData();
    let mediaCondoId=u.condominium_id;
    if(adImage){
      const requested=form.get('condominium_id');
      if(typeof requested!=='string')bad('Selecione o condomínio antes de enviar a imagem.');
      const condominiumId=requested as string;
      if(!uuid(condominiumId))bad('Selecione um condomínio válido.');
      const selected=await query('SELECT id FROM condominiums WHERE id=$1 AND is_active=true',[condominiumId]);
      if(!selected.rowCount)bad('Condomínio inválido.');
      mediaCondoId=condominiumId;
    }
    const input=form.get('file');
    if(!(input instanceof File))throw new ApiError(400,'Selecione uma imagem.');
    const file:File=input;
    if(!IMAGE_MIME_TYPES.some(type=>type===file.type))bad('Imagem deve ser JPG, PNG ou WebP.');
    if((giveawayImage&&file.size>5*1024*1024)||(!giveawayImage&&!imageSizeIsAllowed(file.size)))bad(giveawayImage?'A imagem deve ter no máximo 5 MB.':'A imagem deve ter no máximo 10 MB.');
    const buffer=Buffer.from(await file.arrayBuffer());
    const jpg=buffer[0]===255&&buffer[1]===216&&buffer[2]===255;
    const png=buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const webp=buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP';
    if(!(file.type==='image/jpeg'&&jpg||file.type==='image/png'&&png||file.type==='image/webp'&&webp))bad('O arquivo não corresponde ao formato declarado.');
    if(!storageConfigured())bad('Armazenamento de imagens não configurado.',503);
    // Strip EXIF location/metadata, limit pixels, and deliver optimized WebP.
    let optimized:Buffer;
    try{
      optimized=await sharp(buffer,{failOn:'error',limitInputPixels:20_000_000})
        .rotate().resize(960,960,{fit:'inside',withoutEnlargement:true})
        .webp({quality:78,effort:4}).toBuffer();
    }catch{bad('Imagem inválida ou com resolução excessiva.');}
    // Only server uses the private Storage service credential.
    const objectKey=mediaCondoId+'/'+(adImage?'ads':giveawayImage?'giveaways/'+u.id:personal?'profile/'+u.id:shop!.id)+'/'+crypto.randomUUID()+'.webp';
    const {error:uploadError}=await storageAdmin().storage.from(STORAGE_BUCKET).upload(
      objectKey,optimized!,{contentType:'image/webp',upsert:false,cacheControl:'86400'}
    );
    if(uploadError)bad('Não foi possível enviar a foto.',502);
    try{
      const r=await query(
        'INSERT INTO media_assets(condominium_id,shop_id,user_id,mime,storage_key) VALUES($1,$2,$3,$4,$5) RETURNING id',
        [mediaCondoId,shop?.id??null,personal?u.id:null,'image/webp',objectKey]
      );
      return out({url:'/api/media/'+r.rows[0].id},201);
    }catch(e){await storageAdmin().storage.from(STORAGE_BUCKET).remove([objectKey]);throw e;}
  }
  if(parts[0]==='media'&&parts[1]&&method==='GET'){
    if(!uuid(parts[1]))bad('Arquivo inválido.');
    const r=await query('SELECT mime,bytes,storage_key,user_id FROM media_assets WHERE condominium_id=$1 AND id=$2',[u.condominium_id,parts[1]]);
    if(!r.rowCount)bad('Imagem não encontrada.',404);
    if(r.rows[0].user_id&&r.rows[0].user_id!==u.id)bad('Foto pessoal indisponível.',403);
    let bytes:Uint8Array;
    if(r.rows[0].storage_key){
      const {data,error:downloadError}=await storageAdmin().storage.from(STORAGE_BUCKET).download(r.rows[0].storage_key);
      if(downloadError||!data)bad('Imagem indisponível.',502);
      bytes=new Uint8Array(await data!.arrayBuffer());
    }else if(r.rows[0].bytes){
      bytes=new Uint8Array(r.rows[0].bytes);
    }else return bad('Imagem indisponível.',404);
    return new NextResponse(new Blob([Buffer.from(bytes)]),{headers:{
      'Content-Type':r.rows[0].mime,'Cache-Control':'private,max-age=3600',
      'X-Content-Type-Options':'nosniff','Vary':'Cookie'
    }});
  }
  if(path==='products'&&method==='POST'){
    const shop=await shopOwned(u,true);
    const b=z.object({name:z.string().trim().min(2).max(100),description:z.string().max(600).optional(),
      category_id:z.string().uuid(),price_cents:z.number().int().min(1).max(10_000_000),
      promo_price_cents:z.number().int().min(1).max(10_000_000).nullable().optional(),
      stock:z.number().int().min(0).max(100000).nullable().optional(),image_url:z.string().nullable().optional(),
      visibility:z.enum(['available','unavailable','hidden']).optional(),
      is_available:z.boolean().optional(),lead_time:z.string().max(100).optional(),option_groups:optionGroupsSchema.default([])}).parse(await body(req));
    if(violatesCommunityLanguage(b.name,b.description))bad('Revise o texto do produto: linguagem imprópria não é permitida.');
    if(violatesCommunityLanguage(...b.option_groups.flatMap(g=>[g.name,...g.options.map(o=>o.name)])))
      bad('Revise as opções de personalização: linguagem imprópria não é permitida.');
    if(b.promo_price_cents!=null&&b.promo_price_cents>=b.price_cents)bad('O preço promocional deve ser menor que o original.');
    const category=await query('SELECT id FROM categories WHERE id=$1 AND condominium_id=$2 AND is_active=true',[b.category_id,u.condominium_id]);
    if(!category.rowCount)bad('Categoria inválida.');
    const r=await query(
      'INSERT INTO products(condominium_id,shop_id,category_id,name,description,price_cents,promo_price_cents,stock,image_url,is_available,visibility,lead_time,option_groups) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) RETURNING *',
      [u.condominium_id,shop.id,b.category_id,b.name,b.description??'',b.price_cents,b.promo_price_cents??null,b.stock??null,imagePath(b.image_url),
        (b.visibility??(b.is_available===false?'hidden':'available'))==='available',
        b.visibility??(b.is_available===false?'hidden':'available'),b.lead_time??'',JSON.stringify(b.option_groups)]
    );
    return out({product:r.rows[0]},201);
  }
  if(parts[0]==='products'&&parts[1]&&parts[2]==='visibility'&&method==='PATCH'){
    if(!uuid(parts[1]))bad('Produto inválido.');
    const shop=await shopOwned(u,true);
    const b=z.object({visibility:z.enum(['available','unavailable','hidden'])}).parse(await body(req));
    const updated=await query(
      'UPDATE products SET visibility=$1,is_available=($1=\'available\') WHERE id=$2 AND condominium_id=$3 AND shop_id=$4 AND moderation_blocked=false AND deleted_at IS NULL RETURNING *',
      [b.visibility,parts[1],u.condominium_id,shop.id]
    );
    if(!updated.rowCount){
      const exists=await query('SELECT moderation_blocked FROM products WHERE id=$1 AND condominium_id=$2 AND shop_id=$3 AND deleted_at IS NULL',
        [parts[1],u.condominium_id,shop.id]);
      if(exists.rows[0]?.moderation_blocked)bad('Este produto foi bloqueado pela administração.',403);
      bad('Produto não encontrado.',404);
    }
    return out({product:updated.rows[0]});
  }
  if(parts[0]==='products'&&parts[1]&&['PATCH','DELETE'].includes(method)){
    if(!uuid(parts[1]))bad('Produto inválido.');
    const shop=await shopOwned(u,true);
    const owned=await query('SELECT id,moderation_blocked FROM products WHERE id=$1 AND shop_id=$2 AND condominium_id=$3 AND deleted_at IS NULL',[parts[1],shop.id,u.condominium_id]);
    if(!owned.rowCount)bad('Produto não encontrado.',404);
    if(method==='DELETE'){
      z.object({confirmation:z.literal('EXCLUIR PRODUTO')}).parse(await body(req));
      await transaction(async tx=>{
        const removed=await tx.query("UPDATE products SET is_available=false,visibility='hidden',deleted_at=now() WHERE id=$1 AND shop_id=$2 AND condominium_id=$3 AND deleted_at IS NULL RETURNING id",
          [parts[1],shop.id,u.condominium_id]);
        if(!removed.rowCount)bad('Produto não encontrado.',404);
        await tx.query("DELETE FROM favorites WHERE product_id=$1 AND condominium_id=$2",[parts[1],u.condominium_id]);
        await tx.query("DELETE FROM content_reports WHERE target_type='product' AND target_id=$1 AND condominium_id=$2 AND status='open'",
          [parts[1],u.condominium_id]);
      });
      return out({ok:true});
    }
    if(owned.rows[0].moderation_blocked)bad('Este produto está bloqueado pela administração.',403);
    const b=z.object({name:z.string().trim().min(2).max(100),description:z.string().max(600),
      category_id:z.string().uuid(),price_cents:z.number().int().min(1).max(10_000_000),
      promo_price_cents:z.number().int().min(1).max(10_000_000).nullable(),
      stock:z.number().int().min(0).max(100000).nullable(),image_url:z.string().nullable(),
      visibility:z.enum(['available','unavailable','hidden']).optional(),
      is_available:z.boolean().optional(),lead_time:z.string().max(100),option_groups:optionGroupsSchema.default([])}).parse(await body(req));
    if(violatesCommunityLanguage(b.name,b.description))bad('Revise o texto do produto: linguagem imprópria não é permitida.');
    if(violatesCommunityLanguage(...b.option_groups.flatMap(g=>[g.name,...g.options.map(o=>o.name)])))
      bad('Revise as opções de personalização: linguagem imprópria não é permitida.');
    if(b.promo_price_cents!=null&&b.promo_price_cents>=b.price_cents)bad('Preço promocional inválido.');
    const cat=await query('SELECT id FROM categories WHERE id=$1 AND condominium_id=$2 AND is_active=true',[b.category_id,u.condominium_id]);
    if(!cat.rowCount)bad('Categoria inválida.');
    const r=await query(
      'UPDATE products SET name=$1,description=$2,category_id=$3,price_cents=$4,promo_price_cents=$5,stock=$6,image_url=$7,is_available=$8,lead_time=$9,visibility=$13,option_groups=$14::jsonb WHERE id=$10 AND shop_id=$11 AND condominium_id=$12 AND deleted_at IS NULL RETURNING *',
      [b.name,b.description,b.category_id,b.price_cents,b.promo_price_cents,b.stock,imagePath(b.image_url),
        (b.visibility??(b.is_available===false?'hidden':'available'))==='available',b.lead_time,parts[1],shop.id,u.condominium_id,
        b.visibility??(b.is_available===false?'hidden':'available'),JSON.stringify(b.option_groups)]
    );
    return out({product:r.rows[0]});
  }
  if(parts[0]==='orders'&&parts[1]&&parts[2]==='whatsapp'&&method==='GET'){
    if(!uuid(parts[1]))bad('Pedido inválido.');
    const found=await query(
      "SELECT o.*,s.name AS shop_name,s.whatsapp FROM orders o JOIN shops s ON s.id=o.shop_id "+
      "WHERE o.id=$1 AND o.buyer_id=$2 AND o.condominium_id=$3 AND o.status IN ('awaiting_confirmation','confirmed')",
      [parts[1],u.id,u.condominium_id]
    );
    if(!found.rowCount)bad('Pedido não encontrado ou já encerrado.',404);
    return out({whatsapp_url:await savedWhatsApp(found.rows[0] as SavedOrder,u)});
  }
  if(path==='orders/quote'||(path==='orders'&&method==='POST')){
    if(path==='orders/quote'&&method!=='POST')bad('Rota não encontrada.',404);
    const b=orderSchema.parse(await body(req));
    // Keep repeat product IDs: same cake can have a different note/selection in each line.
    if(path==='orders'&&b.client_order_key){
      const old=await query(
        "SELECT o.*,s.name AS shop_name,s.whatsapp FROM orders o JOIN shops s ON s.id=o.shop_id "+
        "WHERE o.condominium_id=$1 AND o.buyer_id=$2 AND o.client_order_key=$3",
        [u.condominium_id,u.id,b.client_order_key]
      );
      if(old.rowCount)return out({order:old.rows[0],whatsapp_url:await savedWhatsApp(old.rows[0] as SavedOrder,u)});
    }
    const result=await transaction(async tx=>{
      const sr=await tx.query(
        "SELECT * FROM shops WHERE id=$1 AND condominium_id=$2 AND status='approved' FOR UPDATE",
        [b.shop_id,u.condominium_id]
      );
      const shop=sr.rows[0];
      if(b.client_order_key&&shop&&path==='orders'){
        const previous=await tx.query(
          "SELECT o.*,s.name AS shop_name,s.whatsapp FROM orders o JOIN shops s ON s.id=o.shop_id "+
          "WHERE o.condominium_id=$1 AND o.buyer_id=$2 AND o.client_order_key=$3",
          [u.condominium_id,u.id,b.client_order_key]
        );
        if(previous.rowCount)return {order:previous.rows[0],whatsapp_url:await savedWhatsApp(previous.rows[0] as SavedOrder,u)};
      }
      if(!shop||!shop.is_open)bad('Loja não está recebendo pedidos.');
       if(!Array.isArray(shop.payment_methods)||!shop.payment_methods.includes(b.payment_method))bad('Este meio de pagamento não é aceito pela loja.',409);
      if((b.fulfillment==='delivery'&&!shop.delivery_enabled)||
         (b.fulfillment==='pickup'&&!shop.pickup_enabled))bad('Forma de recebimento indisponível.');
      const ids=[...new Set(b.items.map(i=>i.id))];
      const dbItems=await tx.query(
        "SELECT * FROM products WHERE id=ANY($1::uuid[]) AND condominium_id=$2 AND shop_id=$3 "+
        "AND is_available=true AND visibility='available' AND moderation_blocked=false AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM categories c WHERE c.id=products.category_id AND c.condominium_id=products.condominium_id AND c.is_active=true) ORDER BY id FOR UPDATE",
        [ids,u.condominium_id,shop.id]
      );
      if(dbItems.rows.length!==ids.length)bad('Um ou mais produtos estão indisponíveis.');
      const products=new Map(dbItems.rows.map(p=>[p.id,p]));
      const amounts=new Map<string,number>();
      for(const i of b.items)amounts.set(i.id,(amounts.get(i.id)??0)+i.quantity);
      for(const [id,amount] of amounts){
        const product=products.get(id)!;
        if(product.stock!==null&&product.stock<amount)bad('Estoque insuficiente para '+product.name+'.');
      }
      let subtotal=0;
      const items=b.items.map(i=>{
        const product=products.get(i.id)!;
        const groups=optionGroupsSchema.parse(product.option_groups??[]);
        let chosen;
        try{chosen=selectedOptions(groups,i.selections??{});}
        catch(e){bad(e instanceof Error?e.message:'Personalização inválida.');}
        const cents=unitPrice(product)+extrasTotal(chosen!);
        subtotal+=cents*i.quantity;
        return {product_id:product.id,name:product.name,quantity:i.quantity,unit_price_cents:cents,
          options:chosen!,note:i.note??''};
      });
      const fee=b.fulfillment==='delivery'?Number(shop.delivery_fee_cents??0):0;
      const total=subtotal+fee;
      if(!Number.isSafeInteger(total)||total>2_147_483_647)bad('Total do pedido ultrapassa o limite.',400);
      const quote={subtotal_cents:subtotal,delivery_fee_cents:fee,total_cents:total,
        lines:items.map(i=>({name:i.name,quantity:i.quantity,unit_price_cents:i.unit_price_cents,
          total_cents:i.quantity*i.unit_price_cents,options:i.options,note:i.note}))};
      if(path==='orders/quote')return {quote};
      if(b.expected_total_cents!==undefined&&b.expected_total_cents!==total)
        bad('O valor foi atualizado. Confira o novo total antes de finalizar.',409);
      const created=await tx.query(
        "INSERT INTO orders(condominium_id,buyer_id,shop_id,fulfillment,delivery_day,delivery_window,"+
        "delivery_instructions,note,total_cents,client_order_key,subtotal_cents,delivery_fee_cents,payment_method) "+
        "VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13) RETURNING *",
        [u.condominium_id,u.id,shop.id,b.fulfillment,b.delivery_day??null,b.delivery_window??'',
          JSON.stringify(b.instructions??[]),b.note??'',total,b.client_order_key??null,subtotal,fee,b.payment_method]
      );
      for(const item of items){
        await tx.query(
          'INSERT INTO order_items(order_id,product_id,name_snapshot,quantity,unit_price_cents,note,options) '+
          'VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',
          [created.rows[0].id,item.product_id,item.name,item.quantity,item.unit_price_cents,item.note,JSON.stringify(item.options)]
        );
      }
      const message=orderMessage({code:created.rows[0].code,shop:shop.name,buyer:u.name,tower:u.tower,
        apartment:u.apartment,items:items.map(i=>({name:i.name,quantity:i.quantity,unit_price_cents:i.unit_price_cents,
          note:i.note,options:i.options})),total_cents:total,subtotal_cents:subtotal,delivery_fee_cents:fee,
        fulfillment:b.fulfillment,delivery_day:b.delivery_day,delivery_window:b.delivery_window,
        instructions:b.instructions,note:b.note,payment_method:b.payment_method});
      return {order:created.rows[0],
        whatsapp_url:'https://wa.me/'+normalizeWhatsApp(shop.whatsapp)+'?text='+encodeURIComponent(message)};
    });
    return out(result,path==='orders'?201:200);
  }
  if(path==='orders'&&method==='GET'){
    const scope=req.nextUrl.searchParams.get('scope');
    const seller=scope==='seller';
    const status=req.nextUrl.searchParams.get('status');
    const statuses=['awaiting_confirmation','confirmed','completed','cancelled'];
    if(status!==null&&!statuses.includes(status))bad('Filtro de pedido inválido.');
    let shopId:string|undefined;
    if(seller){const sh=await shopOwned(u);shopId=sh.id;}
    const r=await query(
      "SELECT o.*,(SELECT rv.status FROM shop_reviews rv WHERE rv.order_id=o.id AND rv.condominium_id=o.condominium_id) AS review_status,"+
      " (s.owner_id=o.buyer_id) AS is_own_shop,"+
      " (o.status='completed' AND o.buyer_id<>s.owner_id AND s.status='approved' AND NOT EXISTS (SELECT 1 FROM shop_reviews r WHERE r.order_id=o.id AND r.condominium_id=o.condominium_id)) AS can_review,"+
      " s.name AS shop_name,bu.name AS buyer_name,bu.tower,bu.apartment,bu.phone AS buyer_phone,COALESCE(json_agg(json_build_object('name',i.name_snapshot,'quantity',i.quantity,'unit_price_cents',i.unit_price_cents,'note',i.note,'options',i.options)) FILTER (WHERE i.id IS NOT NULL),'[]'::json) AS items FROM orders o JOIN shops s ON s.id=o.shop_id JOIN users bu ON bu.id=o.buyer_id LEFT JOIN order_items i ON i.order_id=o.id WHERE o.condominium_id=$1 AND "+(seller?'o.shop_id=$2':'o.buyer_id=$2')+(status?' AND o.status=$3':'')+" GROUP BY o.id,s.id,s.name,bu.id ORDER BY o.created_at DESC LIMIT 100",
      [...[u.condominium_id,seller?shopId:u.id],...(status?[status]:[])]
    );
    // Buyers do not need to see delivery address of someone else; shop owner sees only data for their own orders.
    return out({orders:r.rows});
  }
  if(parts[0]==='orders'&&parts[1]&&method==='PATCH'){
    if(!uuid(parts[1]))bad('Pedido inválido.');
    const b=z.object({status:z.enum(['confirmed','completed','cancelled'])}).parse(await body(req));
    const sh=await shopOwned(u,true);
    const updated=await transaction(async tx=>{
      const r=await tx.query('SELECT * FROM orders WHERE id=$1 AND condominium_id=$2 AND shop_id=$3 FOR UPDATE',[parts[1],u.condominium_id,sh.id]);
      if(!r.rowCount)bad('Pedido não encontrado.',404);
      const order=r.rows[0];
      const valid=(order.status==='awaiting_confirmation'&&['confirmed','cancelled'].includes(b.status))||(order.status==='confirmed'&&['completed','cancelled'].includes(b.status));
      if(!valid)bad('Transição de status não permitida.');
      const items=await tx.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY product_id',[order.id]);
      if(b.status==='confirmed'){
        for(const item of items.rows){
          const p=await tx.query(
            'UPDATE products SET stock=CASE WHEN stock IS NULL THEN NULL ELSE stock-$1 END WHERE id=$2 AND condominium_id=$3 AND (stock IS NULL OR stock >= $1) RETURNING id',
            [item.quantity,item.product_id,u.condominium_id]
          );
          if(!p.rowCount)bad('Estoque insuficiente para confirmar o pedido.');
        }
      } else if(b.status==='cancelled'&&order.status==='confirmed'){
        for(const item of items.rows)await tx.query('UPDATE products SET stock=CASE WHEN stock IS NULL THEN NULL ELSE stock+$1 END WHERE id=$2 AND condominium_id=$3',[item.quantity,item.product_id,u.condominium_id]);
      }
      const next=await tx.query('UPDATE orders SET status=$1,updated_at=now() WHERE id=$2 RETURNING *',[b.status,order.id]);
      return next.rows[0];
    });
    return out({order:updated});
  }
  if(path==='admin/summary'&&method==='GET'){
    admin(u);
    const [residents,shops,stats,categories]=await Promise.all([
      query('SELECT id,name,email,phone,tower,apartment,status,created_at FROM users WHERE condominium_id=$1 AND role=\'resident\' ORDER BY CASE WHEN status=\'pending\' THEN 0 ELSE 1 END,created_at DESC LIMIT 200',[u.condominium_id]),
      query('SELECT s.id,s.name,s.description,s.status,s.is_open,u.name AS owner_name FROM shops s JOIN users u ON u.id=s.owner_id WHERE s.condominium_id=$1 ORDER BY CASE WHEN s.status=\'pending\' THEN 0 ELSE 1 END,s.created_at DESC LIMIT 200',[u.condominium_id]),
      query("SELECT (SELECT count(*)::int FROM users WHERE condominium_id=$1 AND status='approved') AS residents, (SELECT count(*)::int FROM shops WHERE condominium_id=$1 AND status='approved') AS shops,(SELECT count(*)::int FROM orders WHERE condominium_id=$1) AS orders",[u.condominium_id]),
      query('SELECT id,name,icon,is_active FROM categories WHERE condominium_id=$1 ORDER BY sort_order,name',[u.condominium_id])
    ]);
    return out({residents:residents.rows,shops:shops.rows,stats:stats.rows[0],categories:categories.rows,towers:u.towers});
  }
  if(path==='reports'&&method==='POST'){
    const b=z.object({
      target_type:z.enum(['shop','product']),target_id:z.string().uuid(),
      reason:z.enum(['language','image','inappropriate','other']),
      details:z.string().trim().max(250).default('')
    }).parse(await body(req));
    const target=b.target_type==='shop'
      ?await query("SELECT id,owner_id FROM shops WHERE id=$1 AND condominium_id=$2 AND status='approved'",
        [b.target_id,u.condominium_id])
      :await query("SELECT p.id,s.owner_id FROM products p JOIN shops s ON s.id=p.shop_id AND s.condominium_id=p.condominium_id "+
        "WHERE p.id=$1 AND p.condominium_id=$2 AND p.visibility<>'hidden' AND p.deleted_at IS NULL AND s.status='approved'",
        [b.target_id,u.condominium_id]);
    if(!target.rowCount)bad('Conteúdo não encontrado.',404);
    if(target.rows[0].owner_id===u.id)bad('Não é possível denunciar sua própria loja.',400);
    const count=await query("SELECT count(*)::int AS total FROM content_reports "+
      "WHERE reporter_id=$1 AND created_at>now()-interval '24 hours'",[u.id]);
    if(count.rows[0].total>=10)bad('Limite de denúncias atingido hoje.',429);
    const saved=await query(
      "INSERT INTO content_reports(condominium_id,reporter_id,target_type,target_id,reason,details) "+
      "VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(condominium_id,reporter_id,target_type,target_id) DO NOTHING RETURNING id",
      [u.condominium_id,u.id,b.target_type,b.target_id,b.reason,b.details]
    );
    if(!saved.rowCount)bad('Você já denunciou este conteúdo.',409);
    return out({message:'Denúncia recebida. A administração irá analisar.'},201);
  }
  if(path==='admin/reports'&&method==='GET'){
    admin(u);
    const items=await query(
      "SELECT r.id,r.target_type,r.target_id,r.reason,r.details,r.status,r.created_at, "+
      "COALESCE(s.name,p.name) AS target_name,COALESCE(p.moderation_blocked,false) AS product_blocked FROM content_reports r "+
      "LEFT JOIN shops s ON r.target_type='shop' AND s.id=r.target_id AND s.condominium_id=r.condominium_id "+
      "LEFT JOIN products p ON r.target_type='product' AND p.id=r.target_id AND p.condominium_id=r.condominium_id "+
      "WHERE r.condominium_id=$1 ORDER BY CASE WHEN r.status='open' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 150",
      [u.condominium_id]
    );
    return out({reports:items.rows});
  }
  if(parts[0]==='admin'&&parts[1]==='products'&&parts[2]&&parts[3]==='unblock'&&method==='PATCH'){
    admin(u);
    if(!uuid(parts[2]))bad('Produto inválido.');
    const updated=await query(
      "UPDATE products SET moderation_blocked=false WHERE id=$1 AND condominium_id=$2 AND moderation_blocked=true AND deleted_at IS NULL RETURNING id",
      [parts[2],u.condominium_id]
    );
    if(!updated.rowCount)bad('Produto não encontrado ou não está bloqueado.',404);
    // Leave visibility hidden; the owner can republish after revising content.
    return out({ok:true});
  }
  if(parts[0]==='admin'&&parts[1]==='reports'&&parts[2]&&method==='PATCH'){
    admin(u);
    if(!uuid(parts[2]))bad('Denúncia inválida.');
    const b=z.object({action:z.enum(['dismiss','hide_product','suspend_shop'])}).parse(await body(req));
    await transaction(async tx=>{
      const found=await tx.query(
        "SELECT * FROM content_reports WHERE id=$1 AND condominium_id=$2 AND status='open' FOR UPDATE",
        [parts[2],u.condominium_id]
      );
      if(!found.rowCount)bad('Denúncia não encontrada ou já analisada.',404);
      const r=found.rows[0];
      if(b.action==='hide_product'){
        if(r.target_type!=='product')bad('Esta denúncia não é de um produto.');
        await tx.query(
          "UPDATE products SET visibility='hidden',is_available=false,moderation_blocked=true WHERE id=$1 AND condominium_id=$2 AND deleted_at IS NULL",
          [r.target_id,u.condominium_id]
        );
      }
      if(b.action==='suspend_shop'){
        let shopId=r.target_id;
        if(r.target_type==='product'){
          const q=await tx.query('SELECT shop_id FROM products WHERE id=$1 AND condominium_id=$2',
            [r.target_id,u.condominium_id]);
          if(!q.rowCount)bad('Produto não encontrado.',404);
          shopId=q.rows[0].shop_id;
        }
        await tx.query("UPDATE shops SET status='suspended',is_open=false WHERE id=$1 AND condominium_id=$2",
          [shopId,u.condominium_id]
        );
      }
      await tx.query(
        "UPDATE content_reports SET status='resolved',resolved_by=$1,resolved_at=now() WHERE id=$2",
        [u.id,r.id]
      );
    });
    return out({ok:true});
  }
  if(parts[0]==='admin'&&parts[1]==='users'&&parts[2]&&method==='PATCH'){
    admin(u);if(!uuid(parts[2])||parts[2]===u.id)bad('Morador inválido.');
    const b=z.object({status:z.enum(['approved','suspended'])}).parse(await body(req));
    const r=await query("UPDATE users SET status=$1 WHERE id=$2 AND condominium_id=$3 AND role='resident' AND status<>'deleted' RETURNING id",[b.status,parts[2],u.condominium_id]);
    if(!r.rowCount)bad('Morador não encontrado.',404);
    if(b.status==='suspended')await query('DELETE FROM sessions WHERE user_id=$1',[parts[2]]);
    return out({ok:true});
  }
  if(parts[0]==='admin'&&parts[1]==='shops'&&parts[2]&&method==='PATCH'){
    admin(u);if(!uuid(parts[2]))bad('Loja inválida.');
    const b=z.object({status:z.enum(['approved','suspended'])}).parse(await body(req));
    const r=await query("UPDATE shops SET status=$1 WHERE id=$2 AND condominium_id=$3 AND status<>'deleted' RETURNING id",[b.status,parts[2],u.condominium_id]);
    if(!r.rowCount)bad('Loja não encontrada.',404);
    return out({ok:true});
  }
  if(path.startsWith('admin/categories/')&&method==='PATCH'){
    admin(u);
    const id=parts[2];
    if(!uuid(id))bad('Categoria inválida.');
    const b=z.object({is_active:z.boolean()}).parse(await body(req));
    const changed=await query(
      "UPDATE categories SET is_active=$1 WHERE id=$2 AND condominium_id=$3 AND name IN ('Serviços','Moda','Desapego') RETURNING id,name,is_active",
      [b.is_active,id,u.condominium_id]
    );
    if(!changed.rowCount)bad('Somente Serviços e Moda podem ser alternadas neste painel.',404);
    return out({category:changed.rows[0]});
  }
  if(path==='admin/categories'&&method==='POST'){
    admin(u);
    const b=z.object({name:z.string().trim().min(2).max(60),icon:z.enum(['cake-slice','sandwich','utensils','coffee','pizza','ice-cream-cone','shopping-basket'])}).parse(await body(req));
    const normalized=b.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    if(['servicos','desapego','beleza','saude e bem-estar','moda','casa e decoracao','eletronicos','presentes','outros'].includes(normalized))
      bad('Somente categorias de alimentação são permitidas.');
    try{
      const r=await query('INSERT INTO categories(condominium_id,name,icon) VALUES($1,$2,$3) RETURNING *',[u.condominium_id,b.name,b.icon]);
      return out({category:r.rows[0]},201);
    }catch(e:unknown){if((e as {code?:string}).code==='23505')bad('Categoria já existente.',409);throw e;}
  }
  if(path==='admin/towers'&&method==='PATCH'){
    admin(u);
    const input=z.object({scheme:z.enum(['letters','numbers']),count:z.number().int().min(1).max(30)}).parse(await body(req));
    const updated=await transaction(async tx=>{
      const locked=await tx.query('SELECT towers FROM condominiums WHERE id=$1 FOR UPDATE',[u.condominium_id]);
      if(!locked.rowCount)bad('Condomínio não encontrado.',404);
      const old:string[]=locked.rows[0].towers;
      if(!Array.isArray(old)||!old.every(value=>typeof value==='string')||!currentTowerScheme(old))
        bad('Configuração de torres personalizada. Ajuste os endereços existentes antes de alterar.',409);
      const next=towerLabels(input.scheme,input.count);
      const removed=old.slice(input.count);
      if(removed.length){
        const occupied=await tx.query(
          "SELECT COUNT(*)::int AS n FROM users WHERE condominium_id=$1 AND role='resident' AND status<>'deleted' AND tower=ANY($2::text[])",
          [u.condominium_id,removed]
        );
        if(occupied.rows[0].n>0)bad('Existem moradores em torres que seriam removidas. Mantenha a quantidade atual ou maior.',409);
      }
      // Preserve residents' building position when changing from numbers to letters.
      // The configured identifiers are never inferred from apartment numbers.
      for(let i=0;i<Math.min(old.length,next.length);i++){
        if(old[i]!==next[i])await tx.query(
          "UPDATE users SET tower=$1 WHERE condominium_id=$2 AND role='resident' AND status<>'deleted' AND tower=$3",
          [next[i],u.condominium_id,old[i]]
        );
      }
      await tx.query('UPDATE condominiums SET towers=$1::jsonb WHERE id=$2',[JSON.stringify(next),u.condominium_id]);
      return next;
    });
    return out({towers:updated,message:'Identificação das torres atualizada.'});
  }
  if(path==='admin/invite'&&method==='POST'){
    admin(u);
    const input=z.object({code:z.string().trim().min(10).max(40).regex(/^[A-Za-z0-9-]+$/)}).parse(await body(req));
    const code=input.code;
    if(!/[A-Za-z]/.test(code)||!/[0-9]/.test(code))bad('Use letras e números no código (mínimo de 10 caracteres).');
    try{
      await query('UPDATE condominiums SET invite_code_hash=$1 WHERE id=$2',[inviteHash(code),u.condominium_id]);
    }catch(e:unknown){if((e as {code?:string}).code==='23505')bad('Este código já pertence a outro condomínio.',409);throw e;}
    return out({invite:code,message:'Código do condomínio atualizado. Compartilhe apenas com moradores.'});
  }
  return bad('Rota não encontrada.',404);
}
async function endpoint(req:NextRequest,method:Verb) {
  const startedAt=performance.now();
  const parts=req.nextUrl.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);
  let response:NextResponse;
  try {
    response=await processApi({req,method,parts});
  } catch(error) {
    if(error instanceof Error&&error.message==='TENANT_NOT_FOUND')
      response=out({error:'Condomínio não encontrado neste subdomínio.'},404);
    else if(error instanceof ApiError)response=out({error:error.message},error.status);
    else if(error instanceof ZodError)
      response=out({error:'Confira os campos preenchidos.',details:error.issues.map(i=>i.path.join('.'))},400);
    else {
      // Do not put exception messages (which may contain private SQL values) in logs.
      console.error('condovery_api_error',{kind:error instanceof Error?error.name:'UnknownError'});
      response=out({error:'Não foi possível concluir a operação.'},500);
    }
  }
  try {
    logApiRequestMetric({method,parts,status:response.status,durationMs:performance.now()-startedAt});
  } catch {
    // Telemetry must never change the outcome of an API request.
  }
  return response;
}
export const GET=(req:NextRequest)=>endpoint(req,'GET');
export const POST=(req:NextRequest)=>endpoint(req,'POST');
export const PATCH=(req:NextRequest)=>endpoint(req,'PATCH');
export const DELETE=(req:NextRequest)=>endpoint(req,'DELETE');
