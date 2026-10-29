import {PAYMENT_METHODS,type PaymentMethod} from './payment-methods';

export type ShopDraft={
  name:string;description:string;whatsapp:string;is_open:boolean;
  delivery_enabled:boolean;delivery_fee_cents:number;pickup_enabled:boolean;
  lead_time:string;pickup_instructions:string;cover_image:string;logo_image:string;
  payment_methods:PaymentMethod[];
};
export const blankShopDraft=():ShopDraft=>({
  name:'',description:'',whatsapp:'',is_open:true,
  delivery_enabled:true,delivery_fee_cents:0,pickup_enabled:true,
  lead_time:'',pickup_instructions:'',cover_image:'',logo_image:'',
  payment_methods:['pix','credit_card','debit_card','cash']
});
export function shopDraftKey(userId:string,condoId:string,shopId:string|null) {
  return 'condovery.shop.draft.v1.'+userId+'.'+condoId+'.'+(shopId??'new');
}
export function readShopDraft(raw:string|null):ShopDraft|null {
  if(!raw || raw.length>6000)return null;
  try{
    const value:unknown=JSON.parse(raw);
    if(!value||typeof value!=='object'||Array.isArray(value))return null;
    const draft=value as Record<string,unknown>;
    for(const field of ['name','description','whatsapp','lead_time','pickup_instructions','cover_image','logo_image']){
      if(typeof draft[field]!=='string'||(draft[field] as string).length>1000)return null;
    }
    for(const field of ['is_open','delivery_enabled','pickup_enabled']){
      if(typeof draft[field]!=='boolean')return null;
    }
    if(typeof draft.delivery_fee_cents!=='number'||!Number.isSafeInteger(draft.delivery_fee_cents)||Number(draft.delivery_fee_cents)<0||Number(draft.delivery_fee_cents)>1_000_000)return null;
    if(!Array.isArray(draft.payment_methods)||draft.payment_methods.length>4||
      !draft.payment_methods.every(method=>typeof method==='string'&&PAYMENT_METHODS.includes(method as PaymentMethod)))return null;
    return draft as ShopDraft;
  }catch{return null;}
}
export function shopDraftEquals(a:ShopDraft,b:ShopDraft){
  return Object.keys(a).every(key=>JSON.stringify(a[key as keyof ShopDraft])===JSON.stringify(b[key as keyof ShopDraft]));
}
