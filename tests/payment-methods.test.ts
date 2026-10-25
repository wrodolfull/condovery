import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedPaymentMethods,PAYMENT_LABELS} from '../src/lib/payment-methods';

test('filter permitted payment methods in display order',()=>{
  assert.deepEqual(allowedPaymentMethods(['cash','pix','not-supported']),['pix','cash']);
  assert.deepEqual(allowedPaymentMethods(null),[]);
  assert.equal(PAYMENT_LABELS.credit_card,'Cartão de crédito');
});
