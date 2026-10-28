import {createHash} from 'node:crypto';
import {query} from '@/lib/db';
import {bad} from '@/lib/api-error';

export type ReportRange='7'|'30'|'90'|'all';
export type DailyAdMetrics={day:string;impressions:number;clicks:number};
export type AdvertiserReport={
  campaign:{id:string;merchant_name:string;headline:string;condominium_name:string;starts_at:string;expires_at:string};
  period:{from:string;to:string;range:ReportRange};
  totals:{impressions:number;clicks:number;ctr:number};
  daily:DailyAdMetrics[];
  daily_truncated:boolean;
  disclaimer:string;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day=(date:Date)=>date.toISOString().slice(0,10);

export function reportRange(input:string|null):ReportRange{
  if(input===null)return '30';
  if(input==='7'||input==='30'||input==='90'||input==='all')return input;
  bad('Período inválido.');
}
export async function advertiserReport(campaignId:string,range:ReportRange):Promise<AdvertiserReport>{
  if(!uuid.test(campaignId))bad('Campanha inválida.');
  const found=await query<{id:string;merchant_name:string;headline:string;condominium_name:string;starts_at:Date;expires_at:Date}>(
    'SELECT a.id,a.merchant_name,a.headline,c.name AS condominium_name,a.starts_at,a.expires_at '+
    'FROM advertising_campaigns a JOIN condominiums c ON c.id=a.condominium_id WHERE a.id=$1',
    [campaignId]);
  if(!found.rowCount)bad('Campanha não encontrada.',404);
  const campaign=found.rows[0];
  const now=new Date();
  const effectiveEnd=new Date(Math.min(now.getTime(),new Date(campaign.expires_at).getTime()));
  const campaignStart=day(new Date(campaign.starts_at));
  const end=day(effectiveEnd);
  const rangeStart=new Date(effectiveEnd);
  if(range!=='all')rangeStart.setUTCDate(rangeStart.getUTCDate()-Number(range)+1);
  const start=range==='all'?campaignStart:day(rangeStart)>campaignStart?day(rangeStart):campaignStart;
  const dates=start<=end;
  const rows=dates?await query<{day:string;impressions:number;clicks:number}>(
    "SELECT to_char(day,'YYYY-MM-DD') AS day,impressions,clicks FROM ad_metric_daily "+
    "WHERE campaign_id=$1 AND day BETWEEN $2::date AND $3::date ORDER BY day ASC",
    [campaignId,start,end]):{rows:[]};
  const data=new Map(rows.rows.map(r=>[r.day,{impressions:Number(r.impressions),clicks:Number(r.clicks)}]));
  const daily:DailyAdMetrics[]=[];
  if(dates){
    // Cap chart/table payload to the 400 most recent days without truncating totals.
    const last=new Date(end+'T00:00:00Z');
    const first=new Date(last);
    first.setUTCDate(first.getUTCDate()-399);
    const cursor=new Date(Math.max(new Date(start+'T00:00:00Z').getTime(),first.getTime()));
    while(cursor<=last){
      const date=day(cursor),metric=data.get(date);
      daily.push({day:date,impressions:metric?.impressions??0,clicks:metric?.clicks??0});
      cursor.setUTCDate(cursor.getUTCDate()+1);
    }
  }
  const totals=rows.rows.reduce((sum,r)=>({
    impressions:sum.impressions+Number(r.impressions),
    clicks:sum.clicks+Number(r.clicks)
  }),{impressions:0,clicks:0});
  return {
    campaign:{id:campaign.id,merchant_name:campaign.merchant_name,headline:campaign.headline,condominium_name:campaign.condominium_name,
      starts_at:new Date(campaign.starts_at).toISOString(),expires_at:new Date(campaign.expires_at).toISOString()},
    period:{from:start,to:end,range},
    totals:{...totals,ctr:totals.impressions?Math.round(totals.clicks/totals.impressions*10000)/100:0},
    daily,
    daily_truncated:dates && (new Date(end+'T00:00:00Z').getTime()-new Date(start+'T00:00:00Z').getTime())/86400000>=400,
    disclaimer:'Impressões e cliques deduplicados por sessão e por dia (UTC). Não equivalem a pessoas únicas ou vendas confirmadas.'
  };
}
export async function campaignFromShare(token:string):Promise<string|null>{
  if(!/^[a-f0-9]{64}$/i.test(token))return null;
  const digest=createHash('sha256').update(token).digest('hex');
  const found=await query<{campaign_id:string}>(
    "SELECT campaign_id FROM ad_report_shares WHERE token_hash=$1 AND revoked_at IS NULL AND expires_at>now() LIMIT 1",
    [digest]);
  return found.rows[0]?.campaign_id??null;
}
