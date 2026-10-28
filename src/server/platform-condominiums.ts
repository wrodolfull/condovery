import crypto from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {query,transaction} from '@/lib/db';
import {bad} from '@/lib/api-error';
import {inviteHash,tokenHash,type Viewer} from '@/lib/auth';
import {storageAdmin} from '@/lib/supabase';
import {normalizeCondominiumSlug,normalizeTenantDomain} from '@/lib/tenancy';
import {tenantLabel} from '@/lib/tenant-host';
import {towerLabels} from '@/lib/towers';

const body=(req:NextRequest)=>req.json().catch(()=>bad('JSON inválido.'));
const out=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function handlePlatformCondominiums(req:NextRequest,method:string,path:string,u:Viewer):Promise<NextResponse|null>{
  if(path==='platform/condominiums'&&method==='GET'){
    if(!u.is_superadmin)bad('Acesso exclusivo do superadmin.',403);
    if(req.nextUrl.searchParams.get('mode')==='options'){
      const options=await query('SELECT id,name FROM condominiums WHERE is_active=true ORDER BY name LIMIT 1000');
      return out({condominiums:options.rows,active_condominium_id:u.condominium_id});
    }
    const page=Number(req.nextUrl.searchParams.get('page')||0);
    if(!Number.isInteger(page)||page<0||page>10000)bad('Página inválida.');
    const search=(req.nextUrl.searchParams.get('search')||'').trim().slice(0,100);
    const where=" FROM condominiums c WHERE ($1='' OR strpos(lower(c.name),lower($1))>0 OR strpos(lower(c.slug),lower($1))>0)";
    const [count,list]=await Promise.all([
      query<{total:number}>('SELECT count(*)::int AS total'+where,[search]),
      query("SELECT c.id,c.name,c.slug,c.subdomain,c.custom_domain,c.is_active,c.created_at,"+
        " (SELECT count(*)::int FROM users m WHERE m.condominium_id=c.id AND m.role='resident' AND m.status='approved') AS residents,"+
        " (SELECT count(*)::int FROM shops s WHERE s.condominium_id=c.id AND s.status='approved') AS shops"+
        where+" ORDER BY c.created_at DESC,c.id DESC LIMIT 20 OFFSET $2",[search,page*20])
    ]);
    const total=count.rows[0]?.total??0;
    return out({condominiums:list.rows,page,total,totalPages:Math.max(1,Math.ceil(total/20)),active_condominium_id:u.condominium_id});
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
  return null;
}
