import test from 'node:test';
import assert from 'node:assert/strict';
import {blankShopDraft,readShopDraft,shopDraftEquals,shopDraftKey} from '../src/lib/shop-draft';
test('drafts are scoped to owner, condominium, and shop',()=>{
  const a=shopDraftKey('ownerA','condoA','shopA');
  assert.notEqual(a,shopDraftKey('ownerB','condoA','shopA'));
  assert.notEqual(a,shopDraftKey('ownerA','condoB','shopA'));
  assert.notEqual(a,shopDraftKey('ownerA','condoA','shopB'));
  assert.notEqual(a,shopDraftKey('ownerA','condoA',null));
});
test('valid staged settings survive re-read while invalid storage is ignored',()=>{
  const draft={...blankShopDraft(),name:'Bolos',delivery_enabled:false,delivery_fee_cents:575,logo_image:'/api/media/preview',payment_methods:['pix'] as const};
  assert.deepEqual(readShopDraft(JSON.stringify(draft)),draft);
  assert.equal(readShopDraft('not json'),null);
  assert.equal(readShopDraft(JSON.stringify({...draft,delivery_fee_cents:'bad'})),null);
  assert.equal(readShopDraft(JSON.stringify({...draft,payment_methods:['unknown']})),null);
  assert.equal(shopDraftEquals(blankShopDraft(),{...blankShopDraft(),name:'Outra loja'}),false);
});
