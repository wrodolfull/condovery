import {NextRequest,NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {storageAdmin,STORAGE_BUCKET} from '@/lib/supabase';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const valid=/^[a-z0-9]+(?:-[a-z0-9]+)*$/i;
export async function GET(req:NextRequest){
  const slug=req.nextUrl.searchParams.get('slug')||'';
  if(slug.length>80||!valid.test(slug))return new NextResponse(null,{status:404});
  const found=await query<{mime:string;storage_key:string|null;bytes:Buffer|null}>(
    "SELECT m.mime,m.storage_key,m.bytes FROM shops s "+
    "JOIN condominiums c ON c.id=s.condominium_id AND c.is_active=true "+
    "JOIN media_assets m ON m.id=substring(s.logo_image from '^/api/media/([0-9a-f-]{36})$')::uuid "+
    "AND m.shop_id=s.id AND m.condominium_id=s.condominium_id "+
    "WHERE s.slug=$1 AND s.status='approved' LIMIT 1",[slug]);
  const media=found.rows[0];
  if(!media||!['image/webp','image/png','image/jpeg'].includes(media.mime))return new NextResponse(null,{status:404});
  let bytes:Buffer;
  if(media.storage_key){
    const {data,error}=await storageAdmin().storage.from(STORAGE_BUCKET).download(media.storage_key);
    if(error||!data)return new NextResponse(null,{status:404});
    bytes=Buffer.from(await data.arrayBuffer());
  }else if(media.bytes)bytes=Buffer.from(media.bytes);
  else return new NextResponse(null,{status:404});
  return new NextResponse(new Uint8Array(bytes),{headers:{'Content-Type':media.mime,'Cache-Control':'public, max-age=300, s-maxage=3600','X-Content-Type-Options':'nosniff'}});
}
