import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {query} from '@/lib/db';

export const runtime='nodejs';
const schema=z.object({
 name:z.string().trim().min(2).max(90),
 condominium:z.string().trim().min(2).max(140),
 contact:z.string().trim().min(6).max(180),
 role:z.enum(['sindico','administradora','morador','outro']),
 website:z.string().max(250).optional().default('')
}).strict();

export async function POST(req:NextRequest){
 try{
  // Browser submissions are same-origin. Reject cross-site forms.
  const origin=req.headers.get('origin');
  if(origin && new URL(origin).host!==req.headers.get('host'))return NextResponse.json({error:'Origem não permitida.'},{status:403});
  const length=Number(req.headers.get('content-length')||0);
  if(length>4096)return NextResponse.json({error:'Dados muito grandes.'},{status:413});
  const parsed=schema.safeParse(await req.json());
  if(!parsed.success)return NextResponse.json({error:'Confira os dados informados.'},{status:400});
  if(parsed.data.website)return NextResponse.json({ok:true},{status:201});
  // Store only a one-way IP digest for request throttling; no raw IP.
  const ip=req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
  const ipHash=createHash('sha256').update((process.env.INTEREST_RATE_SALT||'condovery-public-interest')+':'+ip).digest('hex');
  const recent=await query<{count:string}>("SELECT count(*)::text AS count FROM marketing_leads WHERE ip_hash=$1 AND created_at>now()-interval '1 hour'",[ipHash]);
  if(Number(recent.rows[0]?.count||0)>=5)return NextResponse.json({error:'Muitas solicitações. Tente novamente mais tarde.'},{status:429});
  await query('INSERT INTO marketing_leads(name,condominium,contact,role,ip_hash) VALUES($1,$2,$3,$4,$5)',[
   parsed.data.name,parsed.data.condominium,parsed.data.contact,parsed.data.role,ipHash
  ]);
  return NextResponse.json({ok:true},{status:201,headers:{'Cache-Control':'no-store'}});
 }catch{
  return NextResponse.json({error:'Não foi possível registrar seu interesse agora.'},{status:503});
 }
}
