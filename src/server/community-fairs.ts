import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {query} from '@/lib/db';
import {bad} from '@/lib/api-error';
import type {Viewer} from '@/lib/auth';

const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fairSchema=z.object({
  title:z.string().trim().min(3).max(100),
  description:z.string().trim().max(600),
  cover_image_url:z.union([z.string().regex(/^\/api\/media\/[0-9a-f-]{36}$/i),z.literal('')]).default(''),
  starts_at:z.string().datetime({offset:true}),
  ends_at:z.string().datetime({offset:true}),
  published:z.boolean().default(false)
}).strict();
const respond=(obj:unknown,status=200)=>NextResponse.json(obj,{status,headers:{'Cache-Control':'private,no-store'}});
const read=(req:NextRequest)=>req.json().catch(()=>bad('JSON inválido.'));
function admin(u:Viewer){if(u.role!=='admin'||u.status!=='approved')bad('Acesso restrito à administração.',403);}
function approved(u:Viewer){if(u.status!=='approved')bad('Conta indisponível.',403);}
async function verifyCover(cover:string,tenant:string){
  if(!cover)return;
  const id=cover.split('/').pop();
  const r=await query('SELECT id FROM media_assets WHERE id=$1 AND condominium_id=$2 AND shop_id IS NULL AND user_id IS NULL',[id,tenant]);
  if(!r.rowCount)bad('A capa precisa ser enviada para este condomínio.',403);
}
function validatePeriod(start:string,end:string){
  if(!Number.isFinite(new Date(start).valueOf())||!Number.isFinite(new Date(end).valueOf())||
     new Date(end)<=new Date(start))bad('O encerramento deve ser posterior ao início.');
}
async function findSeller(u:Viewer){
  const shop=await query<{id:string}>("SELECT id FROM shops WHERE condominium_id=$1 AND owner_id=$2 AND status='approved'",[u.condominium_id,u.id]);
  if(!shop.rowCount)bad('É necessário ter uma loja ativa.',403);
  return shop.rows[0].id;
}
export async function handleCommunityFairs(req:NextRequest,method:string,path:string,parts:string[],u:Viewer):Promise<NextResponse|null>{
  if(parts[0]!=='fairs')return null;
  approved(u);
  if(path==='fairs'&&method==='GET'){
    const r=await query(
      "SELECT id,title,description,cover_image_url,starts_at,ends_at FROM community_fairs WHERE condominium_id=$1 AND published=true AND starts_at<=now() AND ends_at>now() ORDER BY starts_at DESC LIMIT 20",[u.condominium_id]);
    return respond({fairs:r.rows});
  }
  if(path==='fairs/manage'){
    admin(u);
    if(method==='GET'){
      const [fairs,applications]=await Promise.all([
        query("SELECT id,title,description,cover_image_url,starts_at,ends_at,published,created_at FROM community_fairs WHERE condominium_id=$1 ORDER BY created_at DESC LIMIT 100",[u.condominium_id]),
        query("SELECT fp.fair_id,fp.product_id,fp.status,fp.submitted_at,p.name AS product_name,s.name AS shop_name "+
          "FROM community_fair_products fp "+
          "JOIN community_fairs f ON f.id=fp.fair_id AND f.condominium_id=fp.condominium_id "+
          "JOIN products p ON p.id=fp.product_id AND p.condominium_id=fp.condominium_id "+
          "JOIN shops s ON s.id=p.shop_id AND s.condominium_id=p.condominium_id "+
          "WHERE fp.condominium_id=$1 ORDER BY fp.submitted_at DESC LIMIT 1000",[u.condominium_id])
      ]);
      return respond({fairs:fairs.rows,applications:applications.rows});
    }
    if(method==='POST'){
      const form=fairSchema.parse(await read(req));
      validatePeriod(form.starts_at,form.ends_at);
      await verifyCover(form.cover_image_url,u.condominium_id);
      const saved=await query(
        'INSERT INTO community_fairs(condominium_id,title,description,cover_image_url,starts_at,ends_at,published) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [u.condominium_id,form.title,form.description,form.cover_image_url||null,form.starts_at,form.ends_at,form.published]);
      return respond({id:saved.rows[0].id},201);
    }
  }
  if(parts.length===3&&parts[1]==='manage'&&idPattern.test(parts[2])&&method==='PATCH'){
    admin(u);
    const payload=fairSchema.partial().strict().parse(await read(req));
    if(!Object.keys(payload).length)bad('Informe algo para atualizar.');
    const existing=await query('SELECT * FROM community_fairs WHERE id=$1 AND condominium_id=$2',[parts[2],u.condominium_id]);
    if(!existing.rowCount)bad('Feira não encontrada.',404);
    const next={...existing.rows[0],...payload};
    const start=new Date(String(next.starts_at)).toISOString(),end=new Date(String(next.ends_at)).toISOString();
    validatePeriod(start,end);
    await verifyCover(next.cover_image_url??'',u.condominium_id);
    const update=await query(
      'UPDATE community_fairs SET title=$1,description=$2,cover_image_url=$3,starts_at=$4,ends_at=$5,published=$6,updated_at=now() WHERE id=$7 AND condominium_id=$8 RETURNING id',
      [next.title,next.description,next.cover_image_url||null,start,end,next.published,parts[2],u.condominium_id]);
    if(!update.rowCount)bad('Feira não encontrada.',404);
    return respond({ok:true});
  }
  if(parts.length===5&&parts[1]==='manage'&&parts[3]==='applications'&&idPattern.test(parts[2])&&idPattern.test(parts[4])&&method==='PATCH'){
    admin(u);
    const payload=z.object({status:z.enum(['approved','rejected'])}).strict().parse(await read(req));
    const changed=await query(
      'UPDATE community_fair_products fp SET status=$1,reviewed_at=now() '+
      'FROM community_fairs f WHERE fp.fair_id=$2 AND fp.product_id=$3 AND fp.condominium_id=$4 '+
      'AND f.id=fp.fair_id AND f.condominium_id=fp.condominium_id RETURNING fp.product_id',
      [payload.status,parts[2],parts[4],u.condominium_id]);
    if(!changed.rowCount)bad('Inscrição não encontrada.',404);
    return respond({ok:true});
  }
  if(path==='fairs/seller'&&method==='GET'){
    const shopId=await findSeller(u);
    const [fairs,products,applications]=await Promise.all([
      query("SELECT id,title,description,starts_at,ends_at,cover_image_url FROM community_fairs WHERE condominium_id=$1 AND published=true AND ends_at>now() ORDER BY starts_at ASC LIMIT 50",[u.condominium_id]),
      query("SELECT p.id,p.name FROM products p JOIN categories c ON c.id=p.category_id AND c.condominium_id=p.condominium_id WHERE p.condominium_id=$1 AND p.shop_id=$2 AND p.visibility='available' AND p.is_available=true AND p.deleted_at IS NULL AND p.moderation_blocked=false AND c.is_active=true ORDER BY p.name",[u.condominium_id,shopId]),
      query("SELECT fp.fair_id,fp.product_id,fp.status FROM community_fair_products fp JOIN products p ON p.id=fp.product_id AND p.condominium_id=fp.condominium_id WHERE fp.condominium_id=$1 AND p.shop_id=$2",[u.condominium_id,shopId])
    ]);
    return respond({fairs:fairs.rows,products:products.rows,applications:applications.rows});
  }
  if(parts.length===3&&idPattern.test(parts[1])&&parts[2]==='applications'&&method==='POST'){
    const shopId=await findSeller(u);
    const payload=z.object({product_id:z.string().uuid()}).strict().parse(await read(req));
    const added=await query(
      'INSERT INTO community_fair_products(fair_id,condominium_id,product_id) '+
      'SELECT f.id,f.condominium_id,p.id FROM community_fairs f '+
      'JOIN products p ON p.id=$3 AND p.condominium_id=f.condominium_id AND p.shop_id=$4 '+
      "JOIN shops s ON s.id=p.shop_id AND s.condominium_id=f.condominium_id AND s.status='approved' "+
      'JOIN categories c ON c.id=p.category_id AND c.condominium_id=f.condominium_id AND c.is_active=true '+
      'WHERE f.id=$1 AND f.condominium_id=$2 AND f.published=true AND f.ends_at>now() '+
      "AND p.visibility='available' AND p.is_available=true AND p.deleted_at IS NULL AND p.moderation_blocked=false "+
      'ON CONFLICT (fair_id,product_id) DO NOTHING RETURNING product_id',
      [parts[1],u.condominium_id,payload.product_id,shopId]);
    if(!added.rowCount)bad('Produto indisponível ou já inscrito nesta feira.',409);
    return respond({ok:true},201);
  }
  if(parts.length===4&&idPattern.test(parts[1])&&parts[2]==='applications'&&idPattern.test(parts[3])&&method==='DELETE'){
    const shopId=await findSeller(u);
    const removed=await query(
      'DELETE FROM community_fair_products fp USING products p '+
      'WHERE fp.fair_id=$1 AND fp.condominium_id=$2 AND fp.product_id=$3 '+
      'AND p.id=fp.product_id AND p.condominium_id=fp.condominium_id AND p.shop_id=$4 RETURNING fp.product_id',
      [parts[1],u.condominium_id,parts[3],shopId]);
    if(!removed.rowCount)bad('Inscrição não encontrada.',404);
    return respond({ok:true});
  }
  if(parts.length===2&&idPattern.test(parts[1])&&method==='GET'){
    const fair=await query(
      "SELECT id,title,description,cover_image_url,starts_at,ends_at FROM community_fairs WHERE id=$1 AND condominium_id=$2 AND published=true AND starts_at<=now() AND ends_at>now()",
      [parts[1],u.condominium_id]);
    if(!fair.rowCount)bad('Feira indisponível.',404);
    const products=await query(
      'SELECT p.id,p.shop_id,p.category_id,p.name,p.description,p.price_cents,p.promo_price_cents, '+
      'p.image_url,p.stock,p.visibility,p.lead_time,p.is_featured,p.option_groups, '+
      's.name AS shop_name,s.is_open FROM community_fair_products fp '+
      'JOIN products p ON p.id=fp.product_id AND p.condominium_id=fp.condominium_id '+
      'JOIN shops s ON s.id=p.shop_id AND s.condominium_id=p.condominium_id '+
      'JOIN categories c ON c.id=p.category_id AND c.condominium_id=p.condominium_id '+
      "WHERE fp.fair_id=$1 AND fp.condominium_id=$2 AND fp.status='approved' "+
      "AND p.visibility='available' AND p.is_available=true AND p.deleted_at IS NULL "+
      "AND p.moderation_blocked=false AND (p.stock IS NULL OR p.stock>0) "+
      "AND s.status='approved' AND s.is_open=true AND c.is_active=true "+
      'ORDER BY fp.reviewed_at DESC NULLS LAST,p.created_at DESC LIMIT 100',
      [parts[1],u.condominium_id]);
    return respond({fair:fair.rows[0],products:products.rows});
  }
  return bad('Rota não encontrada.',404);
}
