import {NextRequest,NextResponse} from 'next/server';
import {advertiserReport,campaignFromShare,reportRange} from '@/server/advertiser-report';
import {buildAdvertiserPdf} from '@/server/advertiser-report-pdf';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest,{params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  const id=await campaignFromShare(token);
  if(!id)return NextResponse.json({error:'Relatório indisponível ou link expirado.'},{status:404,headers:{'Cache-Control':'no-store'}});
  try{
    const report=await advertiserReport(id,reportRange(req.nextUrl.searchParams.get('range')));
    return new NextResponse(new Uint8Array(buildAdvertiserPdf(report)),{headers:{
      'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="condovery-ads-'+id.slice(0,8)+'.pdf"',
      'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow',
      'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'
    }});
  }catch{
    return NextResponse.json({error:'Não foi possível gerar o PDF.'},{status:500,headers:{'Cache-Control':'no-store'}});
  }
}
