/** Cursor pagination for tenant-scoped approved shops, preserving open-first ordering. */
export const SHOP_PAGE_SIZE = 24;
export const MAX_SHOP_PAGE_SIZE = 48;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ShopCursor = { isOpen: boolean; createdAt: string; id: string };
export type ShopPaging = { limit: number; cursor: ShopCursor | null };

export function encodeShopCursor(cursor: ShopCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function parseShopPaging(params: URLSearchParams): ShopPaging | null {
  const rawLimit = params.get('limit');
  const limit = rawLimit === null ? SHOP_PAGE_SIZE : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_SHOP_PAGE_SIZE) return null;
  const rawCursor = params.get('cursor');
  if (rawCursor === null) return {limit,cursor:null};
  if (rawCursor.length < 10 || rawCursor.length > 250 || !/^[A-Za-z0-9_-]+$/.test(rawCursor)) return null;
  try {
    if (Buffer.from(rawCursor,'base64url').toString('base64url') !== rawCursor) return null;
    const parsed: unknown = JSON.parse(Buffer.from(rawCursor,'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') return null;
    const value = parsed as Record<string,unknown>;
    if (typeof value.isOpen !== 'boolean' ||
      typeof value.createdAt !== 'string' ||
      value.createdAt.length > 50 ||
      !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(value.createdAt) ||
      !Number.isFinite(Date.parse(value.createdAt)) ||
      typeof value.id !== 'string' || !UUID.test(value.id)) return null;
    return {limit,cursor:{isOpen:value.isOpen,createdAt:value.createdAt,id:value.id}};
  } catch {
    return null;
  }
}

export type ShopPagingRow = { id:string; is_open:boolean; cursor_created_at:string };
export function shopPage<T extends ShopPagingRow>(rows:T[],limit:number): {
  shops:T[]; hasMore:boolean; nextCursor:string|null;
} {
  const shops = rows.slice(0,limit);
  const hasMore = rows.length > limit;
  const last = shops[shops.length-1];
  return {
    shops,hasMore,
    nextCursor:hasMore ? encodeShopCursor({id:last.id,isOpen:last.is_open,createdAt:last.cursor_created_at}) : null
  };
}
