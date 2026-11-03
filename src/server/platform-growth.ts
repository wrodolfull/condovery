import {NextRequest,NextResponse} from "next/server";
import {bad} from "@/lib/api-error";
import type {Viewer} from "@/lib/auth";
import {query} from "@/lib/db";

export type GrowthPeriod=7|30|90|"all";
export type PlatformGrowthSummary={
  condominiums:number;
  new_residents:number;previous_residents:number;approved_residents:number;
  new_shops:number;previous_shops:number;active_shops:number;
  completed_orders:number;previous_orders:number;
  completed_cents:string;previous_cents:string;
};
export type PlatformGrowthRankingRow={
  id:string;name:string;is_active:boolean;rank:number;
  new_residents:number;new_shops:number;active_shops:number;
  completed_orders:number;completed_cents:string;
};
export type PlatformGrowthReport={
  period:GrowthPeriod;
  generated_at:string;
  summary:PlatformGrowthSummary;
  ranking:PlatformGrowthRankingRow[];
  ranking_limit:number;
  note:string;
};

type DatabaseRow={
  id:string;name:string;is_active:boolean;
  new_residents:number;previous_residents:number;approved_residents:number;
  new_shops:number;previous_shops:number;active_shops:number;
  completed_orders:number;previous_orders:number;
  completed_cents:string;previous_cents:string;
  global_condominiums:string;global_new_residents:string;
  global_previous_residents:string;global_approved_residents:string;
  global_new_shops:string;global_previous_shops:string;global_active_shops:string;
  global_completed_orders:string;global_previous_orders:string;
  global_completed_cents:string;global_previous_cents:string;
};

const RANKING_LIMIT=30;
const CACHE_TTL_MS=120_000;
const MANUAL_REFRESH_COOLDOWN_MS=60_000;
const cache=new Map<GrowthPeriod,{value:PlatformGrowthReport;created:number}>();
const inFlight=new Map<GrowthPeriod,Promise<PlatformGrowthReport>>();

/**
 * One bounded aggregate query, never one query per condominium.
 * All historical order values use the immutable snapshot stored on orders.
 * Completed order values are NOT confirmed receipts or platform revenue.
 */
const GROWTH_SQL=`
WITH residents AS (
  SELECT condominium_id,
    count(*) FILTER (
      WHERE $1::timestamptz IS NULL OR created_at >= $1::timestamptz
    )::int AS new_residents,
    count(*) FILTER (
      WHERE $1::timestamptz IS NOT NULL
        AND created_at >= $2::timestamptz AND created_at < $1::timestamptz
    )::int AS previous_residents,
    count(*) FILTER (WHERE status='approved')::int AS approved_residents
  FROM users
  WHERE role='resident' AND status<>'deleted'
  GROUP BY condominium_id
),
shops_summary AS (
  SELECT condominium_id,
    count(*) FILTER (
      WHERE $1::timestamptz IS NULL OR created_at >= $1::timestamptz
    )::int AS new_shops,
    count(*) FILTER (
      WHERE $1::timestamptz IS NOT NULL
        AND created_at >= $2::timestamptz AND created_at < $1::timestamptz
    )::int AS previous_shops,
    count(*) FILTER (WHERE status='approved')::int AS active_shops
  FROM shops
  WHERE status<>'deleted'
  GROUP BY condominium_id
),
orders_summary AS (
  SELECT condominium_id,
    count(*) FILTER (
      WHERE $1::timestamptz IS NULL OR updated_at >= $1::timestamptz
    )::int AS completed_orders,
    count(*) FILTER (
      WHERE $1::timestamptz IS NOT NULL
        AND updated_at >= $2::timestamptz AND updated_at < $1::timestamptz
    )::int AS previous_orders,
    coalesce(sum(total_cents) FILTER (
      WHERE $1::timestamptz IS NULL OR updated_at >= $1::timestamptz
    ),0)::bigint AS completed_cents,
    coalesce(sum(total_cents) FILTER (
      WHERE $1::timestamptz IS NOT NULL
        AND updated_at >= $2::timestamptz AND updated_at < $1::timestamptz
    ),0)::bigint AS previous_cents
  FROM orders
  WHERE status='completed'
    AND ($2::timestamptz IS NULL OR updated_at >= $2::timestamptz)
  GROUP BY condominium_id
),
tenant_metrics AS (
  SELECT c.id,c.name,c.is_active,
    coalesce(r.new_residents,0)::int AS new_residents,
    coalesce(r.previous_residents,0)::int AS previous_residents,
    coalesce(r.approved_residents,0)::int AS approved_residents,
    coalesce(s.new_shops,0)::int AS new_shops,
    coalesce(s.previous_shops,0)::int AS previous_shops,
    coalesce(s.active_shops,0)::int AS active_shops,
    coalesce(o.completed_orders,0)::int AS completed_orders,
    coalesce(o.previous_orders,0)::int AS previous_orders,
    coalesce(o.completed_cents,0)::bigint AS completed_cents,
    coalesce(o.previous_cents,0)::bigint AS previous_cents
  FROM condominiums c
  LEFT JOIN residents r ON r.condominium_id=c.id
  LEFT JOIN shops_summary s ON s.condominium_id=c.id
  LEFT JOIN orders_summary o ON o.condominium_id=c.id
)
SELECT t.*,
  count(*) OVER()::bigint AS global_condominiums,
  sum(new_residents) OVER()::bigint AS global_new_residents,
  sum(previous_residents) OVER()::bigint AS global_previous_residents,
  sum(approved_residents) OVER()::bigint AS global_approved_residents,
  sum(new_shops) OVER()::bigint AS global_new_shops,
  sum(previous_shops) OVER()::bigint AS global_previous_shops,
  sum(active_shops) OVER()::bigint AS global_active_shops,
  sum(completed_orders) OVER()::bigint AS global_completed_orders,
  sum(previous_orders) OVER()::bigint AS global_previous_orders,
  sum(completed_cents) OVER()::numeric AS global_completed_cents,
  sum(previous_cents) OVER()::numeric AS global_previous_cents
FROM tenant_metrics t
ORDER BY completed_cents DESC,completed_orders DESC,new_residents DESC,name ASC,id ASC
LIMIT ${RANKING_LIMIT}
`;

