import test from 'node:test';
import assert from 'node:assert/strict';
import {EXCLUSIVE_DESAPEGO_MESSAGE,isCommercialProductCategory} from '../src/lib/category-purpose';

test('Desapego is not a commercial product category',()=>{
  for(const name of ['Desapego','desapego',' DESAPEGO '])
    assert.equal(isCommercialProductCategory(name),false);
});
test('all ordinary commercial categories remain available',()=>{
  for(const name of ['Moda','Bolos e doces','Mercadinho','Eletrônicos','Presentes','Outros'])
    assert.equal(isCommercialProductCategory(name),true);
  assert.match(EXCLUSIVE_DESAPEGO_MESSAGE,/anúncios gratuitos entre moradores/);
});
