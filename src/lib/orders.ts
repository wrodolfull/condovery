export const BRL = (cents: number) => new Intl.NumberFormat('pt-BR', {
  style:'currency',currency:'BRL'
}).format(cents / 100);

export function normalizeWhatsApp(phone: string): string {
  const digits=phone.replace(/\D/g,'');
  if (/^55\d{10,11}$/.test(digits)) return digits;
  if (/^\d{10,11}$/.test(digits)) return '55' + digits;
  throw new Error('O vendedor deve cadastrar um WhatsApp brasileiro válido.');
}
export type MessageItem = {name:string;quantity:number;unit_price_cents:number;note?:string};
export function orderMessage(order: {
  code:number|string; shop:string; buyer:string; tower:string; apartment:string;
  items:MessageItem[]; total_cents:number; fulfillment:'delivery'|'pickup';
  delivery_day?:string|null;delivery_window?:string;instructions?:string[];note?:string
}): string {
  const lines=[
    'Olá! Fiz um pedido pelo Condovery.',
    '',
    'Pedido #' + order.code + ' — ' + order.shop,
    'Morador: ' + order.buyer,
    'Itens:',
    ...order.items.map(i=>'• '+i.quantity+'x '+i.name+' — '+BRL(i.unit_price_cents*i.quantity)+(i.note ? ' ('+i.note+')':'')),
    '',
    'Total: '+BRL(order.total_cents),
    'Recebimento: '+(order.fulfillment==='delivery' ? 'Entrega no condomínio':'Retirada'),
  ];
  if(order.fulfillment==='delivery') lines.push('Endereço: '+order.tower+', apto '+order.apartment);
  if(order.delivery_day) lines.push('Data preferida: '+order.delivery_day);
  if(order.delivery_window) lines.push('Horário preferido: '+order.delivery_window);
  if(order.instructions?.length) lines.push('Instruções: '+order.instructions.join('; '));
  if(order.note) lines.push('Observações: '+order.note);
  lines.push('','Pode confirmar a disponibilidade e combinar o pagamento?');
  return lines.join('\n');
}
export function unitPrice(product:{price_cents:number;promo_price_cents:number|null}) {
  return product.promo_price_cents && product.promo_price_cents<product.price_cents ? product.promo_price_cents : product.price_cents;
}
