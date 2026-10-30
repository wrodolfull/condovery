/** Persist one uncertain order POST per authenticated buyer/condominium.
 * Do not generate another idempotency key when a response is lost. */
export type CheckoutAttempt={key:string;body:Record<string,unknown>};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const checkoutAttemptStorageKey=(userId:string,condominiumId:string)=>
  'condovery_checkout_attempt:'+userId+':'+condominiumId;

export function parseCheckoutAttempt(raw:string|null):CheckoutAttempt|null {
  if(!raw)return null;
  try{
    const data=JSON.parse(raw) as CheckoutAttempt;
    if(!data||typeof data!=='object'||!uuid.test(data.key)||!data.body||
      typeof data.body!=='object'||Array.isArray(data.body)||
      data.body.client_order_key!==data.key||
      typeof data.body.shop_id!=='string'||!uuid.test(data.body.shop_id)||
      !Array.isArray(data.body.items)||!data.body.items.length||
      !Number.isSafeInteger(data.body.expected_total_cents)||
      Number(data.body.expected_total_cents)<0)return null;
    return data;
  }catch{return null;}
}
