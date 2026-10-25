import assert from 'node:assert/strict';
import test from 'node:test';
import {slugifyShopName,shopSharePath} from '../src/lib/shop-slug';
test('slugifies the storefront name without accents or unsafe punctuation',()=>{
 assert.equal(slugifyShopName('Flor do Forno'),'flor-do-forno');
 assert.equal(slugifyShopName('  Pães & Doces!  '),'paes-doces');
 assert.equal(slugifyShopName('123 Loja'),'123-loja');
 assert.equal(slugifyShopName('!!!'),'loja');
 assert.equal(shopSharePath('flor-do-forno'),'/loja/flor-do-forno');
});
