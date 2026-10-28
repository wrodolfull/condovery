import {NextRequest,NextResponse} from 'next/server';
import {query} from '@/lib/db';
import {bad} from '@/lib/api-error';
import type {Viewer} from '@/lib/auth';

export async function handleSellerInsights(req:NextRequest,method:string,path:string,u:Viewer):Promise<NextResponse|null>{
  if(path!=='seller/insights')return null;
  if(method!=='GET')bad('Método não permitido.',405);
  if(u.status!=='approved')bad('Sua conta não está ativa.',403);
  const period=Number(req.nextUrl.searchParams.get('days')||'30');
  if(![7,30,90].includes(period))bad('Período inválido.');
  const shop=await query<{id:string}>(
    "SELECT id FROM shops WHERE condominium_id=$1 AND owner_id=$2 AND status='approved'",
    [u.condominium_id,u.id]);
  if(!shop.rowCount)bad('A loja precisa estar ativa para visualizar os resultados.',403);
  const args=[u.condominium_id,shop.rows[0].id,period];
  const [summary,topProducts,daily]=await Promise.all([
    query("SELECT count(*)::int AS orders_total, "+
      "count(*) FILTER(WHERE status='awaiting_confirmation')::int AS awaiting, "+
      "count(*) FILTER(WHERE status='confirmed')::int AS confirmed, "+
      "count(*) FILTER(WHERE status='completed')::int AS completed, "+
      "count(*) FILTER(WHERE status='cancelled')::int AS cancelled, "+
      "COALESCE(sum(total_cents) FILTER(WHERE status='completed'),0)::bigint AS completed_cents, "+
      "COALESCE(round(avg(total_cents) FILTER(WHERE status='completed')),0)::bigint AS average_cents "+
      "FROM orders WHERE condominium_id=$1 AND shop_id=$2 "+
      "AND created_at >= current_date - (($3::int-1) * interval '1 day')",args),
    query("SELECT oi.product_id,max(oi.name_snapshot) AS name, "+
      "sum(oi.quantity)::int AS units,count(DISTINCT o.id)::int AS orders, "+
      "sum(oi.quantity::bigint*oi.unit_price_cents)::bigint AS amount_cents "+
      "FROM order_items oi JOIN orders o ON o.id=oi.order_id "+
      "WHERE o.condominium_id=$1 AND o.shop_id=$2 AND o.status='completed' "+
      "AND o.created_at >= current_date - (($3::int-1) * interval '1 day') "+
      "GROUP BY oi.product_id ORDER BY units DESC,amount_cents DESC LIMIT 5",args),
    query("SELECT (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date AS day, "+
      "count(*)::int AS orders,COALESCE(sum(o.total_cents),0)::bigint AS amount_cents "+
      "FROM orders o WHERE o.condominium_id=$1 AND o.shop_id=$2 AND o.status='completed' "+
      "AND o.created_at >= current_date - (($3::int-1) * interval '1 day') "+
      "GROUP BY day ORDER BY day ASC",args)
  ]);
  return NextResponse.json({days:period,summary:summary.rows[0],topProducts:topProducts.rows,daily:daily.rows},
    {headers:{'Cache-Control':'private, no-store'}});
}
