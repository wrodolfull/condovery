/** Stable, backwards-compatible order history pagination using the globally
 * unique monotonically allocated orders.code. Cursor is opaque to clients. */
export const ORDER_PAGE_SIZE = 20;
export const MAX_ORDER_PAGE_SIZE = 50;
const MAX_ORDER_CODE = 9223372036854775807n;

export type OrderPaging = { limit: number; cursor: string | null };
export function parseOrderPaging(params: URLSearchParams): OrderPaging | null {
  const rawLimit = params.get("limit");
  const rawCursor = params.get("cursor");
  const limit = rawLimit === null ? ORDER_PAGE_SIZE : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_ORDER_PAGE_SIZE)
    return null;
  if (rawCursor !== null) {
    if (!/^[1-9][0-9]{0,18}$/.test(rawCursor)) return null;
    if (BigInt(rawCursor) > MAX_ORDER_CODE) return null;
  }
  return {limit,cursor:rawCursor};
}

export function orderPage<T extends { code: string | number | bigint }>(
  rows: T[], limit: number,
): { orders: T[]; nextCursor: string | null; hasMore: boolean } {
  const orders = rows.slice(0,limit);
  const hasMore = rows.length > limit;
  return {orders,hasMore,nextCursor:hasMore ? String(orders[orders.length-1].code) : null};
}
