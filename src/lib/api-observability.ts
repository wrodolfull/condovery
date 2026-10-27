/**
 * Low-overhead, privacy-safe API timings.
 *
 * Only canonical, allow-listed route tokens are emitted. All user-controlled
 * path segments (including UUIDs and slugs) become :param. Never log request
 * bodies, full URLs, cookies, headers, or raw error messages here.
 */
const STATIC_ROUTE_TOKENS = new Set([
  'auth','providers','login','logout','register','register-google','google','callback',
  'password','request','confirm','recovery','verify','public','condominium',
  'me','home','catalog','favorites','orders','shops','mine','reviews','products',
  'admin','summary','reports','users','categories','towers','invite',
  'platform','condominiums','switch','media','ads','settings','giveaways',
  'visibility','checkout','quote','status','profile','delete','complete','cancel',
  'payments','campaigns','impressions','click','shop','search'
]);

export type ApiRequestMetric = {
  event: 'condovery_api_request';
  kind: 'error'|'slow'|'sample';
  method: string;
  route: string;
  status: number;
  duration_ms: number;
};

export function safeApiRoute(parts: readonly string[]): string {
  if(!parts.length)return '/api';
  const segments=parts.slice(0,5).map(part=>STATIC_ROUTE_TOKENS.has(part)?part:':param');
  return '/api/'+segments.join('/')+(parts.length>5?'/*':'');
}

export function buildApiRequestMetric(
  input:{method:string;parts:readonly string[];status:number;durationMs:number},
  options:{slowMs?:number;sampleRate?:number;random?:()=>number}={}
):ApiRequestMetric|null {
  const slowMs=options.slowMs??1000;
  const sampleRate=options.sampleRate??0.02;
  const kind=input.status>=500?'error':input.durationMs>=slowMs?'slow':'sample';
  if(kind==='sample'&&(sampleRate<=0||(options.random??Math.random)()>=sampleRate))return null;
  return {
    event:'condovery_api_request',kind,method:input.method,
    route:safeApiRoute(input.parts),status:input.status,
    duration_ms:Math.round(Math.max(0,input.durationMs))
  };
}

function numberSetting(raw:string|undefined,fallback:number,min:number,max:number):number {
  if(raw===undefined||raw.trim()==='')return fallback;
  const value=Number(raw);
  return Number.isFinite(value)&&value>=min&&value<=max?value:fallback;
}

export function logApiRequestMetric(input:{
  method:string;parts:readonly string[];status:number;durationMs:number
}):void {
  if(process.env.API_METRICS_ENABLED==='false')return;
  const metric=buildApiRequestMetric(input,{
    slowMs:numberSetting(process.env.API_SLOW_REQUEST_MS,1000,100,60000),
    sampleRate:numberSetting(process.env.API_METRICS_SAMPLE_RATE,0.02,0,1)
  });
  if(!metric)return;
  // One bounded JSON object per selected request; PM2 handles stdout/stderr.
  const message=JSON.stringify(metric);
  if(metric.kind==='error')console.error(message);
  else if(metric.kind==='slow')console.warn(message);
  else console.info(message);
}
