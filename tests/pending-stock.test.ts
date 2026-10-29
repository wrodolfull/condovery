import test from 'node:test';
import assert from 'node:assert/strict';
import {availableForNewOrders,buyerAvailableStockSQL} from '../src/lib/pending-stock';

test('finite stock excludes the total of pending order quantities',()=>{
  assert.equal(availableForNewOrders(1,0),1);
  assert.equal(availableForNewOrders(1,1),0);
  assert.equal(availableForNewOrders(4,3),1);
  assert.equal(availableForNewOrders(3,5),0);
  assert.equal(availableForNewOrders(5,0),5);
});

test('unlimited stock remains unlimited regardless of pending quantity',()=>{
  assert.equal(availableForNewOrders(null,1000),null);
});

test('resident stock projection ignores confirmed and cancelled orders',()=>{
  assert.match(buyerAvailableStockSQL,/status='awaiting_confirmation'/);
  assert.match(buyerAvailableStockSQL,/SUM\(oi.quantity\)/);
  assert.match(buyerAvailableStockSQL,/p.condominium_id/);
});
