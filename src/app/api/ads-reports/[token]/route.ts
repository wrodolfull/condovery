import {NextRequest,NextResponse} from 'next/server';
import {advertiserReport,campaignFromShare,reportRange} from '@/server/advertiser-report';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  const id=await campaignFromShare(token);
  if(!id)return NextResponse.json({error:'Relatório indisponível ou link expirado.'},{status:404,headers:{'Cache-Control':'no-store'}});
  try{
    const report=await advertiserReport(id,reportRange(req.nextUrl.searchParams.get('range')));
    return NextResponse.json(report,{headers:{
      'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'
    }});
  }catch{
    return NextResponse.json({error:'Não foi possível carregar o relatório.'},{status:500,headers:{'Cache-Control':'no-store'}});
  }
}
