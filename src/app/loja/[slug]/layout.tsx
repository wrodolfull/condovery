import type {Metadata} from 'next';
import {query} from '@/lib/db';

export const dynamic='force-dynamic';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)||slug.length>80)return {title:'Loja no Condovery'};
  try{
    const result=await query<{name:string;condominium:string;logo_image:string|null}>(
      "SELECT s.name,c.name AS condominium,s.logo_image FROM shops s JOIN condominiums c ON c.id=s.condominium_id "+
      "WHERE s.slug=$1 AND s.status='approved' AND c.is_active=true LIMIT 1",[slug]);
    const shop=result.rows[0];if(!shop)return {title:'Loja no Condovery'};
    const title=shop.name+' | Condovery';
    const description='Conheça '+shop.name+', uma loja do condomínio '+shop.condominium+'. Entre na sua conta para ver produtos e ofertas.';
    const base=process.env.APP_URL||'http://localhost:3000';
    const url=new URL('/loja/'+encodeURIComponent(slug),base).toString();
    const image=shop.logo_image?.startsWith('/api/media/')?new URL('/api/share/shop/image?slug='+encodeURIComponent(slug),base).toString():undefined;
    return {title,description,openGraph:{title,description,type:'website',url,images:image?[{url:image,alt:'Logo da loja '+shop.name}]:[]},twitter:{card:image?'summary_large_image':'summary',title,description,images:image?[image]:[]}};
  }catch{return {title:'Loja no Condovery'};}
}
export default function ShopLayout({children}:{children:React.ReactNode}){return children;}
