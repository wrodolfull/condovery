import { z } from 'zod';

export const BRL = (cents: number) => new Intl.NumberFormat('pt-BR', {
  style:'currency',currency:'BRL'
}).format(cents / 100);

export function normalizeWhatsApp(phone: string): string {
  const digits=phone.replace(/\D/g,'');
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return '55' + digits;
  throw new Error('O vendedor deve cadastrar um WhatsApp brasileiro válido.');
}

const choiceSchema = z.object({
  id:z.string().uuid(), name:z.string().trim().min(1).max(70),
  price_cents:z.number().int().min(0).max(1_000_000),
  available:z.boolean().optional()
}).strict();
const groupSchema = z.object({
  id:z.string().uuid(), name:z.string().trim().min(2).max(65),
  required:z.boolean(), multiple:z.boolean(),
  min_select:z.number().int().min(0).max(30).optional(),
  max_select:z.number().int().min(1).max(30).optional(),
  allow_quantity:z.boolean().optional(),
  options:z.array(choiceSchema).min(1).max(15)
}).strict().superRefine((g,ctx)=>{
  const min=g.min_select??(g.required?1:0);
  const max=g.max_select??(g.multiple?(g.allow_quantity?30:g.options.length):1);
  if(new Set(g.options.map(o=>o.id)).size!==g.options.length)
    ctx.addIssue({code:'custom',message:'Opções repetidas no grupo.'});
  if(min>max)ctx.addIssue({code:'custom',message:'O mínimo não pode superar o máximo.'});
  if(g.required&&min<1)ctx.addIssue({code:'custom',message:'Grupo obrigatório precisa ter mínimo de 1 escolha.'});
  if(!g.multiple&&(max!==1||min>1||g.allow_quantity))
    ctx.addIssue({code:'custom',message:'Escolha única permite somente uma opção sem quantidade.'});
});
export const optionGroupsSchema=z.array(groupSchema).max(8)
  .refine(groups=>new Set(groups.map(g=>g.id)).size===groups.length,
    {message:'Grupos de personalização repetidos.'});
export type OptionGroup=z.infer<typeof groupSchema>;
/** Duplicate option IDs encode multiple units without changing the checkout API contract. */
export type Selection=Record<string,string[]>;
export type ChosenOption={group:string;name:string;price_cents:number;quantity?:number};

export function selectionBounds(group:OptionGroup){
  return {min:group.min_select??(group.required?1:0),
    max:group.max_select??(group.multiple?(group.allow_quantity?30:group.options.length):1)};
}
export function changeOptionSelection(group:OptionGroup,current:string[],id:string,delta:1|-1):string[]{
  const option=group.options.find(o=>o.id===id);
  if(!option||option.available===false)return current;
  const {max}=selectionBounds(group);
  if(group.multiple&&group.allow_quantity){
    if(delta===1)return current.length<max?[...current,id]:current;
    const index=current.lastIndexOf(id);
    return index<0?current:[...current.slice(0,index),...current.slice(index+1)];
  }
  if(!group.multiple)return delta===1?[id]:[];
  if(delta===-1||current.includes(id))return current.filter(v=>v!==id);
  return current.length<max?[...current,id]:current;
}

