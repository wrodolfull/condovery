import test from 'node:test';
import assert from 'node:assert/strict';
import { artwork, getCategoryArtwork } from '../src/lib/artwork';

test('all illustration slots default to an intentional fallback',()=>{
  assert.ok(Object.keys(artwork).length>=20);
  assert.ok(Object.values(artwork).every(v=>v===null||typeof v==='string'));
});
test('category art routes independently of the product catalog',()=>{
  artwork.categoryBolos='/illustrations/bolo.webp';
  artwork.categoryBebidas='/illustrations/bebida.webp';
  artwork.categoryRestaurantes='/illustrations/restaurante.webp';
  artwork.categorySobremesas='/illustrations/sobremesa.webp';
  assert.equal(getCategoryArtwork('Bolos e doces','cake-slice'),'/illustrations/bolo.webp');
  assert.equal(getCategoryArtwork('Bebidas','coffee'),'/illustrations/bebida.webp');
  assert.equal(getCategoryArtwork('Restaurantes','utensils'),'/illustrations/restaurante.webp');
  assert.equal(getCategoryArtwork('Sobremesas','cake-slice'),'/illustrations/sobremesa.webp');
});
