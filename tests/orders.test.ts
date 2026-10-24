import test from 'node:test';
import assert from 'node:assert/strict';
import { BRL, normalizeWhatsApp, orderMessage, unitPrice } from '../src/lib/orders';

test('formats BRL cents without rounding mistakes',()=>assert.equal(BRL(3990),'R$ 39,90'));
test('normalizes Brazilian WhatsApp numbers',()=>{
  assert.equal(normalizeWhatsApp('(19) 99999-1234'),'5519999991234');
  assert.equal(normalizeWhatsApp('+55 19 99999-1234'),'5519999991234');
  assert.throws(()=>normalizeWhatsApp('123'));
});
test('promotion determines server-side unit price',()=>{
  assert.equal(unitPrice({price_cents:2500,promo_price_cents:1990}),1990);
  assert.equal(unitPrice({price_cents:2500,promo_price_cents:null}),2500);
});
test('order message contains instructions but does not claim payment',()=>{
  const msg=orderMessage({code:12,shop:'Bolos da Gabi',buyer:'Cliente',tower:'Torre 2',apartment:'83',
  items:[{name:'Bolo',quantity:2,unit_price_cents:2500}],total_cents:5000,fulfillment:'delivery',
  delivery_window:'17h–19h',instructions:['Não tocar a campainha']});
  assert.match(msg,/Pedido #12/);
  assert.match(msg,/Torre 2, apto 83/);
  assert.match(msg,/Não tocar a campainha/);
  assert.match(msg,/combinar o pagamento/);
});

test('customization validates choices and prices per unit',()=>{
  const g='4e9028ac-a3c0-4f02-9dfc-b2373b182f50';
  const c='51e73e5b-4544-4b3e-8dd3-e495f1e4a4cb';
  const config=[{id:g,name:'Cobertura',required:true,multiple:false,options:[
    {id:c,name:'Chocolate',price_cents:175}
  ]}];
  const {optionGroupsSchema,selectedOptions,extrasTotal}=require('../src/lib/orders');
  assert.equal(extrasTotal(selectedOptions(optionGroupsSchema.parse(config),{[g]:[c]})),175);
  assert.throws(()=>selectedOptions(config,{}),/Selecione/);
  assert.throws(()=>selectedOptions(config,{[g]:['00000000-0000-4000-8000-000000000000']}),/não está mais disponível/);
});
test('WhatsApp message has line notes, selections, fee and Brazilian date',()=>{
  const msg=orderMessage({
    code:99,shop:'Bolos da Gabi',buyer:'Maria',tower:'Torre 1',apartment:'2',
    items:[{name:'Bolo',quantity:2,unit_price_cents:2575,note:'Sem lactose',
      options:[{group:'Sabor',name:'Chocolate',price_cents:575}]}],
    subtotal_cents:5150,delivery_fee_cents:550,total_cents:5700,fulfillment:'delivery',
    delivery_day:'2026-10-26',instructions:['Não tocar a campainha']
  });
  assert.match(msg,/2x Bolo/);
  assert.match(msg,/Sabor: Chocolate/);
  assert.match(msg,/Obs.: Sem lactose/);
  assert.match(msg,/Data preferida: 26\\/10\\/2026/);
  assert.match(msg,/Taxa de entrega/);
  assert.match(msg,/Total: R\\$ 57,00/);
});