export function selectedOptions(groups:OptionGroup[],selections:Selection={}):ChosenOption[]{
  if(selections===null||typeof selections!=='object'||Array.isArray(selections))
    throw new Error('Personalização inválida.');
  if(Object.keys(selections).some(id=>!groups.some(g=>g.id===id)))
    throw new Error('Grupo de personalização inválido.');
  const selected:ChosenOption[]=[];
  for(const group of groups){
    const chosen=selections[group.id]??[];
    if(!Array.isArray(chosen)||chosen.some(id=>typeof id!=='string'))
      throw new Error('Seleção inválida.');
    const {min,max}=selectionBounds(group);
    if(chosen.length<min)throw new Error('Selecione pelo menos '+min+' em '+group.name+'.');
    if(chosen.length>max)throw new Error('Selecione no máximo '+max+' em '+group.name+'.');
    if(!group.multiple&&chosen.length>1)
      throw new Error('Escolha apenas uma opção de '+group.name+'.');
    if(!group.allow_quantity&&new Set(chosen).size!==chosen.length)
      throw new Error('Opções repetidas.');
    const counts=new Map<string,number>();
    for(const id of chosen){
      const option=group.options.find(o=>o.id===id);
      if(!option||option.available===false)
        throw new Error('Uma opção de '+group.name+' não está mais disponível.');
      counts.set(id,(counts.get(id)??0)+1);
    }
    for(const [id,quantity] of counts){
      const option=group.options.find(o=>o.id===id)!;
      selected.push({group:group.name,name:option.name,price_cents:option.price_cents,
        ...(quantity>1?{quantity}:{})});
    }
  }
  return selected;
}
export function extrasTotal(options:ChosenOption[]):number{
  return options.reduce((sum,opt)=>sum+opt.price_cents*(opt.quantity??1),0);
}
// Arrival instructions follow the order into the vendor WhatsApp message.
export const arrivalInstructionOptions=[
  'Bater na porta','Tocar a campainha','Não tocar a campainha',
  'Deixar na porta','Entregar pessoalmente','Retirar na portaria'
] as const;
export function validArrivalInstructions(values:readonly string[]):boolean{
  return new Set(values).size===values.length &&
    values.every(v=>(arrivalInstructionOptions as readonly string[]).includes(v)) &&
    !(values.includes('Tocar a campainha') &&
      (values.includes('Não tocar a campainha')||values.includes('Bater na porta')));
}
export function toggleArrivalInstruction(current:string[],choice:string,checked:boolean):string[]{
  if(!checked)return current.filter(v=>v!==choice);
  const next=current.filter(v=>v!==choice &&
    !(choice==='Tocar a campainha'&&(v==='Não tocar a campainha'||v==='Bater na porta')) &&
    !(choice==='Não tocar a campainha'&&v==='Tocar a campainha') &&
    !(choice==='Bater na porta'&&v==='Tocar a campainha'));
  return [...next,choice];
}
export type MessageItem = {
  name:string;quantity:number;unit_price_cents:number;note?:string;
  options?:ChosenOption[]
};
export function orderMessage(order: {
  code:number|string; shop:string; buyer:string; tower:string; apartment:string;
  items:MessageItem[]; total_cents:number; subtotal_cents?:number;delivery_fee_cents?:number;
  fulfillment:'delivery'|'pickup';delivery_day?:string|null;delivery_window?:string;
  instructions?:string[];note?:string;payment_method?:'pix'|'credit_card'|'debit_card'|'cash'|null
}): string {
  const lines=[
    'Olá! Fiz um pedido pelo Elevadoor.','','Pedido #'+order.code+' — '+order.shop,
    'Morador: '+order.buyer,'Itens:',
    ...order.items.flatMap(i=>[
      '• '+i.quantity+'x '+i.name+' — '+BRL(i.unit_price_cents*i.quantity),
      ...(i.options?.length?[...i.options.map(o=>'  - '+o.group+': '+(o.quantity&&o.quantity>1?o.quantity+'x ':'')+o.name+(o.price_cents?' (+'+BRL(o.price_cents*(o.quantity??1))+')':''))]:[]),
      ...(i.note?['  Obs.: '+i.note]:[])
    ]),
    '',
    ...(order.subtotal_cents!==undefined?['Subtotal: '+BRL(order.subtotal_cents)]:[]),
    ...(order.fulfillment==='delivery'?['Taxa de entrega: '+BRL(order.delivery_fee_cents??0)]:[]),
    'Total: '+BRL(order.total_cents),
    ...(order.payment_method?['Forma de pagamento: '+({pix:'Pix',credit_card:'Cartão de crédito',debit_card:'Cartão de débito',cash:'Dinheiro'}[order.payment_method])]:[]),
    'Recebimento: '+(order.fulfillment==='delivery'?'Entrega no condomínio':'Retirada')
  ];
  if(order.fulfillment==='delivery') lines.push('Endereço: '+order.tower+', apto '+order.apartment);
  if(order.delivery_day) {
    const iso=String(order.delivery_day).slice(0,10);
    const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    lines.push('Data preferida: '+(match?match[3]+'/'+match[2]+'/'+match[1]:iso));
  }
  if(order.delivery_window) lines.push('Horário preferido: '+order.delivery_window);
  if(order.fulfillment==='delivery'&&order.instructions?.length)lines.push('Instruções: '+order.instructions.join('; '));
  if(order.note) lines.push('Observações: '+order.note);
  lines.push('','Pode confirmar a disponibilidade e combinar o pagamento?');
  return lines.join('\n');
}
export function unitPrice(product:{price_cents:number;promo_price_cents:number|null}){
  return product.promo_price_cents && product.promo_price_cents<product.price_cents
    ?product.promo_price_cents:product.price_cents;
}
