import test from 'node:test';
import assert from 'node:assert/strict';
import {checkoutAttemptStorageKey,parseCheckoutAttempt} from '../src/lib/checkout-recovery';

test('a pending POST survives serialization with the same payload and idempotency key',()=>{
  const key='00000000-0000-4000-8000-000000000001';
  const body={shop_id:'00000000-0000-4000-8000-000000000002',
    client_order_key:key,items:[{id:'00000000-0000-4000-8000-000000000003',quantity:2}],
    expected_total_cents:1499,fulfillment:'delivery',note:'Portaria'};
  const original={key,body};
  assert.deepEqual(parseCheckoutAttempt(JSON.stringify(original)),original);
  assert.equal(checkoutAttemptStorageKey('buyer','condo'),checkoutAttemptStorageKey('buyer','condo'));
  assert.notEqual(checkoutAttemptStorageKey('buyer','condo'),checkoutAttemptStorageKey('buyer','other'));
  assert.notEqual(checkoutAttemptStorageKey('buyer','condo'),checkoutAttemptStorageKey('other','condo'));
});
test('stale, corrupt or mismatched attempt data cannot be interpreted as an order',()=>{
  const valid='00000000-0000-4000-8000-000000000001';
  const body={shop_id:valid,client_order_key:valid,items:[{id:valid,quantity:1}],expected_total_cents:100};
  for(const value of [null,'{','[]','{}',
    JSON.stringify({key:valid,body:{...body,client_order_key:'other'}}),
    JSON.stringify({key:valid,body:{...body,items:[]}}),
    JSON.stringify({key:valid,body:{...body,expected_total_cents:-1}}),
    JSON.stringify({key:'invalid',body}),
  ])assert.equal(parseCheckoutAttempt(value),null);
});