function periodBounds(period:GrowthPeriod,now:number):[string|null,string|null]{
  if(period==="all")return [null,null];
  const start=new Date(now-period*86_400_000).toISOString();
  const previous=new Date(now-period*2*86_400_000).toISOString();
  return [start,previous];
}
function numeric(value:unknown):number{
  const n=Number(value??0);
  return Number.isSafeInteger(n)&&n>=0?n:0;
}
async function fetchPlatformGrowth(period:GrowthPeriod,now:number):Promise<PlatformGrowthReport>{
  const bounds=periodBounds(period,now);
  const r=await query<DatabaseRow>(GROWTH_SQL,bounds);
  const first=r.rows[0];
  const summary:PlatformGrowthSummary=first?{
    condominiums:numeric(first.global_condominiums),
    new_residents:numeric(first.global_new_residents),
    previous_residents:numeric(first.global_previous_residents),
    approved_residents:numeric(first.global_approved_residents),
    new_shops:numeric(first.global_new_shops),
    previous_shops:numeric(first.global_previous_shops),
    active_shops:numeric(first.global_active_shops),
    completed_orders:numeric(first.global_completed_orders),
    previous_orders:numeric(first.global_previous_orders),
    completed_cents:String(first.global_completed_cents),
    previous_cents:String(first.global_previous_cents),
  }:{
    condominiums:0,new_residents:0,previous_residents:0,approved_residents:0,
    new_shops:0,previous_shops:0,active_shops:0,
    completed_orders:0,previous_orders:0,completed_cents:"0",previous_cents:"0",
  };
  const ranking=r.rows.map((row,index):PlatformGrowthRankingRow=>({
    id:row.id,name:row.name,is_active:row.is_active,rank:index+1,
    new_residents:row.new_residents,new_shops:row.new_shops,
    active_shops:row.active_shops,
    completed_orders:row.completed_orders,completed_cents:String(row.completed_cents),
  }));
  return {
    period,generated_at:new Date(now).toISOString(),summary,ranking,ranking_limit:RANKING_LIMIT,
    note:"Os valores somam pedidos concluídos no Elevadoor, não pagamentos confirmados ou receitas recebidas. O período de conclusão utiliza a última atualização do pedido.",
  };
}

/** Shared in-flight Promise deduplicates concurrent requests across browser sessions.
 * Cache bounded to four possible periods, two-minute TTL; explicit refresh is
 * allowed only after 60 seconds. No interval, cron, N+1 or automatic polling.
 */
export async function getCachedPlatformGrowth(period:GrowthPeriod,refresh=false):Promise<PlatformGrowthReport>{
  const now=Date.now();
  const cached=cache.get(period);
  if(cached&&now-cached.created<(refresh?MANUAL_REFRESH_COOLDOWN_MS:CACHE_TTL_MS))
    return cached.value;
  const pending=inFlight.get(period);
  if(pending)return pending;
  const promise=fetchPlatformGrowth(period,now).then(value=>{
    cache.set(period,{value,created:Date.now()});
    return value;
  });
  inFlight.set(period,promise);
  try{return await promise;}finally{inFlight.delete(period);}
}

export async function handlePlatformGrowth(req:NextRequest,method:string,path:string,u:Viewer):
  Promise<NextResponse|null>{
  if(path!=="platform/growth")return null;
  if(method!=="GET")bad("Método não permitido.",405);
  if(!u.is_superadmin||u.status!=="approved")bad("Acesso restrito ao superadmin.",403);
  const requested=req.nextUrl.searchParams.get("period")??"30";
  if(!["7","30","90","all"].includes(requested))bad("Período inválido.",400);
  const refresh=req.nextUrl.searchParams.get("refresh");
  if(refresh!==null&&refresh!=="1")bad("Atualização inválida.",400);
  const period=requested==="all"?"all":Number(requested) as GrowthPeriod;
  const data=await getCachedPlatformGrowth(period,refresh==="1");
  return NextResponse.json(data,{headers:{"Cache-Control":"private, no-store"}});
}
