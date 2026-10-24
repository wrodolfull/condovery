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

const choiceSchema=z.object({
  id:z.string().uuid(), name:z.string().trim().min(1).max(70),
  price_cents:z.number().int().min(0).max(1_000_000)
}).strict();
const groupSchema=z.object({
  id:z.string().uuid(), name:z.string().trim().min(2).max(65),
  required:z.boolean(), multiple:z.boolean(),
  options:z.array(choiceSchema).min(1).max(15)
}).strict().refine(g=>new Set(g.options.map(o=>o.id)).size===g.options.length,
  {message:'Opções repetidas no grupo.'});
export const optionGroupsSchema=z.array(groupSchema).max(8)
  .refine(groups=>new Set(groups.map(g=>g.id)).size===groups.length,
    {message:'Grupos de personalização repetidos.'});
export type OptionGroup=z.infer<typeof groupSchema>;
export type Selection=Record<string,string[]>;
export type ChosenOption={group:string;name:string;price_cents:number};

export function selectedOptions(groups:OptionGroup[],selections:Selection={}):ChosenOption[]{
  if(selections===null||typeof selections!=='object'||Array.isArray(selections))throw new Error('Personalização inválida.');
  if(Object.keys(selections).some(id=>!groups.some(g=>g.id===id)))throw new Error('Grupo de personalização inválido.');
  const selected:ChosenOption[]=[];
  for(const group of groups){
    const chosen=selections[group.id]??[];
    if(!Array.isArray(chosen)||chosen.some(id=>typeof id!=='string'))throw new Error('Seleção inválida.');
    if(group.required&&chosen.length===0)throw new Error('Selecione '+group.name+'.');
    if(!group.multiple&&chosen.length>1)throw new Error('Escolha apenas uma opção de '+group.name+'.');
    if(new Set(chosen).size!==chosen.length)throw new Error('Opções repetidas.');
    for(const id of chosen){
      const option=group.options.find(o=>o.id===id);
      if(!option)throw new Error('Uma opção de '+group.name+' não está mais disponível.');
      selected.push({group:group.name,name:option.name,price_cents:option.price_cents});
    }
  }
  return selected;
}
export function extrasTotal(options:ChosenOption[]):number{
  return options.reduce((sum,opt)=>sum+opt.price_cents,0);
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
  instructions?:string[];note?:string
}): string {
  const lines=[
    'Olá! Fiz um pedido pelo Condovery.','','Pedido #'+order.code+' — '+order.shop,
    'Morador: '+order.buyer,'Itens:',
    ...order.items.flatMap(i=>[
      '• '+i.quantity+'x '+i.name+' — '+BRL(i.unit_price_cents*i.quantity),
      ...(i.options?.length?[...i.options.map(o=>'  - '+o.group+': '+o.name+(o.price_cents?' (+'+BRL(o.price_cents)+')':''))]:[]),
      ...(i.note?['  Obs.: '+i.note]:[])
    ]),
    '',
    ...(order.subtotal_cents!==undefined?['Subtotal: '+BRL(order.subtotal_cents)]:[]),
    ...(order.fulfillment==='delivery'?['Taxa de entrega: '+BRL(order.delivery_fee_cents??0)]:[]),
    'Total: '+BRL(order.total_cents),
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
