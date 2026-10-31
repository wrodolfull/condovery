import test from 'node:test';
import assert from 'node:assert/strict';
import { artwork, getCategoryArtwork } from '../src/lib/artwork';

test('all illustration slots default to an intentional fallback',()=>{
  assert.ok(Object.keys(artwork).length>=20);
  assert.ok(Object.values(artwork).every(v=>v===null||typeof v==='string'));
});
test('category images use packaged WebP names and unknown categories keep the icon fallback',()=>{
  assert.equal(getCategoryArtwork('Pizza'),'/categories/pizzas.webp');
  assert.equal(getCategoryArtwork('Sushi'),'/categories/sushi.webp');
  assert.equal(getCategoryArtwork('Açaí'),'/categories/acai.webp');
  assert.equal(getCategoryArtwork('Sorvetes'),'/categories/sorvetes.webp');
  assert.equal(getCategoryArtwork('Sobremesas e sorvetes','ice-cream-cone'),'/categories/sorvetes.webp');
  assert.equal(getCategoryArtwork('Pets'),'/categories/pets.webp');
  assert.equal(getCategoryArtwork('Pães e salgados'),'/categories/padaria.webp');
  assert.equal(getCategoryArtwork('Mercadinho'),'/categories/mercado.webp');
  assert.equal(getCategoryArtwork('Desapego','gift'),'/categories/desapego.webp');
  assert.equal(getCategoryArtwork('Categoria desconhecida','shopping-bag'),null);
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

test('seven additional categories each have their own replaceable image',()=>{
  const fixtures=[
    ['Lanches','pizza','categoryLanches'],
    ['Sobremesas','ice-cream-cone','categorySobremesas'],
    ['Mercadinho','shopping-basket','categoryMercadinho'],
    ['Serviços','wrench','categoryServicos'],
    ['Saúde e bem-estar','heart-pulse','categorySaude'],
    ['Casa e decoração','house','categoryCasa'],
    ['Eletrônicos','smartphone','categoryEletronicos']
  ] as const;
  for(const [name,icon,key] of fixtures){
    const src='/illustrations/'+key+'.webp';
    artwork[key]=src;
    assert.equal(getCategoryArtwork(name,icon),src,name);
  }
});

test('optional catalog categories also have artwork, including disabled ones',()=>{
  const expected=[
    ['Moda','moda'],['Presentes','presentes'],['Outros','outros'],
    ['Saúde e bem-estar','saude'],['Eletrônicos','eletronicos'],
    ['Desapego','desapego'],['Beleza','beleza'],['Serviços','servicos'],
    ['Casa e decoração','casa-decoracao'],['Limpeza','limpeza'],
    ['Pets','pets'],['Açaí','acai'],['Sushi','sushi']
  ];
  for(const [name,slug] of expected)
    assert.equal(getCategoryArtwork(name),'/categories/'+slug+'.webp',name);
});
