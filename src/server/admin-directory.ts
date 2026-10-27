import {NextRequest,NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {bad} from '@/lib/api-error';
import type {Viewer} from '@/lib/auth';

const pageSize=25;
function filters(req:NextRequest){
  const p=req.nextUrl.searchParams;
  const kind=p.get('kind')||'users';
  if(kind!=='users'&&kind!=='shops')bad('Listagem inválida.');
  const status=p.get('status')||'all';
  if(!['all','approved','suspended','pending'].includes(status))bad('Filtro inválido.');
  const search=(p.get('search')||'').trim();
  const tower=p.get('tower')||'';
  const page=Number(p.get('page')||'0');
  if(search.length>100||tower.length>60)bad('Filtro muito longo.');
  if(!Number.isInteger(page)||page<0||page>10000)bad('Página inválida.');
  return {kind,status,search,tower,page};
}
function csvCell(value:unknown){
  const clean=String(value??'').replace(/[\r\n\t]/g,' ').trim();
  const safe=/^[=+\-@]/.test(clean)?"'"+clean:clean;
  return '"'+safe.replace(/"/g,'""')+'"';
}
export function toSafeCSV(columns:string[],rows:Record<string,unknown>[]):string{
  return '\uFEFF'+[columns.map(csvCell).join(','),...rows.map(r=>columns.map(c=>csvCell(r[c])).join(','))].join('\r\n');
}
export async function handleAdminDirectory(req:NextRequest,method:string,path:string,u:Viewer):Promise<NextResponse|null>{
  const exporting=path==='admin/directory/export';
  if(path!=='admin/directory'&&!exporting)return null;
  if(method!=='GET')bad('Método não permitido.',405);
  if(u.role!=='admin'||u.status!=='approved')bad('Acesso restrito à administração.',403);
  const {kind,status,search,tower,page}=filters(req);
  // Literal substrings: wildcard characters entered by users do not widen searches.
  const values=[u.condominium_id,search,status,tower];
  const from=kind==='users'?'users u':'shops s JOIN users u ON u.id=s.owner_id AND u.condominium_id=s.condominium_id';
  const where=kind==='users'
    ?"u.condominium_id=$1 AND u.role='resident' AND u.status<>'deleted' AND ($2='' OR strpos(lower(u.name),lower($2))>0 OR strpos(lower(u.email),lower($2))>0 OR strpos(lower(u.apartment),lower($2))>0) AND ($3='all' OR u.status=$3) AND ($4='' OR u.tower=$4)"
    :"s.condominium_id=$1 AND s.status<>'deleted' AND ($2='' OR strpos(lower(s.name),lower($2))>0 OR strpos(lower(u.name),lower($2))>0) AND ($3='all' OR s.status=$3) AND $4::text IS NOT NULL";
  const prefix=kind==='users'?'u':'s';
  const fields=kind==='users'
    ?'u.id,u.name,u.email,u.phone,u.tower,u.apartment,u.status,u.created_at'
    :'s.id,s.name,u.name AS owner_name,s.status,s.is_open,s.created_at';
  const count=await query<{total:number}>('SELECT count(*)::int AS total FROM '+from+' WHERE '+where,values);
  const total=count.rows[0]?.total??0;
  const order=' ORDER BY '+prefix+'.created_at DESC,'+prefix+'.id DESC';
  if(exporting){
    if(total>5000)bad('Mais de 5.000 registros. Refine os filtros antes de exportar.',413);
    const result=await query('SELECT '+fields+' FROM '+from+' WHERE '+where+order+' LIMIT 5001',values);
    if(result.rows.length>5000)bad('Mais de 5.000 registros. Refine os filtros.',413);
    const columns=kind==='users'?['id','name','email','phone','tower','apartment','status','created_at']:['id','name','owner_name','status','is_open','created_at'];
    return new NextResponse(toSafeCSV(columns,result.rows),{headers:{
      'Content-Type':'text/csv; charset=utf-8',
      'Content-Disposition':'attachment; filename="condovery-'+kind+'.csv"',
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'
    }});
  }
  const data=await query('SELECT '+fields+' FROM '+from+' WHERE '+where+order+' LIMIT $5 OFFSET $6',
    [...values,pageSize,page*pageSize]);
  return NextResponse.json({items:data.rows,page,total,pageSize,totalPages:Math.max(1,Math.ceil(total/pageSize))},
    {headers:{'Cache-Control':'private, no-store'}});
}
