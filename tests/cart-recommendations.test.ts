import test from 'node:test';
import assert from 'node:assert/strict';
import {recommendStoreProducts} from '../src/lib/cart-recommendations';

type Item={id:string;shop_id:string;visibility:'available'|'unavailable'|'hidden';stock:number|null;is_open?:boolean};
const item=(id:string,changes:Partial<Item>={}):Item=>({
  id,shop_id:'store-a',visibility:'available',stock:9,...changes
});

test('web cross-sell shows only distinct available products from the same store',()=>{
  const available=item('banana');
  const products=[
    item('in-cart'),available,
    item('another-store',{shop_id:'store-b'}),
    item('sold-out',{stock:0}),
    item('hidden',{visibility:'hidden'}),
    item('unavailable',{visibility:'unavailable'}),
    item('closed',{is_open:false}),
    item('banana'),item('granola',{stock:null}),
  ];
  const result=recommendStoreProducts(products,'store-a',[{product:{id:'in-cart'}}]);
  assert.deepEqual(result.map(p=>p.id),['banana','granola']);
  assert.equal(result[0],available);
});
test('web cross-sell respects its horizontal rail limit and store id',()=>{
  const products=[item('one'),item('two'),item('three')];
  assert.deepEqual(recommendStoreProducts(products,'store-a',[],2).map(p=>p.id),['one','two']);
  assert.deepEqual(recommendStoreProducts(products,'store-a',[],0),[]);
  assert.deepEqual(recommendStoreProducts(products,'store-b',[]),[]);
});
