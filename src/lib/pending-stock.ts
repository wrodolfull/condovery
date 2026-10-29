/**
 * Pending orders temporarily claim finite stock while the seller decides.
 * Confirmed orders are already deducted from products.stock by the seller.
 * Infinite stock (null) is never reserved or clamped.
 *
 * This is an allocation, not an expiry: cancellation releases it; confirmation
 * converts it to a stock decrement in the same transaction.
 */
export function availableForNewOrders(stock:number|null, pending:number):number|null {
  if(stock===null)return null;
  return Math.max(0,stock-pending);
}

/** SQL projection for resident-facing catalog/shops/home/favorites. */
export const buyerAvailableStockSQL =
  "CASE WHEN p.stock IS NULL THEN NULL ELSE GREATEST(0,p.stock-COALESCE((" +
  "SELECT SUM(oi.quantity) FROM order_items oi JOIN orders pending ON pending.id=oi.order_id " +
  "WHERE oi.product_id=p.id AND pending.condominium_id=p.condominium_id " +
  "AND pending.shop_id=p.shop_id AND pending.status='awaiting_confirmation'" +
  "),0))::int END AS stock";
