/**
 * Retain history pages loaded by the resident while bringing in fresh statuses
 * and newly-created orders from the most recent API page.
 */
export function mergeRefreshedOrders<T extends {id:string}>(
  newest:T[], current:T[], keepHistoricalPages:boolean,
):T[]{
  if(!keepHistoricalPages)return newest;
  const ids=new Set(newest.map(order=>order.id));
  return [...newest,...current.filter(order=>!ids.has(order.id))];
}
