import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {query,transaction} from '@/lib/db';
import {bad} from '@/lib/api-error';
import type {Viewer} from '@/lib/auth';

type Args={req:NextRequest;method:string;path:string;parts:string[];u:Viewer};
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imagePattern=/^\/api\/media\/([0-9a-f-]{36})$/i;
const campaignSchema=z.object({
  condominium_id:z.string().uuid(),
  merchant_name:z.string().trim().min(2).max(100),
  headline:z.string().trim().min(2).max(140),
  description:z.string().trim().max(400),
  location:z.string().trim().min(2).max(120),
  image_url:z.string().regex(imagePattern,'Envie a imagem pelo upload.'),
  destination_url:z.string().url().max(2000).refine(v=>v.startsWith('https://'),'Use link HTTPS.'),
  starts_at:z.string().datetime({offset:true}),
  expires_at:z.string().datetime({offset:true}),
  enabled:z.boolean().default(false),
  contract_amount_cents:z.number().int().min(0).max(2147483647).default(0),
  billing_status:z.enum(['pending','invoiced','paid']).default('pending'),
  commercial_partner:z.string().trim().max(120).default('')
});
type CampaignInput=z.infer<typeof campaignSchema>;
const respond=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const read=(req:NextRequest)=>req.json().catch(()=>bad('JSON inválido.'));
function superadmin(u:Viewer){if(!u.is_superadmin||u.status!=='approved')bad('Acesso exclusivo do superadmin.',403);}
async function verifyImage(image:string,tenantId:string){
  const mediaId=imagePattern.exec(image)?.[1];
  if(!mediaId)bad('Envie a imagem pelo upload.');
  const found=await query('SELECT id FROM media_assets WHERE id=$1 AND condominium_id=$2 AND shop_id IS NULL AND user_id IS NULL',[mediaId,tenantId]);
  if(!found.rowCount)bad('A imagem não pertence a este condomínio.',403);
}
async function validateCampaign(input:CampaignInput){
  if(new Date(input.expires_at)<=new Date(input.starts_at))bad('A expiração deve ser posterior ao início.');
  const condo=await query('SELECT id FROM condominiums WHERE id=$1 AND is_active=true',[input.condominium_id]);
  if(!condo.rowCount)bad('Condomínio inválido.');
}
async function recordMetric(req:NextRequest,u:Viewer,id:string,kind:'impression'|'click'){
  if(u.status!=='approved')bad('Conta indisponível.',403);
  const token=req.cookies.get('condovery_session')?.value;
  if(!token)bad('Sessão inválida.',401);
  const day=new Date().toISOString().slice(0,10);
  // Hash a high-entropy cookie with day; no raw cookie or user identifier is stored.
  const viewerHash=createHash('sha256').update(day+':'+token).digest('hex');
  await transaction(async tx=>{
    const allowed=await tx.query(
      'SELECT a.id FROM advertising_campaigns a JOIN ads_settings s ON s.id=true AND s.enabled=true WHERE a.id=$1 AND a.condominium_id=$2 AND a.enabled=true AND a.starts_at<=now() AND a.expires_at>now()',
      [id,u.condominium_id]);
    if(!allowed.rowCount)bad('Anúncio indisponível.',404);
    const event=await tx.query(
      'INSERT INTO ad_metric_dedupe(campaign_id,day,event_type,viewer_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING campaign_id',
      [id,day,kind,viewerHash]);
    if(event.rowCount){
      await tx.query(
        'INSERT INTO ad_metric_daily(campaign_id,day,impressions,clicks) VALUES($1,$2,$3,$4) '+
        'ON CONFLICT(campaign_id,day) DO UPDATE SET impressions=ad_metric_daily.impressions+EXCLUDED.impressions,clicks=ad_metric_daily.clicks+EXCLUDED.clicks',
        [id,day,kind==='impression'?1:0,kind==='click'?1:0]);
    }
  });
  return respond({ok:true});
}
export async function handleAdsApi({req,method,path,parts,u}:Args):Promise<NextResponse|null>{
  if(path==='ads'&&method==='GET'){
    const result=await query(
      "SELECT a.id,a.merchant_name,a.headline,a.description,a.location,a.image_url,a.destination_url FROM advertising_campaigns a JOIN ads_settings s ON s.id=true AND s.enabled=true WHERE a.condominium_id=$1 AND a.enabled=true AND a.starts_at<=now() AND a.expires_at>now() ORDER BY a.created_at DESC LIMIT 20",
      [u.condominium_id]);
    return respond({campaigns:result.rows});
  }
  if(parts[0]==='ads'&&parts.length===3&&method==='POST'&&['impression','click'].includes(parts[2])){
    if(!idPattern.test(parts[1]))bad('Anúncio inválido.');
    return recordMetric(req,u,parts[1],parts[2] as 'impression'|'click');
  }
  if(!path.startsWith('platform/ads'))return null;
  superadmin(u);
  if(path==='platform/ads'&&method==='GET'){
    const [settings,campaigns]=await Promise.all([
      query('SELECT enabled FROM ads_settings WHERE id=true'),
      query("SELECT a.*, COALESCE((SELECT sum(m.impressions) FROM ad_metric_daily m WHERE m.campaign_id=a.id),0)::int AS impressions, COALESCE((SELECT sum(m.clicks) FROM ad_metric_daily m WHERE m.campaign_id=a.id),0)::int AS clicks FROM advertising_campaigns a ORDER BY a.created_at DESC LIMIT 300")
    ]);
    return respond({enabled:settings.rows[0]?.enabled??false,campaigns:campaigns.rows});
  }
  if(path==='platform/ads/reports'&&method==='GET'){
    const [condominiums,partners,totals]=await Promise.all([
      query("SELECT a.condominium_id,c.name AS condominium_name,count(*)::int AS campaigns,sum(a.contract_amount_cents)::bigint AS contracted_cents,sum(CASE WHEN a.billing_status='paid' THEN a.contract_amount_cents ELSE 0 END)::bigint AS received_cents,sum(COALESCE(m.impressions,0))::bigint AS impressions,sum(COALESCE(m.clicks,0))::bigint AS clicks FROM advertising_campaigns a JOIN condominiums c ON c.id=a.condominium_id LEFT JOIN (SELECT campaign_id,sum(impressions) AS impressions,sum(clicks) AS clicks FROM ad_metric_daily GROUP BY campaign_id) m ON m.campaign_id=a.id GROUP BY a.condominium_id,c.name ORDER BY c.name"),
      query("SELECT commercial_partner,count(*)::int AS campaigns,sum(contract_amount_cents)::bigint AS contracted_cents,sum(CASE WHEN billing_status='paid' THEN contract_amount_cents ELSE 0 END)::bigint AS received_cents FROM advertising_campaigns WHERE commercial_partner<>'' GROUP BY commercial_partner ORDER BY commercial_partner"),
      query("SELECT count(*)::int AS campaigns,COALESCE(sum(contract_amount_cents),0)::bigint AS contracted_cents,COALESCE(sum(CASE WHEN billing_status='paid' THEN contract_amount_cents ELSE 0 END),0)::bigint AS received_cents FROM advertising_campaigns")
    ]);
    return respond({condominiums:condominiums.rows,partners:partners.rows,totals:totals.rows[0]});
  }
  if(path==='platform/ads/settings'&&method==='PATCH'){
    const b=z.object({enabled:z.boolean()}).strict().parse(await read(req));
    await query('UPDATE ads_settings SET enabled=$1,updated_at=now() WHERE id=true',[b.enabled]);
    return respond({ok:true});
  }
  if(path==='platform/ads'&&method==='POST'){
    const b=campaignSchema.strict().parse(await read(req));
    await validateCampaign(b);await verifyImage(b.image_url,b.condominium_id);
    const result=await query(
      'INSERT INTO advertising_campaigns(condominium_id,merchant_name,headline,description,location,image_url,destination_url,starts_at,expires_at,enabled,contract_amount_cents,billing_status,commercial_partner) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id',
      [b.condominium_id,b.merchant_name,b.headline,b.description,b.location,b.image_url,b.destination_url,b.starts_at,b.expires_at,b.enabled,b.contract_amount_cents,b.billing_status,b.commercial_partner]);
    return respond({id:result.rows[0].id},201);
  }
  if(parts[0]==='platform'&&parts[1]==='ads'&&parts.length===3&&idPattern.test(parts[2])){
    const id=parts[2];
    if(method==='PATCH'){
      const patch=campaignSchema.partial().strict().parse(await read(req));
      if(!Object.keys(patch).length)bad('Informe os campos para atualizar.');
      const found=await query('SELECT * FROM advertising_campaigns WHERE id=$1',[id]);
      if(!found.rowCount)bad('Anúncio não encontrado.',404);
      const current=found.rows[0];
      // Legacy externally hosted ads may keep their existing URL without changes.
      const next={...current,...patch};
      const dates={...next,starts_at:new Date(next.starts_at).toISOString(),expires_at:new Date(next.expires_at).toISOString()};
      if(!imagePattern.test(next.image_url)&&next.image_url===current.image_url){
        const parsed=campaignSchema.omit({image_url:true}).parse(dates);
        await validateCampaign({...parsed,image_url:next.image_url});
      }else{
        const parsed=campaignSchema.parse(dates);
        await validateCampaign(parsed);await verifyImage(parsed.image_url,parsed.condominium_id);
      }
      const result=await query(
        'UPDATE advertising_campaigns SET condominium_id=$1,merchant_name=$2,headline=$3,description=$4,location=$5,image_url=$6,destination_url=$7,starts_at=$8,expires_at=$9,enabled=$10,contract_amount_cents=$11,billing_status=$12,commercial_partner=$13,updated_at=now() WHERE id=$14 RETURNING id',
        [next.condominium_id,next.merchant_name,next.headline,next.description,next.location,next.image_url,next.destination_url,next.starts_at,next.expires_at,next.enabled,next.contract_amount_cents,next.billing_status,next.commercial_partner,id]);
      if(!result.rowCount)bad('Anúncio não encontrado.',404);
      return respond({ok:true});
    }
    if(method==='DELETE'){
      const deleted=await query('DELETE FROM advertising_campaigns WHERE id=$1 RETURNING id',[id]);
      if(!deleted.rowCount)bad('Anúncio não encontrado.',404);
      return respond({ok:true});
    }
  }
  return null;
}
