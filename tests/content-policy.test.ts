import test from 'node:test';
import assert from 'node:assert/strict';
import {violatesCommunityLanguage,communityGuidelines} from '../src/lib/content-policy';
test('reject case-insensitive offensive terms',()=>{
  assert.equal(violatesCommunityLanguage('MERDA!'),true);
  assert.equal(violatesCommunityLanguage('Porra, promoção'),true);
  assert.equal(violatesCommunityLanguage('foda-se'),true);
  assert.equal(violatesCommunityLanguage('Olá, PORNOGRAFIA'),true);
});
test('allow ordinary marketplace language',()=>{
  assert.equal(violatesCommunityLanguage('Bolos e doces','Bolo feito com carinho'),false);
  assert.equal(violatesCommunityLanguage('Pães da Vila','Serviços de marcenaria'),false);
  assert.ok(communityGuidelines.length>=4);
});
