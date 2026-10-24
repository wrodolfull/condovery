import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { query, transaction } from '@/lib/db';
import { clearSession, inviteHash, issueSession, sessionViewer, tokenHash, type Viewer } from '@/lib/auth';
import { normalizeWhatsApp, orderMessage, unitPrice } from '@/lib/orders';
import { passwordAuthClient,emailConfigured,recoveryConfigured,googleAuthClient,googleConfigured,storageAdmin,storageConfigured,STORAGE_BUCKET } from '@/lib/supabase';
import { oauthCookie,randomToken,safeAppOrigin } from '@/lib/security';

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
function approved(u:Viewer){if(u.status!=='approved')bad('Seu cadastro ainda não está aprovado.',403);}
function admin(u:Viewer){approved(u);if(u.role!=='admin')bad('Acesso restrito à administração.',403);}
async function shopOwned(u:Viewer,requireApproved=false){
  const r=await query('SELECT * FROM shops WHERE condominium_id=$1 AND owner_id=$2',[u.condominium_id,u.id]);
  const shop=r.rows[0];
  if(!shop) bad('Cadastre sua loja primeiro.',404);
  if(requireApproved && shop.status!=='approved')bad('Sua loja aguarda aprovação.',403);
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
const instructionsAllowed=['Tocar a campainha','Não tocar a campainha','Deixar na porta','Entregar pessoalmente','Retirar na portaria'];
const orderSchema=z.object({
  shop_id:z.string().uuid(),
  items:z.array(z.object({id:z.string().uuid(),quantity:z.number().int().min(1).max(30),note:z.string().max(200).optional()})).min(1).max(25),
  fulfillment:z.enum(['delivery','pickup']),delivery_day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  delivery_window:z.string().max(70).optional(),instructions:z.array(z.enum(['Tocar a campainha','Não tocar a campainha','Deixar na porta','Entregar pessoalmente','Retirar na portaria'])).max(4).optional(),
  note:z.string().max(400).optional()
});
const googleRegister=z.object({
  invite:z.string().trim().min(10).max(150),
  name:z.string().trim().min(2).max(90),
  phone:z.string().trim().min(10).max(20),
  tower:z.string().trim().min(1).max(60),
  apartment:z.string().trim().min(1).max(24)
});
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
  if(path==='public/condominium'&&method==='POST'){
    const input=z.object({invite:z.string().min(10).max(150)}).parse(await body(req));
    const invite=input.invite;
    if(invite.length<10)bad('Informe um convite válido.');
    const result=await query(
      'SELECT name,towers FROM condominiums WHERE invite_code_hash=$1 AND is_active=true',
      [inviteHash(invite)]
    );
    if(!result.rowCount)bad('Código de convite inválido.',404);
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
      const linked=await tx.query('SELECT id FROM users WHERE email=$1 OR google_auth_user_id=$2',
        [waiting.rows[0].email,waiting.rows[0].google_auth_user_id]);
      if(linked.rowCount)bad('E-mail já cadastrado. Entre com o Google novamente.',409);
      const condo=await tx.query(
        'SELECT id,towers FROM condominiums WHERE invite_code_hash=$1 AND is_active=true',
        [inviteHash(b.invite)]
      );
      if(!condo.rowCount)bad('Convite inválido.');
      if(!Array.isArray(condo.rows[0].towers)||!condo.rows[0].towers.includes(b.tower))bad('Torre inválida.');
      const created=await tx.query(
        "INSERT INTO users(condominium_id,name,email,phone,password_hash,google_auth_user_id,supabase_auth_user_id,tower,apartment) VALUES($1,$2,$3,$4,NULL,$5,$5,$6,$7) RETURNING id",
        [condo.rows[0].id,b.name,waiting.rows[0].email,b.phone,waiting.rows[0].google_auth_user_id,b.tower,b.apartment]
      );
      const token=randomToken();
      await tx.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '14 days')",
        [tokenHash(token),created.rows[0].id]);
      return token;
    });
    const response=out({message:'Cadastro enviado. Aguarde aprovação.'},201);
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
    const condo=await query(
      "SELECT id,towers FROM condominiums WHERE invite_code_hash=$1 AND is_active=true",
      [inviteHash(b.invite)]
    );
    if(!condo.rowCount)bad('Código de convite inválido.');
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
        "INSERT INTO users(condominium_id,name,email,phone,password_hash,supabase_auth_user_id,tower,apartment) VALUES($1,$2,$3,$4,NULL,$5,$6,$7)",
        [condo.rows[0].id,b.name,b.email,b.phone,authUser!.id,b.tower,b.apartment]
      );
    }catch(e:unknown){
      if((e as {code?:string}).code==='23505')bad('E-mail já cadastrado.',409);
      throw e;
    }
    return out({
      message:'Cadastro enviado! Confirme seu e-mail pelo Supabase Auth e aguarde a aprovação do condomínio.',
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
      "UPDATE users SET name=$1,phone=$2,tower=$3,apartment=$4,avatar_image=COALESCE($7,avatar_image),status=CASE WHEN tower<>$3 OR apartment<>$4 THEN 'pending' ELSE status END WHERE id=$5 AND condominium_id=$6",
      [b.name,b.phone,b.tower,b.apartment,u.id,u.condominium_id,b.avatar_image??null]
    );
    return out({ok:true});
  }
  approved(u);
  if(path==='favorites'&&method==='GET'){
    const r=await query(
      "SELECT p.id,p.shop_id,p.category_id,p.name,p.description,p.price_cents,p.promo_price_cents,p.image_url,p.stock,p.visibility,p.lead_time,p.is_featured,s.name AS shop_name,s.is_open FROM favorites f JOIN products p ON p.id=f.product_id AND p.condominium_id=f.condominium_id JOIN shops s ON s.id=p.shop_id AND s.condominium_id=f.condominium_id WHERE f.condominium_id=$1 AND f.user_id=$2 AND p.visibility<>'hidden' AND s.status='approved' ORDER BY f.created_at DESC LIMIT 150",
      [u.condominium_id,u.id]
    );
    return out({ids:r.rows.map(row=>row.id),products:r.rows});
  }
  if(path==='favorites'&&method==='POST'){
    const b=z.object({product_id:z.string().uuid()}).parse(await body(req));
    const valid=await query(
      "SELECT p.id FROM products p JOIN shops s ON s.id=p.shop_id AND s.condominium_id=p.condominium_id WHERE p.id=$1 AND p.condominium_id=$2 AND p.visibility<>'hidden' AND s.status='approved'",
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
      "SELECT p.id,p.shop_id,p.category_id,p.name,p.description,p.price_cents,p.promo_price_cents,p.image_url,p.stock,p.visibility,p.lead_time,p.is_featured,s.name AS shop_name,s.is_open FROM products p JOIN shops s ON s.id=p.shop_id AND s.condominium_id=p.condominium_id WHERE p.condominium_id=$1 AND p.visibility<>'hidden' AND s.status='approved' AND ($2::uuid IS NULL OR p.category_id=$2::uuid) AND ($3::text='' OR p.name ILIKE $3 ESCAPE '\\' OR s.name ILIKE $3 ESCAPE '\\') ORDER BY p.created_at DESC,p.id DESC LIMIT $4 OFFSET $5",
      [u.condominium_id,category,search?escaped:'',limit+1,page*limit]
    );
    return out({products:result.rows.slice(0,limit),hasMore:result.rows.length>limit,page});
  }
  if(path==='home'&&method==='GET'){
    const [categories,shops,products]=await Promise.all([
      query('SELECT id,name,icon FROM categories WHERE condominium_id=$1 ORDER BY sort_order,name',[u.condominium_id]),
      query("SELECT id,name,description,cover_image,logo_image,is_open,delivery_enabled,pickup_enabled,lead_time FROM shops WHERE condominium_id=$1 AND status='approved' ORDER BY is_open DESC,created_at DESC LIMIT 100",[u.condominium_id]),
      query("SELECT p.id,p.shop_id,p.category_id,p.name,p.description,p.price_cents,p.promo_price_cents,p.image_url,p.stock,p.visibility,p.lead_time,p.is_featured,s.name AS shop_name,s.is_open FROM products p JOIN shops s ON s.id=p.shop_id WHERE p.condominium_id=$1 AND s.condominium_id=$1 AND p.visibility<>'hidden' AND s.status='approved' ORDER BY p.is_featured DESC,p.created_at DESC LIMIT 48",[u.condominium_id])
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
  if(path==='shops/mine'){
    if(method==='GET'){
      const r=await query('SELECT * FROM shops WHERE condominium_id=$1 AND owner_id=$2',[u.condominium_id,u.id]);
      const shop=r.rows[0]??null;
      const products=shop?(await query('SELECT * FROM products WHERE condominium_id=$1 AND shop_id=$2 ORDER BY created_at DESC',[u.condominium_id,shop.id])).rows:[];
      return out({shop,products});
    }
    if(method==='POST'){
      const b=z.object({name:z.string().trim().min(3).max(75),description:z.string().max(500).optional(),whatsapp:z.string().min(10).max(20)}).parse(await body(req));
      normalizeWhatsApp(b.whatsapp);
      const existing=await query('SELECT id FROM shops WHERE owner_id=$1',[u.id]);
      if(existing.rowCount)bad('Você já possui uma loja.',409);
      const r=await query('INSERT INTO shops(condominium_id,owner_id,name,description,whatsapp) VALUES($1,$2,$3,$4,$5) RETURNING *',[u.condominium_id,u.id,b.name,b.description??'',b.whatsapp]);
      return out({shop:r.rows[0]},201);
    }
    if(method==='PATCH'){
      const shop=await shopOwned(u);
      const b=z.object({name:z.string().trim().min(3).max(75),description:z.string().max(500),
        whatsapp:z.string().min(10).max(20),logo_image:z.string().nullable().optional(),is_open:z.boolean(),delivery_enabled:z.boolean(),
        pickup_enabled:z.boolean(),lead_time:z.string().max(100),pickup_instructions:z.string().max(250),
        cover_image:z.string().nullable().optional()}).parse(await body(req));
      normalizeWhatsApp(b.whatsapp);
      if(!b.delivery_enabled&&!b.pickup_enabled)bad('Habilite entrega ou retirada.');
      const r=await query(
        'UPDATE shops SET name=$1,description=$2,whatsapp=$3,is_open=$4,delivery_enabled=$5,pickup_enabled=$6,lead_time=$7,pickup_instructions=$8,cover_image=$9,logo_image=$12 WHERE id=$10 AND condominium_id=$11 RETURNING *',
        [b.name,b.description,b.whatsapp,b.is_open,b.delivery_enabled,b.pickup_enabled,b.lead_time,b.pickup_instructions,imagePath(b.cover_image),shop.id,u.condominium_id,imagePath(b.logo_image)]);
      return out({shop:r.rows[0]});
    }
  }
  if(parts[0]==='shops'&&parts[1]&&parts[1]!=='mine'&&method==='GET'){
    if(!uuid(parts[1]))bad('Loja inválida.');
    const s=await query("SELECT id,name,description,cover_image,logo_image,is_open,delivery_enabled,pickup_enabled,lead_time,pickup_instructions FROM shops WHERE id=$1 AND condominium_id=$2 AND status='approved'",[parts[1],u.condominium_id]);
    if(!s.rowCount)bad('Loja não encontrada.',404);
    const p=await query("SELECT id,shop_id,category_id,name,description,price_cents,promo_price_cents,image_url,stock,visibility,lead_time FROM products WHERE shop_id=$1 AND condominium_id=$2 AND visibility<>'hidden' ORDER BY created_at DESC",[parts[1],u.condominium_id]);
    return out({shop:s.rows[0],products:p.rows});
  }
  if((path==='media'||path==='media/profile')&&method==='POST'){
    const personal=path==='media/profile';
    const shop=personal?null:await shopOwned(u);
    const form=await req.formData();
    const input=form.get('file');
    if(!(input instanceof File))throw new ApiError(400,'Selecione uma imagem.');
    const file:File=input;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type))bad('Imagem deve ser JPG, PNG ou WebP.');
    if(file.size<1||file.size>8_000_000)bad('A imagem deve ter no máximo 8 MB.');
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
    const objectKey=u.condominium_id+'/'+(personal?'profile/'+u.id:shop!.id)+'/'+crypto.randomUUID()+'.webp';
    const {error:uploadError}=await storageAdmin().storage.from(STORAGE_BUCKET).upload(
      objectKey,optimized!,{contentType:'image/webp',upsert:false,cacheControl:'86400'}
    );
    if(uploadError)bad('Não foi possível enviar a foto.',502);
    try{
      const r=await query(
        'INSERT INTO media_assets(condominium_id,shop_id,user_id,mime,storage_key) VALUES($1,$2,$3,$4,$5) RETURNING id',
        [u.condominium_id,shop?.id??null,personal?u.id:null,'image/webp',objectKey]
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
      is_available:z.boolean().optional(),lead_time:z.string().max(100).optional()}).parse(await body(req));
    if(b.promo_price_cents!=null&&b.promo_price_cents>=b.price_cents)bad('O preço promocional deve ser menor que o original.');
    const category=await query('SELECT id FROM categories WHERE id=$1 AND condominium_id=$2',[b.category_id,u.condominium_id]);
    if(!category.rowCount)bad('Categoria inválida.');
    const r=await query(
      'INSERT INTO products(condominium_id,shop_id,category_id,name,description,price_cents,promo_price_cents,stock,image_url,is_available,visibility,lead_time) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      [u.condominium_id,shop.id,b.category_id,b.name,b.description??'',b.price_cents,b.promo_price_cents??null,b.stock??null,imagePath(b.image_url),
        (b.visibility??(b.is_available===false?'hidden':'available'))==='available',
        b.visibility??(b.is_available===false?'hidden':'available'),b.lead_time??'']
    );
    return out({product:r.rows[0]},201);
  }
  if(parts[0]==='products'&&parts[1]&&parts[2]==='visibility'&&method==='PATCH'){
    if(!uuid(parts[1]))bad('Produto inválido.');
    const shop=await shopOwned(u,true);
    const b=z.object({visibility:z.enum(['available','unavailable','hidden'])}).parse(await body(req));
    const updated=await query(
      'UPDATE products SET visibility=$1,is_available=($1=\'available\') WHERE id=$2 AND condominium_id=$3 AND shop_id=$4 RETURNING *',
      [b.visibility,parts[1],u.condominium_id,shop.id]
    );
    if(!updated.rowCount)bad('Produto não encontrado.',404);
    return out({product:updated.rows[0]});
  }
  if(parts[0]==='products'&&parts[1]&&['PATCH','DELETE'].includes(method)){
    if(!uuid(parts[1]))bad('Produto inválido.');
    const shop=await shopOwned(u,true);
    const owned=await query('SELECT id FROM products WHERE id=$1 AND shop_id=$2 AND condominium_id=$3',[parts[1],shop.id,u.condominium_id]);
    if(!owned.rowCount)bad('Produto não encontrado.',404);
    if(method==='DELETE'){
      await query("UPDATE products SET is_available=false,visibility='hidden' WHERE id=$1 AND shop_id=$2",[parts[1],shop.id]);
      return out({ok:true});
    }
    const b=z.object({name:z.string().trim().min(2).max(100),description:z.string().max(600),
      category_id:z.string().uuid(),price_cents:z.number().int().min(1).max(10_000_000),
      promo_price_cents:z.number().int().min(1).max(10_000_000).nullable(),
      stock:z.number().int().min(0).max(100000).nullable(),image_url:z.string().nullable(),
      visibility:z.enum(['available','unavailable','hidden']).optional(),
      is_available:z.boolean().optional(),lead_time:z.string().max(100)}).parse(await body(req));
    if(b.promo_price_cents!=null&&b.promo_price_cents>=b.price_cents)bad('Preço promocional inválido.');
    const cat=await query('SELECT id FROM categories WHERE id=$1 AND condominium_id=$2',[b.category_id,u.condominium_id]);
    if(!cat.rowCount)bad('Categoria inválida.');
    const r=await query(
      'UPDATE products SET name=$1,description=$2,category_id=$3,price_cents=$4,promo_price_cents=$5,stock=$6,image_url=$7,is_available=$8,lead_time=$9,visibility=$13 WHERE id=$10 AND shop_id=$11 AND condominium_id=$12 RETURNING *',
      [b.name,b.description,b.category_id,b.price_cents,b.promo_price_cents,b.stock,imagePath(b.image_url),
        (b.visibility??(b.is_available===false?'hidden':'available'))==='available',b.lead_time,parts[1],shop.id,u.condominium_id,
        b.visibility??(b.is_available===false?'hidden':'available')]
    );
    return out({product:r.rows[0]});
  }
  if(path==='orders'&&method==='POST'){
    const b=orderSchema.parse(await body(req));
    if(new Set(b.items.map(i=>i.id)).size!==b.items.length)bad('Itens duplicados.');
    const result=await transaction(async tx=>{
      const sh=await tx.query("SELECT * FROM shops WHERE id=$1 AND condominium_id=$2 AND status='approved' FOR UPDATE",[b.shop_id,u.condominium_id]);
      const shop=sh.rows[0];
      if(!shop||!shop.is_open)bad('Loja não está recebendo pedidos.');
      if(b.fulfillment==='delivery'&&!shop.delivery_enabled||b.fulfillment==='pickup'&&!shop.pickup_enabled)bad('Forma de recebimento indisponível.');
      const ids=b.items.map(i=>i.id);
      const p=await tx.query(
        "SELECT * FROM products WHERE id=ANY($1::uuid[]) AND condominium_id=$2 AND shop_id=$3 AND is_available=true AND visibility='available' ORDER BY id FOR UPDATE",
        [ids,u.condominium_id,shop.id]
      );
      if(p.rows.length!==b.items.length)bad('Um ou mais produtos estão indisponíveis.');
      const products=new Map(p.rows.map(x=>[x.id,x]));
      let total=0;
      const items=b.items.map(i=>{
        const item=products.get(i.id)!;
        if(item.stock!==null&&item.stock<i.quantity)bad('Estoque insuficiente para '+item.name+'.');
        const cents=unitPrice(item);total+=cents*i.quantity;
        return {product_id:item.id,name:item.name,quantity:i.quantity,unit_price_cents:cents,note:i.note??''};
      });
      const created=await tx.query(
        'INSERT INTO orders(condominium_id,buyer_id,shop_id,fulfillment,delivery_day,delivery_window,delivery_instructions,note,total_cents) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) RETURNING *',
        [u.condominium_id,u.id,shop.id,b.fulfillment,b.delivery_day??null,b.delivery_window??'',JSON.stringify(b.instructions??[]),b.note??'',total]
      );
      for(const item of items){
        await tx.query('INSERT INTO order_items(order_id,product_id,name_snapshot,quantity,unit_price_cents,note) VALUES($1,$2,$3,$4,$5,$6)',
          [created.rows[0].id,item.product_id,item.name,item.quantity,item.unit_price_cents,item.note]);
      }
      const message=orderMessage({code:created.rows[0].code,shop:shop.name,buyer:u.name,tower:u.tower,apartment:u.apartment,
        items:items.map(x=>({name:x.name,quantity:x.quantity,unit_price_cents:x.unit_price_cents,note:x.note})),
        total_cents:total,fulfillment:b.fulfillment,delivery_day:b.delivery_day,delivery_window:b.delivery_window,
        instructions:b.instructions,note:b.note});
      return {order:created.rows[0],whatsapp_url:'https://wa.me/'+normalizeWhatsApp(shop.whatsapp)+'?text='+encodeURIComponent(message)};
    });
    return out(result,201);
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
      "SELECT o.*,(SELECT rv.status FROM shop_reviews rv WHERE rv.order_id=o.id AND rv.condominium_id=o.condominium_id) AS review_status,s.name AS shop_name,bu.name AS buyer_name,bu.tower,bu.apartment,bu.phone AS buyer_phone,COALESCE(json_agg(json_build_object('name',i.name_snapshot,'quantity',i.quantity,'unit_price_cents',i.unit_price_cents,'note',i.note)) FILTER (WHERE i.id IS NOT NULL),'[]'::json) AS items FROM orders o JOIN shops s ON s.id=o.shop_id JOIN users bu ON bu.id=o.buyer_id LEFT JOIN order_items i ON i.order_id=o.id WHERE o.condominium_id=$1 AND "+(seller?'o.shop_id=$2':'o.buyer_id=$2')+(status?' AND o.status=$3':'')+" GROUP BY o.id,s.name,bu.id ORDER BY o.created_at DESC LIMIT 100",
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
      query('SELECT id,name,icon FROM categories WHERE condominium_id=$1 ORDER BY sort_order,name',[u.condominium_id])
    ]);
    return out({residents:residents.rows,shops:shops.rows,stats:stats.rows[0],categories:categories.rows});
  }
  if(parts[0]==='admin'&&parts[1]==='users'&&parts[2]&&method==='PATCH'){
    admin(u);if(!uuid(parts[2])||parts[2]===u.id)bad('Morador inválido.');
    const b=z.object({status:z.enum(['approved','suspended'])}).parse(await body(req));
    const r=await query("UPDATE users SET status=$1 WHERE id=$2 AND condominium_id=$3 AND role='resident' RETURNING id",[b.status,parts[2],u.condominium_id]);
    if(!r.rowCount)bad('Morador não encontrado.',404);
    if(b.status==='suspended')await query('DELETE FROM sessions WHERE user_id=$1',[parts[2]]);
    return out({ok:true});
  }
  if(parts[0]==='admin'&&parts[1]==='shops'&&parts[2]&&method==='PATCH'){
    admin(u);if(!uuid(parts[2]))bad('Loja inválida.');
    const b=z.object({status:z.enum(['approved','suspended'])}).parse(await body(req));
    const r=await query('UPDATE shops SET status=$1 WHERE id=$2 AND condominium_id=$3 RETURNING id',[b.status,parts[2],u.condominium_id]);
    if(!r.rowCount)bad('Loja não encontrada.',404);
    return out({ok:true});
  }
  if(path==='admin/categories'&&method==='POST'){
    admin(u);
    const b=z.object({name:z.string().trim().min(2).max(60),icon:z.string().regex(/^[a-z0-9-]{2,40}$/)}).parse(await body(req));
    try{
      const r=await query('INSERT INTO categories(condominium_id,name,icon) VALUES($1,$2,$3) RETURNING *',[u.condominium_id,b.name,b.icon]);
      return out({category:r.rows[0]},201);
    }catch(e:unknown){if((e as {code?:string}).code==='23505')bad('Categoria já existente.',409);throw e;}
  }
  if(path==='admin/invite'&&method==='POST'){
    admin(u);
    const code=crypto.randomBytes(12).toString('base64url');
    await query('UPDATE condominiums SET invite_code_hash=$1 WHERE id=$2',[inviteHash(code),u.condominium_id]);
    return out({invite:code,message:'Compartilhe o convite em canal privado. O convite anterior deixou de funcionar.'});
  }
  return bad('Rota não encontrada.',404);
}
async function endpoint(req:NextRequest,method:Verb) {
  const parts=req.nextUrl.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean);
  try{return await processApi({req,method,parts});}
  catch(error){
    if(error instanceof ApiError)return out({error:error.message},error.status);
    if(error instanceof ZodError)return out({error:'Confira os campos preenchidos.',details:error.issues.map(i=>i.path.join('.'))},400);
    console.error('condovery_api_error',error instanceof Error?error.message:error);
    return out({error:'Não foi possível concluir a operação.'},500);
  }
}
export const GET=(req:NextRequest)=>endpoint(req,'GET');
export const POST=(req:NextRequest)=>endpoint(req,'POST');
export const PATCH=(req:NextRequest)=>endpoint(req,'PATCH');
export const DELETE=(req:NextRequest)=>endpoint(req,'DELETE');
