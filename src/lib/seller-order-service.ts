export const SELLER_ORDER_WAIT_ALERT_MINUTES=20;

/** A passive indicator only: no auto-cancellation, job or notification is created. */
export function sellerOrderNeedsAttention(
  order:{status:string;created_at:string},
  now=Date.now(),
):boolean {
  if(order.status!=="awaiting_confirmation")return false;
  const created=new Date(order.created_at).getTime();
  return Number.isFinite(created)&&now-created>=SELLER_ORDER_WAIT_ALERT_MINUTES*60_000;
}

/** Seller-only buyer contact. Reject malformed phone data instead of opening another URL. */
export function sellerBuyerWhatsApp(phone:string|undefined|null,orderCode:number):string|null{
  const digits=(phone??"").replace(/\D/g,"");
  const normalized=/^55\d{10,11}$/.test(digits)?digits:/^\d{10,11}$/.test(digits)?"55"+digits:null;
  if(!normalized)return null;
  const text=encodeURIComponent("Olá! Sobre o seu pedido #"+orderCode+" no Elevadoor:");
  return "https://wa.me/"+normalized+"?text="+text;
}
