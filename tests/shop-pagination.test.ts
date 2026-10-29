import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeShopCursor,parseShopPaging,shopPage} from '../src/lib/shop-pagination';

const id='22da294e-aab1-43ba-b9df-4807b87cf880';
const cursor={isOpen:true,createdAt:'2026-10-29 18:15:11.123456+00',id};

test('shop pagination validates limits and opaque cursors',()=>{
  assert.deepEqual(parseShopPaging(new URLSearchParams()),{limit:24,cursor:null});
  assert.deepEqual(parseShopPaging(new URLSearchParams({limit:'48',cursor:encodeShopCursor(cursor)})),{limit:48,cursor});
  for(const params of ['limit=0','limit=49','limit=-1','limit=2.5','limit=x','cursor=foo','cursor=','cursor='+encodeShopCursor({...cursor,id:'not-a-uuid'}),'cursor='+encodeShopCursor({...cursor,isOpen:'yes'} as never)])
    assert.equal(parseShopPaging(new URLSearchParams(params)),null,params);
});

test('next cursor points at last visible store, not lookahead row',()=>{
  const row=(n:number)=>({id:`22da294e-aab1-43ba-b9df-${String(n).padStart(12,'0')}`,is_open:true,cursor_created_at:'2026-10-29 18:15:11.123456+00'});
  const first=shopPage([row(3),row(2),row(1)],2);
  assert.deepEqual(first.shops.map(shop=>shop.id),[row(3).id,row(2).id]);
  assert.equal(first.hasMore,true);
  assert.equal(parseShopPaging(new URLSearchParams({cursor:first.nextCursor!}))?.cursor?.id,row(2).id);
  const last=shopPage([row(1)],2);
  assert.equal(last.hasMore,false);
  assert.equal(last.nextCursor,null);
});
