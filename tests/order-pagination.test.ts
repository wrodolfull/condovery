import test from 'node:test';
import assert from 'node:assert/strict';
import {parseOrderPaging,orderPage} from '../src/lib/order-pagination';

test('bounded order history paging and opaque numeric cursor',()=>{
  assert.deepEqual(parseOrderPaging(new URLSearchParams()),{limit:20,cursor:null});
  assert.deepEqual(parseOrderPaging(new URLSearchParams('limit=50&cursor=2147483659')),{limit:50,cursor:'2147483659'});
  for(const search of ['limit=0','limit=51','limit=-1','limit=3.5','limit=foo','cursor=xyz','cursor=-5','cursor=0','cursor=9223372036854775808','cursor=001'])
    assert.equal(parseOrderPaging(new URLSearchParams(search)),null,search);
});

test('cursor comes from the last displayed item, not lookahead',()=>{
  const first=orderPage([{code:'10'},{code:'9'},{code:'8'}],2);
  assert.deepEqual(first.orders.map(x=>x.code),['10','9']);
  assert.equal(first.hasMore,true);
  assert.equal(first.nextCursor,'9');
  const last=orderPage([{code:'8'}],2);
  assert.equal(last.hasMore,false);
  assert.equal(last.nextCursor,null);
});
