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
