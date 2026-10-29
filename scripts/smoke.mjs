import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
process.on('uncaughtExceptionMonitor',()=>{
 try {
  const lines=readFileSync('/tmp/condovery.log','utf8').split('\n').filter(line=>line.includes('condovery_api_error'));
  for(const line of lines.slice(-3))console.error('Integration diagnostic:',line);
 } catch {}
});
import pg from 'pg';

const origin=process.env.SMOKE_URL||'http://127.0.0.1:3000';
async function request(path, {method='GET', body, cookie, expected=200}={}) {
  // Existing checkout scenarios use Pix unless they explicitly test another method.
  if(body&&method==='POST'&&(path==='orders'||path==='orders/quote'))body={payment_method:'pix',...body};
  if(body&&method==='PATCH'&&path==='shops/mine')body={payment_methods:['pix','credit_card','debit_card','cash'],...body};
  const response=await fetch(origin+'/api/'+path,{
    method,
    headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{'Cookie':cookie}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const data=await response.json().catch(()=>null);
  assert.equal(response.status,expected,method+' /api/'+path+': '+JSON.stringify(data));
  return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const pass='A1!aaaaa';const invite=process.env.BOOTSTRAP_INVITE_CODE;
assert.ok(invite);
await request('home',{expected:401});
const condo=(await request('public/condominium',{method:'POST',body:{invite}})).data;
assert.equal(condo.name,process.env.BOOTSTRAP_CONDO_NAME);
assert.equal(condo.towers.length,30);
const firstTower=condo.towers[0],secondTower=condo.towers[1];
assert.equal(firstTower,'Torre A');
assert.equal(condo.towers[29],'Torre AD');
// Shared password policy must be enforced on the server before creating an Auth account.
for(const [index,weakPassword] of ['A1!aaaa','a1!aaaaa','Aa!aaaaa','Aa1aaaaa'].entries()){
  await request('auth/register',{method:'POST',expected:400,body:{
    name:'Password Policy Test',email:'invalid-password-'+index+'@example.com',phone:'11999991234',
    password:weakPassword,invite,tower:firstTower,apartment:'201'
  }});
}
const buyerEmail='buyer-smoke@example.com';
const sellerEmail='seller-smoke@example.com';
for(const [name,email,apt] of [['Buyer Test',buyerEmail,'101'],['Seller Test',sellerEmail,'102']]){
  await request('auth/register',{method:'POST',body:{name,email,phone:'11999991234',password:pass,invite,tower:firstTower,apartment:apt},expected:201});
}
// Supabase Email Confirmations must precede normal login; the test stub
// simulates clicking the verification link sent by Auth.
await request('auth/login',{method:'POST',body:{email:buyerEmail,password:pass},expected:401});
for(const email of [buyerEmail,sellerEmail]){
  const verified=await fetch('http://127.0.0.1:3333/__test/confirm?email='+encodeURIComponent(email));
  assert.equal(verified.status,200);
}
const adminLogin=await request('auth/login',{method:'POST',body:{email:process.env.BOOTSTRAP_ADMIN_EMAIL,password:process.env.BOOTSTRAP_ADMIN_PASSWORD}});
const adminCookie=adminLogin.cookie;
assert.ok(adminCookie);
// The env-bootstrapped administrator is a platform master; tenant switching
// must change the active session scope without changing the underlying login.
const masterTenants=(await request('platform/condominiums',{cookie:adminCookie})).data;
assert.ok(masterTenants.condominiums.some(c=>c.slug===process.env.BOOTSTRAP_CONDO_SLUG));
const newTenant=(await request('platform/condominiums',{
  method:'POST',cookie:adminCookie,expected:201,body:{
    name:'Residencial Jardins',slug:'residencial-jardins',
    invite_code:'AnotherPrivateInvite5678',tower_scheme:'numbers',tower_count:12
  }
})).data.condominium;
assert.equal(newTenant.slug,'residencial-jardins');
const originalTenant=masterTenants.active_condominium_id;
await request('platform/condominiums/switch',{method:'POST',cookie:adminCookie,body:{condominium_id:newTenant.id}});
assert.equal((await request('me',{cookie:adminCookie})).data.viewer.condominium_id,newTenant.id);
assert.equal((await request('admin/summary',{cookie:adminCookie})).data.stats.residents,0);
await request('platform/condominiums/switch',{method:'POST',cookie:adminCookie,body:{condominium_id:originalTenant}});
assert.equal((await request('me',{cookie:adminCookie})).data.viewer.condominium_id,originalTenant);

let summary=(await request('admin/summary',{cookie:adminCookie})).data;
const directory=(await request('admin/directory?kind=users',{cookie:adminCookie})).data;
assert.equal(summary.stats.residents,2);
assert.equal(directory.items.filter(x=>x.status==='approved').length,2);
assert.equal(directory.items.filter(x=>x.status==='pending').length,0);

const sellerLogin=await request('auth/login',{method:'POST',body:{email:sellerEmail,password:pass}});
const buyerLogin=await request('auth/login',{method:'POST',body:{email:buyerEmail,password:pass}});
const sellerCookie=sellerLogin.cookie, buyerCookie=buyerLogin.cookie;
assert.ok(sellerCookie&&buyerCookie);
// Hardened tenant directory: exact filtering, pagination, CSV and permissions.
const buyerLookup=(await request('admin/directory?kind=users&search='+encodeURIComponent(buyerEmail),{cookie:adminCookie})).data;
assert.equal(buyerLookup.total,1);
assert.equal(buyerLookup.items[0].email,buyerEmail);
const emptyPage=(await request('admin/directory?kind=users&page=1',{cookie:adminCookie})).data;
assert.equal(emptyPage.items.length,0);
await request('admin/directory?kind=users&status=invalid',{cookie:adminCookie,expected:400});
const exported=await fetch(origin+'/api/admin/directory/export?kind=users&search='+encodeURIComponent(buyerEmail),{
  headers:{Cookie:adminCookie}
});
assert.equal(exported.status,200);
assert.match(exported.headers.get('content-type')??'',/text\/csv/);
assert.ok((await exported.text()).includes(buyerEmail));

// Advertising lifecycle: asset ownership, commercial reporting, daily metrics
// and superadmin-only management. No real Supabase Storage upload required.
const adsDB=new pg.Client({connectionString:process.env.DATABASE_URL});
await adsDB.connect();
let testImageId,adId;
try{
  const media=await adsDB.query(
    "INSERT INTO media_assets(condominium_id,mime,storage_key) VALUES($1,'image/webp',$2) RETURNING id",
    [originalTenant,'test-ads/'+crypto.randomUUID()+'.webp']);
  testImageId=media.rows[0].id;
  const rls=await adsDB.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.platform_admins'::regclass");
  assert.equal(rls.rows[0].relrowsecurity,true);
  const campaign={
    condominium_id:originalTenant,merchant_name:'Padaria Parceira',
    headline:'Oferta do dia',description:'Teste de publicidade',location:'Valinhos, SP',
    image_url:'/api/media/'+testImageId,destination_url:'https://example.com/oferta',
    starts_at:new Date(Date.now()-60000).toISOString(),
    expires_at:new Date(Date.now()+86400000).toISOString(),enabled:true,
    contract_amount_cents:12345,billing_status:'pending',commercial_partner:'Parceiro Teste'
  };
  await request('platform/ads',{method:'POST',cookie:buyerCookie,body:campaign,expected:403});
  const createdAd=(await request('platform/ads',{method:'POST',cookie:adminCookie,body:campaign,expected:201})).data;
  adId=createdAd.id;
  await request('platform/ads/'+adId,{method:'PATCH',cookie:adminCookie,body:{billing_status:'paid'}});
  const overview=(await request('platform/ads',{cookie:adminCookie})).data;
  assert.equal(overview.campaigns.find(c=>c.id===adId).billing_status,'paid');
  const commercial=(await request('platform/ads/reports',{cookie:adminCookie})).data;
  assert.ok(Number(commercial.totals.received_cents)>=12345);
  assert.ok(commercial.partners.find(p=>p.commercial_partner==='Parceiro Teste'));
  await request('platform/ads/reports',{cookie:buyerCookie,expected:403});
  await request('platform/ads/settings',{method:'PATCH',cookie:adminCookie,body:{enabled:true}});
  assert.ok((await request('ads',{cookie:buyerCookie})).data.campaigns.some(c=>c.id===adId));
  await request('ads/'+adId+'/impression',{method:'POST',cookie:buyerCookie});
  await request('ads/'+adId+'/impression',{method:'POST',cookie:buyerCookie});
  await request('ads/'+adId+'/click',{method:'POST',cookie:buyerCookie});
  const counted=(await request('platform/ads',{cookie:adminCookie})).data.campaigns.find(c=>c.id===adId);
  assert.equal(counted.impressions,1);
  assert.equal(counted.clicks,1);
  await request('platform/ads/settings',{method:'PATCH',cookie:adminCookie,body:{enabled:false}});
  await request('ads/'+adId+'/impression',{method:'POST',cookie:buyerCookie,expected:404});
  console.log('Admin directory filters/CSV and advertising reporting/metrics PASS.');
}finally{
  if(adId)await request('platform/ads/'+adId,{method:'DELETE',cookie:adminCookie});
  await adsDB.query("UPDATE ads_settings SET enabled=false WHERE id=true");
  if(testImageId)await adsDB.query('DELETE FROM media_assets WHERE id=$1',[testImageId]);
  await adsDB.end();
}
await request('admin/summary',{cookie:buyerCookie,expected:403});
await request('admin/directory?kind=users',{cookie:buyerCookie,expected:403});
await request('admin/directory/export?kind=users',{cookie:buyerCookie,expected:403});
await request('platform/condominiums',{cookie:buyerCookie,expected:403});
await request('platform/condominiums/switch',{method:'POST',cookie:buyerCookie,expected:403,body:{condominium_id:newTenant.id}});
await request('shops/mine',{method:'POST',cookie:sellerCookie,expected:400,body:{
  name:'Bolos da Gabi',description:'Bolos feitos no condomínio',whatsapp:'11999991234'
}});
await request('shops/mine',{method:'POST',cookie:sellerCookie,expected:400,body:{
  name:'Bolos da Gabi',description:'Porra, que absurdo',whatsapp:'11999991234',accept_guidelines:true
}});
const shopCreated=await request('shops/mine',{method:'POST',cookie:sellerCookie,body:{
  name:'Bolos da Gabi',description:'Bolos feitos aqui no condomínio',whatsapp:'11999991234',accept_guidelines:true
},expected:201});
const shopId=shopCreated.data.shop.id;
assert.equal(shopCreated.data.shop.status,'approved');
assert.equal(shopCreated.data.shop.slug,'bolos-da-gabi');
const resolvedBySlug=(await request('shops/bolos-da-gabi',{cookie:buyerCookie})).data;
assert.equal(resolvedBySlug.shop.id,shopId);
assert.equal(resolvedBySlug.shop.slug,'bolos-da-gabi');
const duplicateShopName=await request('shops/mine',{method:'POST',cookie:buyerCookie,body:{
  name:'Bolos da Gabi',description:'Outra loja com mesmo nome',whatsapp:'11999991234',accept_guidelines:true
},expected:201});
assert.match(duplicateShopName.data.shop.slug,/^bolos-da-gabi-[a-f0-9]{8}$/);
assert.notEqual(duplicateShopName.data.shop.slug,shopCreated.data.shop.slug);
await request('shops/mine',{method:'DELETE',cookie:buyerCookie,body:{confirmation:'EXCLUIR LOJA'}});

const sellerHome=(await request('home',{cookie:sellerCookie})).data;
assert.equal(sellerHome.categories.length,7);
const standardNames=[
  'Bolos e doces','Pães e salgados','Refeições','Bebidas','Lanches',
  'Sobremesas e sorvetes','Mercadinho'
];
assert.deepEqual(sellerHome.categories.map(c=>c.name),standardNames);
assert.equal(new Set(sellerHome.categories.map(c=>c.id)).size,7);
// Optional categories already exist in the database; duplicate creation returns 409.
await request('admin/categories',{method:'POST',cookie:adminCookie,expected:409,body:{name:'Moda',icon:'sandwich'}});
// Custom non-food categories are now supported and available to toggle.
const customCategory=await request('admin/categories',{method:'POST',cookie:adminCookie,expected:201,body:{name:'Produtos de teste',icon:'shirt'}});
assert.equal(customCategory.data.category.is_active,true);
await request('admin/categories/'+customCategory.data.category.id,{method:'PATCH',cookie:adminCookie,body:{is_active:false}});
const afterDisable=(await request('home',{cookie:sellerCookie})).data;
assert.ok(!afterDisable.categories.some(c=>c.id===customCategory.data.category.id));
await request('admin/categories/'+customCategory.data.category.id,{method:'PATCH',cookie:adminCookie,body:{is_active:true}});
const afterEnable=(await request('home',{cookie:sellerCookie})).data;
assert.ok(afterEnable.categories.some(c=>c.id===customCategory.data.category.id));
await request('products',{method:'POST',cookie:sellerCookie,expected:400,body:{
  name:'Porra',description:'Teste de ofensa',price_cents:2500,stock:4,
  category_id:sellerHome.categories[0].id,lead_time:'Disponível hoje',is_available:true
}});
const product=await request('products',{method:'POST',cookie:sellerCookie,body:{
  name:'Bolo de cenoura',description:'Com chocolate',price_cents:2500,stock:4,
  category_id:sellerHome.categories[0].id,lead_time:'Disponível hoje',is_available:true
},expected:201});
const productId=product.data.product.id;
const visible=(await request('home',{cookie:buyerCookie})).data;
assert.ok(visible.products.find(p=>p.id===productId));
// Feira digital: admin creates, seller enrolls, admin moderates, resident buys via existing catalog.
const fairPayload={
  title:'Feira de Bolos',description:'Vitrine da comunidade',
  starts_at:new Date(Date.now()-60_000).toISOString(),
  ends_at:new Date(Date.now()+86_400_000).toISOString(),
  published:true,cover_image_url:''
};
await request('fairs/manage',{method:'POST',cookie:sellerCookie,body:fairPayload,expected:403});
const createdFair=(await request('fairs/manage',{method:'POST',cookie:adminCookie,body:fairPayload,expected:201})).data;
const fairId=createdFair.id;
// Superadmin must not see or mutate fairs outside the selected condominium.
await request('platform/condominiums/switch',{method:'POST',cookie:adminCookie,body:{condominium_id:newTenant.id}});
assert.ok(!(await request('fairs/manage',{cookie:adminCookie})).data.fairs.some(f=>f.id===fairId));
await request('fairs/manage/'+fairId,{method:'PATCH',cookie:adminCookie,body:{published:false},expected:404});
await request('platform/condominiums/switch',{method:'POST',cookie:adminCookie,body:{condominium_id:originalTenant}});
assert.ok((await request('fairs',{cookie:buyerCookie})).data.fairs.some(f=>f.id===fairId));
const sellerFairs=(await request('fairs/seller',{cookie:sellerCookie})).data;
assert.ok(sellerFairs.fairs.some(f=>f.id===fairId));
assert.ok(sellerFairs.products.some(p=>p.id===productId));
await request('fairs/'+fairId+'/applications',{method:'POST',cookie:sellerCookie,body:{product_id:productId},expected:201});
await request('fairs/'+fairId+'/applications',{method:'POST',cookie:buyerCookie,body:{product_id:productId},expected:403});
assert.equal((await request('fairs/'+fairId,{cookie:buyerCookie})).data.products.length,0);
await request('fairs/manage/'+fairId+'/applications/'+productId,{method:'PATCH',cookie:buyerCookie,body:{status:'approved'},expected:403});
await request('fairs/manage/'+fairId+'/applications/'+productId,{method:'PATCH',cookie:adminCookie,body:{status:'approved'}});
assert.ok((await request('fairs/'+fairId,{cookie:buyerCookie})).data.products.some(p=>p.id===productId));
await request('fairs/manage/'+fairId,{method:'PATCH',cookie:adminCookie,body:{published:false}});
await request('fairs/'+fairId,{cookie:buyerCookie,expected:404});
await request('fairs/manage/'+fairId,{method:'PATCH',cookie:adminCookie,body:{published:true}});
console.log('Community fair tenant participation, moderation, publication and product listing PASS.');

const checkoutKey=crypto.randomUUID();
const checkoutBody={
  shop_id:shopId,items:[{id:productId,quantity:2}],fulfillment:'delivery',
  delivery_window:'18h–20h',instructions:['Bater na porta','Não tocar a campainha'],
  client_order_key:checkoutKey
};
const created=await request('orders',{method:'POST',cookie:buyerCookie,body:checkoutBody,expected:201});
const retry=await request('orders',{method:'POST',cookie:buyerCookie,body:checkoutBody,expected:200});
assert.equal(retry.data.order.id,created.data.order.id);
assert.equal(retry.data.whatsapp_url,created.data.whatsapp_url);
assert.equal(created.data.order.payment_method,'pix');
assert.ok(decodeURIComponent(created.data.whatsapp_url).includes('Forma de pagamento: Pix'));
const contact=(await request('orders/'+created.data.order.id+'/whatsapp',{cookie:buyerCookie})).data;
assert.match(contact.whatsapp_url,/^https:\/\/wa\.me\/55/);
assert.ok(decodeURIComponent(contact.whatsapp_url).includes('Forma de pagamento: Pix'));
assert.ok(decodeURIComponent(contact.whatsapp_url).includes('Bater na porta; Não tocar a campainha'));
await request('orders/'+created.data.order.id+'/whatsapp',{cookie:sellerCookie,expected:404});
const orderId=created.data.order.id;
assert.match(created.data.whatsapp_url,/^https:\/\/wa\.me\/55/);
assert.equal(created.data.order.status,'awaiting_confirmation');
await request('orders/'+orderId,{method:'PATCH',cookie:buyerCookie,body:{status:'confirmed'},expected:404});
await request('orders/'+orderId,{method:'PATCH',cookie:sellerCookie,body:{status:'confirmed'}});
await request('orders/'+orderId,{method:'PATCH',cookie:sellerCookie,body:{status:'completed'}});
await request('orders/'+orderId+'/whatsapp',{cookie:buyerCookie,expected:404});
const final=(await request('orders',{cookie:buyerCookie})).data.orders.find(o=>o.id===orderId);
assert.equal(final.status,'completed');
const sellerInsights=(await request('seller/insights?days=30',{cookie:sellerCookie})).data;
assert.ok(sellerInsights.summary.completed>=1);
assert.ok(Number(sellerInsights.summary.completed_cents)>=5000);
assert.ok(sellerInsights.topProducts.some(p=>p.product_id===productId&&p.units>=2));
await request('seller/insights?days=15',{cookie:sellerCookie,expected:400});
await request('seller/insights?days=30',{cookie:adminCookie,expected:403});
console.log('Seller insights scoped to owner, status and confirmed order snapshots PASS.');

assert.equal(final.total_cents,5000);
assert.equal(final.can_review,true,'A different resident who completed an order can rate it.');
assert.equal(final.is_own_shop,false);



const completedList=(await request('orders?status=completed',{cookie:buyerCookie})).data.orders;
assert.ok(completedList.some(order=>order.id===orderId));
const waitingList=(await request('orders?status=awaiting_confirmation',{cookie:buyerCookie})).data.orders;
assert.ok(!waitingList.some(order=>order.id===orderId));
await request('orders?status=unknown',{cookie:buyerCookie,expected:400});
const mine=(await request('shops/mine',{cookie:sellerCookie})).data;
assert.equal(mine.products.find(p=>p.id===productId).stock,2);
const reviewEndpoint='orders/'+orderId+'/review';
const noReviews=(await request('shops/'+shopId+'/reviews',{cookie:buyerCookie})).data;
assert.deepEqual(noReviews.summary,{average:null,count:0});
assert.equal(noReviews.reviews.length,0);
await request(reviewEndpoint,{method:'POST',cookie:sellerCookie,
  body:{rating:5,description:'Tentativa indevida'},expected:403});
await request(reviewEndpoint,{method:'POST',cookie:buyerCookie,
  body:{rating:0,description:'Compra boa'},expected:400});
await request(reviewEndpoint,{method:'POST',cookie:buyerCookie,
  body:{rating:5,description:' '},expected:400});
await request(reviewEndpoint,{method:'POST',cookie:buyerCookie,
  body:{rating:5,description:'A'.repeat(201)},expected:400});
await request('shops/mine/reviews',{cookie:buyerCookie,expected:404});
const review1=(await request(reviewEndpoint,{method:'POST',cookie:buyerCookie,
  body:{rating:4,description:'Bolo fresquinho e muito gostoso!'},expected:201})).data.review;
assert.equal(review1.status,'pending');
await request(reviewEndpoint,{method:'POST',cookie:buyerCookie,
  body:{rating:5,description:'Repetida'},expected:409});
const awaitingReview=(await request('orders?status=completed',{cookie:buyerCookie})).data.orders.find(o=>o.id===orderId);
assert.equal(awaitingReview.review_status,'pending');
assert.equal(awaitingReview.can_review,false);
assert.equal((await request('shops/'+shopId+'/reviews',{cookie:buyerCookie})).data.summary.count,0);
const moderationList=(await request('shops/mine/reviews',{cookie:sellerCookie})).data;
assert.equal(moderationList.pending,1);
assert.equal(moderationList.reviews[0].order_code,created.data.order.code);
await request('shops/mine/reviews/'+review1.id,{method:'PATCH',cookie:buyerCookie,
  body:{status:'approved'},expected:404});
await request('shops/mine/reviews/'+review1.id,{method:'PATCH',cookie:sellerCookie,
  body:{status:'pending'},expected:400});
await request('shops/mine/reviews/'+review1.id,{method:'PATCH',cookie:sellerCookie,
  body:{status:'approved'}});
await request('shops/mine/reviews/'+review1.id,{method:'PATCH',cookie:sellerCookie,
  body:{status:'rejected'},expected:409});
const firstPublic=(await request('shops/'+shopId+'/reviews',{cookie:buyerCookie})).data;
assert.equal(firstPublic.summary.count,1);
assert.equal(firstPublic.summary.average,4);
assert.equal(firstPublic.reviews[0].description,'Bolo fresquinho e muito gostoso!');
assert.ok(!Object.hasOwn(firstPublic.reviews[0],'buyer_phone'));
assert.ok(!Object.hasOwn(firstPublic.reviews[0],'tower'));

async function buyAndComplete(description,rating) {
  const createdOrder=(await request('orders',{method:'POST',cookie:buyerCookie,body:{
    shop_id:shopId,items:[{id:productId,quantity:1}],fulfillment:'pickup',
    delivery_window:'Manhã'
  },expected:201})).data.order;
  await request('orders/'+createdOrder.id,{method:'PATCH',cookie:sellerCookie,body:{status:'confirmed'}});
  await request('orders/'+createdOrder.id,{method:'PATCH',cookie:sellerCookie,body:{status:'completed'}});
  const inserted=(await request('orders/'+createdOrder.id+'/review',{method:'POST',cookie:buyerCookie,
    body:{rating,description},expected:201})).data.review;
  return {createdOrder,inserted};
}
const unfinished=(await request('orders',{method:'POST',cookie:buyerCookie,
  body:{shop_id:shopId,items:[{id:productId,quantity:1}],fulfillment:'pickup'},expected:201})).data.order;
await request('orders/'+unfinished.id+'/review',{method:'POST',cookie:buyerCookie,
  body:{rating:5,description:'Pedido sem conclusão'},expected:403});

const second=await buyAndComplete('Atendimento excelente!',5);
await request('shops/mine/reviews/'+second.inserted.id,{method:'PATCH',cookie:sellerCookie,
  body:{status:'approved'}});
const avg=(await request('shops/'+shopId+'/reviews',{cookie:buyerCookie})).data;
assert.equal(avg.summary.average,4.5);
assert.equal(avg.summary.count,2);
const third=await buyAndComplete('Não gostei da embalagem.',1);
await request('shops/mine/reviews/'+third.inserted.id,{method:'PATCH',cookie:sellerCookie,
  body:{status:'rejected'}});
const afterReject=(await request('shops/'+shopId+'/reviews',{cookie:buyerCookie})).data;
assert.equal(afterReject.summary.average,4.5);
assert.equal(afterReject.summary.count,2);
const rejectedOrder=(await request('orders',{cookie:buyerCookie})).data.orders.find(o=>o.id===third.createdOrder.id);
assert.equal(rejectedOrder.review_status,'rejected');
// Restore the product fixture for the subsequent Playwright buying flow.
await request('products/'+productId,{method:'PATCH',cookie:sellerCookie,body:{
  name:'Bolo de cenoura',description:'Com chocolate',price_cents:2500,promo_price_cents:null,
  category_id:sellerHome.categories[0].id,stock:4,image_url:null,lead_time:'Disponível hoje',
  is_available:true
}});

const visibilityUrl='products/'+productId+'/visibility';
await request(visibilityUrl,{method:'PATCH',cookie:buyerCookie,body:{visibility:'hidden'},expected:404});
await request(visibilityUrl,{method:'PATCH',cookie:sellerCookie,body:{visibility:'unavailable'}});
const homeUnavailable=(await request('home',{cookie:buyerCookie})).data;
assert.equal(homeUnavailable.products.find(p=>p.id===productId).visibility,'unavailable');
const catalogUnavailable=(await request('catalog?search=bolo',{cookie:buyerCookie})).data;
assert.equal(catalogUnavailable.products.find(p=>p.id===productId).visibility,'unavailable');
const shopUnavailable=(await request('shops/'+shopId,{cookie:buyerCookie})).data;
assert.equal(shopUnavailable.products.find(p=>p.id===productId).visibility,'unavailable');
await request('orders',{method:'POST',cookie:buyerCookie,body:{
  shop_id:shopId,items:[{id:productId,quantity:1}],fulfillment:'pickup'
},expected:400});
await request(visibilityUrl,{method:'PATCH',cookie:sellerCookie,body:{visibility:'hidden'}});
const hiddenHome=(await request('home',{cookie:buyerCookie})).data;
assert.equal(hiddenHome.products.find(p=>p.id===productId),undefined);
const hiddenShop=(await request('shops/'+shopId,{cookie:buyerCookie})).data;
assert.equal(hiddenShop.products.find(p=>p.id===productId),undefined);
const hiddenOwner=(await request('shops/mine',{cookie:sellerCookie})).data;
assert.equal(hiddenOwner.products.find(p=>p.id===productId).visibility,'hidden');
await request(visibilityUrl,{method:'PATCH',cookie:sellerCookie,body:{visibility:'available'}});
assert.equal((await request('home',{cookie:buyerCookie})).data.products.find(p=>p.id===productId).visibility,'available');
await request(visibilityUrl,{method:'PATCH',cookie:sellerCookie,body:{visibility:'unknown'},expected:400});
const dbCheck=new pg.Client({connectionString:process.env.DATABASE_URL});
await dbCheck.connect();
try {
  const cols=await dbCheck.query(
    "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND (table_name='shops' AND column_name='logo_image' OR table_name='users' AND column_name='avatar_image')"
  );
  assert.equal(cols.rowCount,2);
}finally{await dbCheck.end();}
console.log('Shop activation, product states and idempotent WhatsApp ordering PASS.');

console.log('Verified reviews smoke PASS: eligibility, single review, moderation, average and privacy.');
console.log('Integration smoke PASS: code -> instant resident/store -> product -> WhatsApp order -> completed.');

const extraGroup=crypto.randomUUID(),optionNo=crypto.randomUUID(),optionChoc=crypto.randomUUID();
const addGroup=crypto.randomUUID(),optionFruit=crypto.randomUUID(),optionSprinkles=crypto.randomUUID();
const optionGroups=[
  {id:extraGroup,name:'Cobertura',required:true,multiple:false,options:[
    {id:optionNo,name:'Sem cobertura',price_cents:0},
    {id:optionChoc,name:'Chocolate',price_cents:150}
  ]},
  {id:addGroup,name:'Extras',required:false,multiple:true,options:[
    {id:optionFruit,name:'Frutas',price_cents:250},
    {id:optionSprinkles,name:'Granulado',price_cents:100}
  ]}
];
const customizable=(await request('products',{method:'POST',cookie:sellerCookie,expected:201,body:{
  name:'Bolo personalizável',description:'Escolha seus sabores',price_cents:2000,
  category_id:sellerHome.categories[0].id,stock:6,option_groups:optionGroups
}})).data.product;
const choose=[
  {id:customizable.id,quantity:1,note:'Primeira encomenda',selections:{[extraGroup]:[optionChoc],[addGroup]:[optionFruit]}},
  {id:customizable.id,quantity:2,note:'Segunda encomenda',selections:{[extraGroup]:[optionNo]}}
];
const shopSettings={
  name:'Bolos da Gabi',description:'Bolos feitos no condomínio',whatsapp:'11999991234',
  is_open:true,delivery_enabled:true,pickup_enabled:true,lead_time:'',pickup_instructions:'',
  cover_image:null,logo_image:null,delivery_fee_cents:550
};
await request('shops/mine',{method:'PATCH',cookie:sellerCookie,body:shopSettings});
// Payment selection is stored with the order but never charged by the platform.
await request('shops/mine',{method:'PATCH',cookie:sellerCookie,body:{
  ...shopSettings,payment_methods:['pix','cash']
}});
await request('orders/quote',{method:'POST',cookie:buyerCookie,expected:409,body:{
  shop_id:shopId,items:[{id:customizable.id,quantity:1,selections:{[extraGroup]:[optionNo]}}],
  fulfillment:'pickup',payment_method:'credit_card'
}});
await request('shops/mine',{method:'PATCH',cookie:sellerCookie,body:shopSettings});
const quoteReq={shop_id:shopId,items:choose,fulfillment:'delivery'};
await request('orders/quote',{method:'POST',cookie:buyerCookie,expected:400,body:{
  ...quoteReq,instructions:['Bater na porta','Tocar a campainha']
}});
const quoted=(await request('orders/quote',{method:'POST',cookie:buyerCookie,body:quoteReq})).data.quote;
assert.equal(quoted.lines.length,2);
assert.equal(quoted.lines[0].unit_price_cents,2400);
assert.equal(quoted.lines[1].unit_price_cents,2000);
assert.equal(quoted.subtotal_cents,6400);
assert.equal(quoted.delivery_fee_cents,550);
assert.equal(quoted.total_cents,6950);
const pick=(await request('orders/quote',{method:'POST',cookie:buyerCookie,body:{...quoteReq,fulfillment:'pickup'}})).data.quote;
assert.equal(pick.delivery_fee_cents,0);
assert.equal(pick.total_cents,6400);
await request('orders/quote',{method:'POST',cookie:buyerCookie,expected:400,body:{
  ...quoteReq,items:[{id:customizable.id,quantity:1,selections:{[extraGroup]:[crypto.randomUUID()]}}]
}});
await request('orders/quote',{method:'POST',cookie:buyerCookie,expected:400,body:{
  ...quoteReq,items:[{id:customizable.id,quantity:1}]
}});
await request('orders/quote',{method:'POST',cookie:buyerCookie,expected:400,body:{
  ...quoteReq,items:[{...choose[0],quantity:4},{...choose[1],quantity:4}]
}});
// Price changed after the customer saw the cart: no order may be registered.
await request('shops/mine',{method:'PATCH',cookie:sellerCookie,
  body:{...shopSettings,delivery_fee_cents:700}});
const newQuote=(await request('orders/quote',{method:'POST',cookie:buyerCookie,body:quoteReq})).data.quote;
assert.equal(newQuote.total_cents,7100);
await request('orders',{method:'POST',cookie:buyerCookie,expected:409,body:{
  ...quoteReq,client_order_key:crypto.randomUUID(),expected_total_cents:quoted.total_cents
}});
const checkoutExtra=(await request('orders',{method:'POST',cookie:buyerCookie,expected:201,body:{
  ...quoteReq,client_order_key:crypto.randomUUID(),expected_total_cents:newQuote.total_cents
}})).data;
assert.equal(checkoutExtra.order.total_cents,7100);
assert.equal(checkoutExtra.order.subtotal_cents,6400);
assert.equal(checkoutExtra.order.delivery_fee_cents,700);
const whats=decodeURIComponent(checkoutExtra.whatsapp_url.split('?text=')[1]).replaceAll('\u00a0',' ');
assert.match(whats,/Cobertura: Chocolate/);
assert.match(whats,/Extras: Frutas/);
assert.match(whats,/Obs.: Primeira encomenda/);
assert.match(whats,/Obs.: Segunda encomenda/);
assert.match(whats,/Subtotal: R\$ 64,00/);
assert.match(whats,/Taxa de entrega: R\$ 7,00/);
assert.match(whats,/Total: R\$ 71,00/);
const sellerList=(await request('orders?scope=seller',{cookie:sellerCookie})).data.orders;
const extraOrder=sellerList.find(o=>o.id===checkoutExtra.order.id);
assert.equal(extraOrder.items.length,2);
assert.ok(extraOrder.items.some(x=>x.note==='Primeira encomenda'&&x.options.length===2));
await request('orders/'+extraOrder.id,{method:'PATCH',cookie:sellerCookie,body:{status:'confirmed'}});
const dbStock=new pg.Client({connectionString:process.env.DATABASE_URL});
await dbStock.connect();
try{
  const out=await dbStock.query('SELECT stock FROM products WHERE id=$1',[customizable.id]);
  assert.equal(out.rows[0].stock,3);
}finally{await dbStock.end();}
await request('orders/'+extraOrder.id,{method:'PATCH',cookie:sellerCookie,body:{status:'completed'}});
await request('shops/mine',{method:'PATCH',cookie:sellerCookie,
  body:{...shopSettings,delivery_fee_cents:0}});
console.log('Checkout customizations PASS: repeated product variants, price confirmation, delivery fee and WhatsApp snapshots.');

// Regression: simultaneous checkouts cannot both claim the final available
// unit. The seller retains manual confirmation and stock is deducted only then.
const finalUnit=(await request('products',{method:'POST',cookie:sellerCookie,expected:201,body:{
  name:'Última unidade reservada',category_id:sellerHome.categories[0].id,
  price_cents:2700,stock:1
}})).data.product;
const simultaneousPayload={shop_id:shopId,items:[{id:finalUnit.id,quantity:1}],fulfillment:'pickup',payment_method:'pix'};
const competitors=await Promise.all([buyerCookie,sellerCookie].map(async (cookie)=>{
  const key=crypto.randomUUID();
  const response=await fetch(origin+'/api/orders',{
    method:'POST',headers:{'Content-Type':'application/json',Cookie:cookie},
    body:JSON.stringify({...simultaneousPayload,client_order_key:key})
  });
  return {status:response.status,data:await response.json(),cookie,key};
}));
assert.deepEqual(competitors.map(x=>x.status).sort((a,b)=>a-b),[201,409]);
const winner=competitors.find(x=>x.status===201);
const rejected=competitors.find(x=>x.status===409);
assert.ok(winner?.data.order?.id);
assert.match(rejected?.data.error??'',/pedidos aguardando confirmação/);
const bookedId=winner.data.order.id;
await request('products/'+finalUnit.id,{method:'PATCH',cookie:sellerCookie,expected:409,body:{
  name:'Última unidade reservada',description:'',
  category_id:sellerHome.categories[0].id,price_cents:2700,promo_price_cents:null,
  stock:0,image_url:null,visibility:'available',lead_time:'',option_groups:[]
}});
for(const route of ['home','catalog','shops/'+shopId]){
  const resp=(await request(route,{cookie:buyerCookie})).data;
  const productLine=resp.products.find(p=>p.id===finalUnit.id);
  assert.equal(productLine.stock,0,'reserved item unavailable in '+route);
}
// Retried requests with the same key return the original order, never a
// second allocation. New quotes correctly explain the temporary claim.
const duplicate=await request('orders',{method:'POST',cookie:winner.cookie,body:{
  ...simultaneousPayload,client_order_key:winner.key
}});
assert.equal(duplicate.data.order.id,bookedId);
await request('orders/quote',{method:'POST',cookie:rejected.cookie,body:simultaneousPayload,expected:409});
await request('orders/'+bookedId,{method:'PATCH',cookie:sellerCookie,body:{status:'cancelled'}});
assert.equal((await request('shops/'+shopId,{cookie:buyerCookie})).data.products.find(p=>p.id===finalUnit.id).stock,1);
const afterCancellation=(await request('orders',{method:'POST',cookie:buyerCookie,expected:201,body:{
  ...simultaneousPayload,client_order_key:crypto.randomUUID()
}})).data.order;
await request('orders/'+afterCancellation.id,{method:'PATCH',cookie:sellerCookie,body:{status:'confirmed'}});
assert.equal((await request('home',{cookie:buyerCookie})).data.products.find(p=>p.id===finalUnit.id).stock,0);
await request('orders/'+afterCancellation.id,{method:'PATCH',cookie:sellerCookie,body:{status:'cancelled'}});
assert.equal((await request('home',{cookie:buyerCookie})).data.products.find(p=>p.id===finalUnit.id).stock,1);
console.log('Concurrent last-unit orders PASS: one accepted, one rejected; cancellation and confirmation release/move allocation.');





// Tests Google invite onboarding after provider identity has been verified;
// the actual external Supabase/Google callback requires dashboard credentials.
const googleEmail='google-smoke@example.com';
const googleSubject=crypto.randomUUID(),pending=crypto.randomBytes(32).toString('hex');
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
await client.connect();
try{
  await client.query(
    "INSERT INTO google_signup_pending(token_hash,google_auth_user_id,email,name) VALUES($1,$2,$3,$4)",
    [crypto.createHash('sha256').update(pending).digest('hex'),googleSubject,googleEmail,'Google Resident']
  );
}finally{await client.end();}
const googleSignup=await request('auth/register-google',{
  method:'POST',expected:201,
  cookie:'condovery_google_signup='+pending,
  body:{invite,name:'Google Resident',phone:'11911111111',tower:firstTower,apartment:'103'}
});
assert.ok(googleSignup.cookie?.includes('condovery_session='));
await request('home',{cookie:googleSignup.cookie});
const googleWait=(await request('me',{cookie:googleSignup.cookie})).data;
assert.equal(googleWait.viewer.status,'approved');
assert.equal(googleWait.viewer.email,googleEmail);
const newSummary=(await request('admin/summary',{cookie:adminCookie})).data;
const newDirectory=(await request('admin/directory?kind=users&search='+encodeURIComponent(googleEmail),{cookie:adminCookie})).data;
const newResident=newDirectory.items.find(x=>x.email===googleEmail);
assert.ok(newResident);
const googleHome=(await request('home',{cookie:googleSignup.cookie})).data;
assert.ok(googleHome.categories.length>0);
console.log('Google verified identity onboarding PASS (provider callback itself requires Google credentials).');

// Backend catalogue and private per-resident favorites.
const catalog=(await request('catalog?search=bolo&limit=12&page=0',{cookie:buyerCookie})).data;
assert.ok(catalog.products.some(p=>p.id===productId));
await request('favorites',{method:'POST',cookie:buyerCookie,body:{product_id:productId}});
const favoriteResult=(await request('favorites',{cookie:buyerCookie})).data;
assert.ok(favoriteResult.ids.includes(productId));
assert.equal(favoriteResult.products.find(p=>p.id===productId).name,'Bolo de cenoura');
const sellerFavorites=(await request('favorites',{cookie:sellerCookie})).data;
assert.equal(sellerFavorites.ids.length,0);
await request('favorites/'+productId,{method:'DELETE',cookie:buyerCookie});
assert.equal((await request('favorites',{cookie:buyerCookie})).data.ids.length,0);

// Changing address does not trigger approval, although suspension remains possible.
await request('me',{method:'PATCH',cookie:googleSignup.cookie,
  body:{name:'Google Resident',phone:'11911111111',tower:secondTower,apartment:'202'}});
const newProfile=(await request('me',{cookie:googleSignup.cookie})).data.viewer;
assert.equal(newProfile.status,'approved');
assert.equal(newProfile.tower,secondTower);
await request('home',{cookie:googleSignup.cookie});

// A buyer can flag inappropriate words or images; only administrators can take action.
await request('reports',{method:'POST',cookie:sellerCookie,expected:400,body:{
  target_type:'shop',target_id:shopId,reason:'language'
}});
const complaint=(await request('reports',{method:'POST',cookie:buyerCookie,expected:201,body:{
  target_type:'product',target_id:productId,reason:'image',details:'Foto inadequada para famílias'
}})).data;
assert.match(complaint.message,/Denúncia recebida/);
await request('reports',{method:'POST',cookie:buyerCookie,expected:409,body:{
  target_type:'product',target_id:productId,reason:'image'
}});
await request('admin/reports',{cookie:buyerCookie,expected:403});
let reported=(await request('admin/reports',{cookie:adminCookie})).data.reports;
const complaintRow=reported.find(row=>row.target_id===productId&&row.status==='open');
assert.ok(complaintRow);
await request('admin/reports/'+complaintRow.id,{method:'PATCH',cookie:buyerCookie,expected:403,
  body:{action:'hide_product'}});
await request('admin/reports/'+complaintRow.id,{method:'PATCH',cookie:adminCookie,body:{action:'hide_product'}});
assert.ok(!(await request('home',{cookie:buyerCookie})).data.products.some(p=>p.id===productId));
assert.equal((await request('shops/mine',{cookie:sellerCookie})).data.products.find(p=>p.id===productId).visibility,'hidden');
await request('products/'+productId+'/visibility',{method:'PATCH',cookie:sellerCookie,
  expected:403,body:{visibility:'available'}});
await request('admin/products/'+productId+'/unblock',{method:'PATCH',cookie:buyerCookie,expected:403});
await request('admin/products/'+productId+'/unblock',{method:'PATCH',cookie:adminCookie});
await request('admin/products/'+productId+'/unblock',{method:'PATCH',cookie:adminCookie,expected:404});

await request('admin/reports/'+complaintRow.id,{method:'PATCH',cookie:adminCookie,expected:404,
  body:{action:'dismiss'}});
const shopComplaint=(await request('reports',{method:'POST',cookie:buyerCookie,expected:201,body:{
  target_type:'shop',target_id:shopId,reason:'inappropriate',details:'Conteúdo da loja'
}})).data;
assert.match(shopComplaint.message,/Denúncia recebida/);
reported=(await request('admin/reports',{cookie:adminCookie})).data.reports;
const shopRow=reported.find(r=>r.target_id===shopId&&r.status==='open');
assert.ok(shopRow);
await request('admin/reports/'+shopRow.id,{method:'PATCH',cookie:adminCookie,body:{action:'suspend_shop'}});
assert.ok(!(await request('home',{cookie:buyerCookie})).data.shops.some(s=>s.id===shopId));
await request('products',{method:'POST',cookie:sellerCookie,expected:403,body:{
  name:'Novo produto',category_id:sellerHome.categories[0].id,price_cents:2500
}});
await request('admin/shops/'+shopId,{method:'PATCH',cookie:adminCookie,body:{status:'approved'}});
// Only the administrator can define a new permanent code.
await request('admin/invite',{method:'POST',cookie:buyerCookie,expected:403,body:{code:'TESTE-CADEADO-2026'}});
await request('admin/invite',{method:'POST',cookie:adminCookie,expected:400,body:{code:'so-letras-sem-numeros'}});
const chosen='CONDOVERY-PILOTO-2026';
const editedInvite=(await request('admin/invite',{method:'POST',cookie:adminCookie,body:{code:chosen}})).data;
assert.equal(editedInvite.invite,chosen);
await request('public/condominium',{method:'POST',body:{invite},expected:404});
assert.equal((await request('public/condominium',{method:'POST',body:{invite:chosen}})).data.name,
  process.env.BOOTSTRAP_CONDO_NAME);
console.log('No preapprovals, guidelines, reports, suspension and manual invitation code PASS.');

// Restore approved test listing for Chromium browser acceptance suite.
await request('products/'+productId+'/visibility',{method:'PATCH',cookie:sellerCookie,body:{visibility:'available'}});
await request('shops/mine',{method:'PATCH',cookie:sellerCookie,body:{
  name:'Bolos da Gabi',description:'Bolos feitos aqui no condomínio',whatsapp:'11999991234',
  is_open:true,delivery_enabled:true,pickup_enabled:true,lead_time:'',pickup_instructions:'',
  cover_image:null,logo_image:null
}});
assert.ok((await request('home',{cookie:buyerCookie})).data.products.some(p=>p.id===productId));

// The Supabase Auth service creates/validates a recovery OTP, never Condovery.
const resetRequested=await request('auth/password/request',{
  method:'POST',body:{email:buyerEmail}
});
assert.match(resetRequested.data.message,/Supabase Auth/);
const resetData=await fetch('http://127.0.0.1:3333/__test/recovery?email='+encodeURIComponent(buyerEmail));
assert.equal(resetData.status,200);
const {token_hash}=await resetData.json();
const verify=await fetch(origin+'/api/auth/recovery/verify?type=recovery&token_hash='+token_hash,{redirect:'manual'});
assert.equal(verify.status,307);
const recoveryCookie=verify.headers.get('set-cookie')?.split(';')[0];
assert.ok(recoveryCookie?.startsWith('condovery_recovery='));
await request('auth/password/confirm',{method:'POST',cookie:recoveryCookie,
  body:{password:'a1!aaaaa'},expected:400});
// Invalid password must not consume the valid one-time recovery ticket.

await request('auth/password/confirm',{
  method:'POST',cookie:recoveryCookie,body:{password:'NewPassword123!'}
});
await request('home',{cookie:buyerCookie,expected:401});
await request('auth/password/confirm',{
  method:'POST',cookie:recoveryCookie,body:{password:'NewPassword123!'},expected:400
});
await request('auth/login',{method:'POST',body:{email:buyerEmail,password:pass},expected:401});
const newLogin=await request('auth/login',{method:'POST',body:{email:buyerEmail,password:'NewPassword123!'}});
assert.ok(newLogin.cookie);
console.log('Security tests PASS: favorites, catalog, editable address and Supabase one-time password recovery.');


const deletionEmails=['delete-seller-smoke@example.com','delete-buyer-smoke@example.com'];
for(const [index,email] of deletionEmails.entries()){
  await request('auth/register',{method:'POST',expected:201,body:{
    name:index===0?'Seller Leaving':'Buyer Leaving',email,phone:'11911112222',
    password:pass,invite:chosen,tower:firstTower,apartment:String(510+index)
  }});
  const verified=await fetch('http://127.0.0.1:3333/__test/confirm?email='+encodeURIComponent(email));
  assert.equal(verified.status,200);
}
const deleteSellerCookie=(await request('auth/login',{method:'POST',body:{email:deletionEmails[0],password:pass}})).cookie;
const deleteBuyerCookie=(await request('auth/login',{method:'POST',body:{email:deletionEmails[1],password:pass}})).cookie;
const leaveShop=(await request('shops/mine',{method:'POST',expected:201,cookie:deleteSellerCookie,body:{
  name:'Loja que vai encerrar',description:'Produtos caseiros',whatsapp:'11999991234',accept_guidelines:true
}})).data.shop;
const leaveProduct=(await request('products',{method:'POST',cookie:deleteSellerCookie,expected:201,body:{
  name:'Produto de teste',description:'Um produto de teste',price_cents:1250,
  category_id:sellerHome.categories[0].id,stock:8
}})).data.product;
const leaveOrder=(await request('orders',{method:'POST',cookie:deleteBuyerCookie,expected:201,body:{
  shop_id:leaveShop.id,items:[{id:leaveProduct.id,quantity:2,note:'Detalhes pessoais para limpar'}],
  fulfillment:'pickup',note:'Nota privada de compra'
}})).data.order;
await request('me',{method:'DELETE',cookie:deleteSellerCookie,expected:400,
  body:{confirmation:'NÃO EXCLUIR',password:pass}});
await request('me',{method:'DELETE',cookie:deleteSellerCookie,expected:401,
  body:{confirmation:'EXCLUIR',password:'senha-invalida'}});
await request('me',{method:'DELETE',cookie:deleteSellerCookie,expected:409,
  body:{confirmation:'EXCLUIR',password:pass}});
await request('me',{method:'DELETE',cookie:deleteBuyerCookie,expected:409,
  body:{confirmation:'EXCLUIR',password:pass}});
await request('orders/'+leaveOrder.id,{method:'PATCH',cookie:deleteSellerCookie,body:{status:'confirmed'}});
await request('orders/'+leaveOrder.id,{method:'PATCH',cookie:deleteSellerCookie,body:{status:'completed'}});
const buyerDeleted=await request('me',{method:'DELETE',cookie:deleteBuyerCookie,body:{
  confirmation:'EXCLUIR',password:pass
}});
assert.equal(buyerDeleted.data.status,'completed');
await request('me',{cookie:deleteBuyerCookie,expected:200}).then(r=>assert.equal(r.data.viewer,null));
await request('home',{cookie:deleteBuyerCookie,expected:401});
await request('auth/login',{method:'POST',body:{email:deletionEmails[1],password:pass},expected:401});
const sellerDeleted=await request('me',{method:'DELETE',cookie:deleteSellerCookie,body:{
  confirmation:'EXCLUIR',password:pass
}});
assert.equal(sellerDeleted.data.status,'completed');
await request('home',{cookie:deleteSellerCookie,expected:401});
const remaining=await request('home',{cookie:adminCookie});
assert.ok(!remaining.data.shops.some(s=>s.id===leaveShop.id));
const archive=new pg.Client({connectionString:process.env.DATABASE_URL});
await archive.connect();
try{
  const o=await archive.query('SELECT o.id,o.total_cents,o.note,u.name,u.phone,u.status FROM orders o JOIN users u ON u.id=o.buyer_id WHERE o.id=$1',[leaveOrder.id]);
  assert.equal(o.rows.length,1);
  assert.equal(o.rows[0].total_cents,2500);
  assert.equal(o.rows[0].name,'Conta excluída');
  assert.equal(o.rows[0].phone,'');
  assert.equal(o.rows[0].status,'deleted');
  assert.equal(o.rows[0].note,'');
  const sh=await archive.query('SELECT status,is_open,whatsapp FROM shops WHERE id=$1',[leaveShop.id]);
  assert.equal(sh.rows[0].status,'deleted');
  assert.equal(sh.rows[0].is_open,false);
  assert.equal(sh.rows[0].whatsapp,'');
  const jobs=await archive.query("SELECT count(*)::int AS total FROM account_deletion_jobs WHERE finished_at IS NOT NULL");
  assert.ok(jobs.rows[0].total>=2);
}finally{await archive.end();}
console.log('Account deletion PASS: password, confirmation, unfinished orders, privacy, seller archive, Supabase Auth deletion.');

 
// Seller self-service store lifecycle: immediate pause, safe removal, retained order history,
// and permission to start a replacement shop without deleting the resident account.
for(const [email,apt] of [['lifecycle-seller@example.com','622'],['lifecycle-buyer@example.com','623']]){
  await request('auth/register',{method:'POST',expected:201,body:{
    name:'Shop Lifecycle Test',email,phone:'11999998888',password:pass,invite:chosen,tower:firstTower,apartment:apt
  }});
  const verification=await fetch('http://127.0.0.1:3333/__test/confirm?email='+encodeURIComponent(email));
  assert.equal(verification.status,200);
}
const lifecycleSeller=(await request('auth/login',{method:'POST',body:{email:'lifecycle-seller@example.com',password:pass}})).cookie;
const lifecycleBuyer=(await request('auth/login',{method:'POST',body:{email:'lifecycle-buyer@example.com',password:pass}})).cookie;
const lifecycleShop=(await request('shops/mine',{method:'POST',expected:201,cookie:lifecycleSeller,body:{
  name:'Loja do Teste',description:'Lanches caseiros',whatsapp:'11999998888',accept_guidelines:true
}})).data.shop;
const lifecycleProduct=(await request('products',{method:'POST',cookie:lifecycleSeller,expected:201,body:{
  name:'Salgado',category_id:sellerHome.categories[1].id,price_cents:1050,stock:10
}})).data.product;
await request('shops/mine/status',{method:'PATCH',cookie:lifecycleBuyer,expected:404,body:{is_open:false}});
await request('shops/mine/status',{method:'PATCH',cookie:lifecycleSeller,body:{is_open:false}});
const paused=await request('shops/mine',{cookie:lifecycleSeller});
assert.equal(paused.data.shop.is_open,false);
await request('orders/quote',{method:'POST',cookie:lifecycleBuyer,expected:409,body:{
  shop_id:lifecycleShop.id,items:[{id:lifecycleProduct.id,quantity:1}],fulfillment:'pickup'
}});
await request('orders',{method:'POST',cookie:lifecycleBuyer,expected:409,body:{
  shop_id:lifecycleShop.id,items:[{id:lifecycleProduct.id,quantity:1}],fulfillment:'pickup',
  client_order_key:crypto.randomUUID()
}});
await request('shops/mine/status',{method:'PATCH',cookie:lifecycleSeller,body:{is_open:true}});
const lifecycleUnfinished=(await request('orders',{method:'POST',cookie:lifecycleBuyer,expected:201,body:{
  shop_id:lifecycleShop.id,items:[{id:lifecycleProduct.id,quantity:1}],fulfillment:'pickup'
}})).data.order;
await request('shops/mine',{method:'DELETE',cookie:lifecycleSeller,expected:400,body:{confirmation:'NÃO'}});
await request('shops/mine',{method:'DELETE',cookie:lifecycleBuyer,expected:404,body:{confirmation:'EXCLUIR LOJA'}});
await request('shops/mine',{method:'DELETE',cookie:lifecycleSeller,expected:409,body:{confirmation:'EXCLUIR LOJA'}});
await request('orders/'+lifecycleUnfinished.id,{method:'PATCH',cookie:lifecycleSeller,body:{status:'confirmed'}});
await request('orders/'+lifecycleUnfinished.id,{method:'PATCH',cookie:lifecycleSeller,body:{status:'completed'}});
const lifecycleDeleted=await request('shops/mine',{method:'DELETE',cookie:lifecycleSeller,body:{confirmation:'EXCLUIR LOJA'}});
assert.equal(lifecycleDeleted.data.status,'completed');
assert.equal((await request('shops/mine',{cookie:lifecycleSeller})).data.shop,null);
await request('shops/'+lifecycleShop.id,{cookie:lifecycleBuyer,expected:404});
assert.ok(!(await request('home',{cookie:lifecycleBuyer})).data.shops.some(s=>s.id===lifecycleShop.id));
const replacement=(await request('shops/mine',{method:'POST',expected:201,cookie:lifecycleSeller,body:{
  name:'Nova Loja de Teste',description:'Sobremesas',whatsapp:'11999998888',accept_guidelines:true
}})).data.shop;
assert.notEqual(replacement.id,lifecycleShop.id);
// A seller can buy from their own store for testing, but that order must NOT
// create a public verified review. The UI uses these response flags to hide
// the action and the API explains the refusal.
const selfProduct=(await request('products',{method:'POST',cookie:lifecycleSeller,expected:201,body:{
  name:'Sobremesa da própria loja',category_id:sellerHome.categories[0].id,price_cents:1200,stock:5
}})).data.product;
const selfOrder=(await request('orders',{method:'POST',cookie:lifecycleSeller,expected:201,body:{
  shop_id:replacement.id,items:[{id:selfProduct.id,quantity:1}],fulfillment:'pickup'
}})).data.order;
await request('orders/'+selfOrder.id,{method:'PATCH',cookie:lifecycleSeller,body:{status:'confirmed'}});
await request('orders/'+selfOrder.id,{method:'PATCH',cookie:lifecycleSeller,body:{status:'completed'}});
const selfSummary=(await request('orders',{cookie:lifecycleSeller})).data.orders.find(o=>o.id===selfOrder.id);
assert.equal(selfSummary.status,'completed');
assert.equal(selfSummary.is_own_shop,true);
assert.equal(selfSummary.can_review,false);
const deniedSelf=await request('orders/'+selfOrder.id+'/review',{
  method:'POST',cookie:lifecycleSeller,expected:403,
  body:{rating:5,description:'Não devo avaliar a própria loja'}
});
assert.match(deniedSelf.data.error,/própria loja/i);
// Seller product deletion leaves existing order items and prices intact.
await request('products/'+selfProduct.id,{method:'DELETE',cookie:lifecycleBuyer,
  body:{confirmation:'EXCLUIR PRODUTO'},expected:404});
await request('products/'+selfProduct.id,{method:'DELETE',cookie:lifecycleSeller,
  body:{confirmation:'NÃO EXCLUIR'},expected:400});
await request('products/'+selfProduct.id,{method:'DELETE',cookie:lifecycleSeller,
  body:{confirmation:'EXCLUIR PRODUTO'}});
assert.equal((await request('shops/mine',{cookie:lifecycleSeller})).data.products.some(p=>p.id===selfProduct.id),false);
assert.equal((await request('catalog',{cookie:lifecycleBuyer})).data.products.some(p=>p.id===selfProduct.id),false);
await request('products/'+selfProduct.id+'/visibility',{method:'PATCH',cookie:lifecycleSeller,
  body:{visibility:'available'},expected:404});
await request('orders/quote',{method:'POST',cookie:lifecycleBuyer,expected:400,body:{
  shop_id:replacement.id,items:[{id:selfProduct.id,quantity:1}],fulfillment:'pickup'
}});


const historyDB=new pg.Client({connectionString:process.env.DATABASE_URL});
await historyDB.connect();
try{
  const previous=await historyDB.query('SELECT status,is_open,whatsapp FROM shops WHERE id=$1',[lifecycleShop.id]);
  assert.equal(previous.rows[0].status,'deleted');
  assert.equal(previous.rows[0].whatsapp,'');
  const oldOrder=await historyDB.query('SELECT id,total_cents,status FROM orders WHERE id=$1',[lifecycleUnfinished.id]);
  assert.equal(oldOrder.rows[0].status,'completed');
  assert.equal(oldOrder.rows[0].total_cents,1050);
  const cleanup=await historyDB.query('SELECT finished_at FROM shop_deletion_jobs WHERE shop_id=$1',[lifecycleShop.id]);
  assert.ok(cleanup.rows[0].finished_at);
}finally{await historyDB.end();}
console.log('Shop lifecycle PASS: pause/reopen, blocked pending orders, confirmation, archive, historical orders and recreation.');

await request('admin/towers',{method:'PATCH',cookie:lifecycleBuyer,
  body:{scheme:'letters',count:30},expected:403});
await request('admin/towers',{method:'PATCH',cookie:adminCookie,
  body:{scheme:'letters',count:31},expected:400});
await request('admin/towers',{method:'PATCH',cookie:adminCookie,
  body:{scheme:'letters',count:1},expected:409});
const numericTowers=await request('admin/towers',{method:'PATCH',cookie:adminCookie,
  body:{scheme:'numbers',count:30}});
assert.equal(numericTowers.data.towers[0],'Torre 1');
assert.equal(numericTowers.data.towers[29],'Torre 30');
assert.equal((await request('me',{cookie:newLogin.cookie})).data.viewer.tower,'Torre 1');
const newLetters=await request('admin/towers',{method:'PATCH',cookie:adminCookie,
  body:{scheme:'letters',count:30}});
assert.equal(newLetters.data.towers[29],'Torre AD');
assert.equal((await request('me',{cookie:newLogin.cookie})).data.viewer.tower,'Torre A');
assert.equal((await request('orders',{cookie:lifecycleSeller})).data.orders.some(order=>order.id===selfOrder.id),true);
console.log('Tower management PASS: 30 alphabetic/numeric labels, safe resident remapping and permissions.');




// Security: central anti-CSRF protection and atomic authentication throttling.
const crossSite=await fetch(origin+'/api/auth/logout',{
  method:'POST',headers:{Origin:'https://attacker.invalid','Sec-Fetch-Site':'cross-site','Cookie':adminCookie}
});
assert.equal(crossSite.status,403);
assert.equal((await request('me',{cookie:adminCookie})).data.viewer.role,'admin');
const crossSubdomain=await fetch(origin+'/api/auth/logout',{
  method:'POST',headers:{Origin:'https://other.example','Sec-Fetch-Site':'same-site','Cookie':adminCookie}
});
assert.equal(crossSubdomain.status,403);
const abuseEmail='unregistered-rate-smoke@example.com';
for(let n=0;n<8;n++){
  await request('auth/login',{method:'POST',body:{email:abuseEmail,password:'incorrect-password'},expected:401});
}
await request('auth/login',{method:'POST',body:{email:abuseEmail,password:'incorrect-password'},expected:429});
const protectionDB=new pg.Client({connectionString:process.env.DATABASE_URL});
await protectionDB.connect();
try{
  const meta=await protectionDB.query("SELECT count(*)::int AS count FROM auth_rate_events WHERE action='login'");
  assert.ok(meta.rows[0].count>=8);
  const secretTest=await protectionDB.query("SELECT count(*)::int AS total FROM users WHERE password_hash IS NOT NULL");
  assert.equal(secretTest.rows[0].total,0);
  const priv=await protectionDB.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.auth_rate_events'::regclass");
  assert.equal(priv.rows[0].relrowsecurity,true);
  const raw=await protectionDB.query('SELECT subject_hash FROM auth_rate_events LIMIT 1');
  assert.match(raw.rows[0].subject_hash,/^[0-9a-f]{64}$/);
}finally{await protectionDB.end();}
console.log('Anti-CSRF checks, login throttling, legacy password purge and event RLS PASS.');
