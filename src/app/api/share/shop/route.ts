import {NextRequest,NextResponse} from 'next/server';
import {query} from '@/lib/db';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const valid=/^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
export async function GET(req:NextRequest){
  const slug=req.nextUrl.searchParams.get('slug')||'';
  if(slug.length>80||!valid.test(slug))return NextResponse.json({error:'Loja não encontrada.'},{status:404});
  const found=await query<{shop:string;condominium:string}>(
    "SELECT s.name AS shop,c.name AS condominium FROM shops s JOIN condominiums c ON c.id=s.condominium_id "+
    "WHERE s.slug=$1 AND s.status='approved' AND c.is_active=true LIMIT 1",[slug]);
  if(!found.rowCount)return NextResponse.json({error:'Loja não encontrada.'},{status:404});
  return NextResponse.json(found.rows[0],{headers:{'Cache-Control':'public, s-maxage=300'}});
}
