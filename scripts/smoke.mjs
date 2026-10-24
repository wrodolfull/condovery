import assert from 'node:assert/strict';

const origin=process.env.SMOKE_URL||'http://127.0.0.1:3000';
async function request(path, {method='GET', body, cookie, expected=200}={}) {
  const response=await fetch(origin+'/api/'+path,{
    method,
    headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{'Cookie':cookie}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  const data=await response.json().catch(()=>null);
  assert.equal(response.status,expected,method+' /api/'+path+': '+JSON.stringify(data));
  return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const pass='TestPassword789!';const invite=process.env.BOOTSTRAP_INVITE_CODE;
assert.ok(invite);
await request('home',{expected:401});
const condo=(await request('public/condominium?invite='+encodeURIComponent(invite))).data;
assert.equal(condo.name,process.env.BOOTSTRAP_CONDO_NAME);
assert.ok(condo.towers.includes('Torre 1'));
const buyerEmail='buyer-smoke@example.com';
const sellerEmail='seller-smoke@example.com';
for(const [name,email,apt] of [['Buyer Test',buyerEmail,'101'],['Seller Test',sellerEmail,'102']]){
  await request('auth/register',{method:'POST',body:{name,email,phone:'11999991234',password:pass,invite,tower:'Torre 1',apartment:apt},expected:201});
}
const adminLogin=await request('auth/login',{method:'POST',body:{email:process.env.BOOTSTRAP_ADMIN_EMAIL,password:process.env.BOOTSTRAP_ADMIN_PASSWORD}});
const adminCookie=adminLogin.cookie;
assert.ok(adminCookie);
let summary=(await request('admin/summary',{cookie:adminCookie})).data;
assert.equal(summary.residents.filter(x=>x.status==='pending').length,2);
for(const user of summary.residents){
  await request('admin/users/'+user.id,{method:'PATCH',cookie:adminCookie,body:{status:'approved'}});
}
const sellerLogin=await request('auth/login',{method:'POST',body:{email:sellerEmail,password:pass}});
const buyerLogin=await request('auth/login',{method:'POST',body:{email:buyerEmail,password:pass}});
const sellerCookie=sellerLogin.cookie, buyerCookie=buyerLogin.cookie;
assert.ok(sellerCookie&&buyerCookie);
await request('admin/summary',{cookie:buyerCookie,expected:403});
const shopCreated=await request('shops/mine',{method:'POST',cookie:sellerCookie,body:{
  name:'Bolos da Gabi',description:'Bolos feitos aqui no condomínio',whatsapp:'11999991234'
},expected:201});
const shopId=shopCreated.data.shop.id;
await request('admin/shops/'+shopId,{method:'PATCH',cookie:adminCookie,body:{status:'approved'}});
const sellerHome=(await request('home',{cookie:sellerCookie})).data;
assert.ok(sellerHome.categories.length>0);
const product=await request('products',{method:'POST',cookie:sellerCookie,body:{
  name:'Bolo de cenoura',description:'Com chocolate',price_cents:2500,stock:4,
  category_id:sellerHome.categories[0].id,lead_time:'Disponível hoje',is_available:true
},expected:201});
const productId=product.data.product.id;
const visible=(await request('home',{cookie:buyerCookie})).data;
assert.ok(visible.products.find(p=>p.id===productId));
const created=await request('orders',{method:'POST',cookie:buyerCookie,body:{
  shop_id:shopId,items:[{id:productId,quantity:2}],fulfillment:'delivery',
  delivery_window:'18h–20h',instructions:['Não tocar a campainha']
},expected:201});
const orderId=created.data.order.id;
assert.match(created.data.whatsapp_url,/^https:\/\/wa\.me\/55/);
assert.equal(created.data.order.status,'awaiting_confirmation');
await request('orders/'+orderId,{method:'PATCH',cookie:buyerCookie,body:{status:'confirmed'},expected:403});
await request('orders/'+orderId,{method:'PATCH',cookie:sellerCookie,body:{status:'confirmed'}});
await request('orders/'+orderId,{method:'PATCH',cookie:sellerCookie,body:{status:'completed'}});
const final=(await request('orders',{cookie:buyerCookie})).data.orders.find(o=>o.id===orderId);
assert.equal(final.status,'completed');
assert.equal(final.total_cents,5000);
const mine=(await request('shops/mine',{cookie:sellerCookie})).data;
assert.equal(mine.products.find(p=>p.id===productId).stock,2);
console.log('Integration smoke PASS: invite -> approval -> shop -> product -> WhatsApp order -> completed.');
