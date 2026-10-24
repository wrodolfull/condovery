import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';

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
const condo=(await request('public/condominium',{method:'POST',body:{invite}})).data;
assert.equal(condo.name,process.env.BOOTSTRAP_CONDO_NAME);
assert.ok(condo.towers.includes('Torre 1'));
const buyerEmail='buyer-smoke@example.com';
const sellerEmail='seller-smoke@example.com';
for(const [name,email,apt] of [['Buyer Test',buyerEmail,'101'],['Seller Test',sellerEmail,'102']]){
  await request('auth/register',{method:'POST',body:{name,email,phone:'11999991234',password:pass,invite,tower:'Torre 1',apartment:apt},expected:201});
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
await request('orders/'+orderId,{method:'PATCH',cookie:buyerCookie,body:{status:'confirmed'},expected:404});
await request('orders/'+orderId,{method:'PATCH',cookie:sellerCookie,body:{status:'confirmed'}});
await request('orders/'+orderId,{method:'PATCH',cookie:sellerCookie,body:{status:'completed'}});
const final=(await request('orders',{cookie:buyerCookie})).data.orders.find(o=>o.id===orderId);
assert.equal(final.status,'completed');
assert.equal(final.total_cents,5000);
const mine=(await request('shops/mine',{cookie:sellerCookie})).data;
assert.equal(mine.products.find(p=>p.id===productId).stock,2);
console.log('Integration smoke PASS: invite -> approval -> shop -> product -> WhatsApp order -> completed.');


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
  body:{invite,name:'Google Resident',phone:'11911111111',tower:'Torre 1',apartment:'103'}
});
assert.ok(googleSignup.cookie?.includes('condovery_session='));
await request('home',{cookie:googleSignup.cookie,expected:403});
const googleWait=(await request('me',{cookie:googleSignup.cookie})).data;
assert.equal(googleWait.viewer.status,'pending');
assert.equal(googleWait.viewer.email,googleEmail);
const newSummary=(await request('admin/summary',{cookie:adminCookie})).data;
const newResident=newSummary.residents.find(x=>x.email===googleEmail);
assert.ok(newResident);
await request('admin/users/'+newResident.id,{method:'PATCH',cookie:adminCookie,body:{status:'approved'}});
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

// Changing an apartment must invalidate tenant approval until an admin checks.
await request('me',{method:'PATCH',cookie:googleSignup.cookie,
  body:{name:'Google Resident',phone:'11911111111',tower:'Torre 2',apartment:'202'}});
await request('home',{cookie:googleSignup.cookie,expected:403});
await request('admin/users/'+newResident.id,{method:'PATCH',cookie:adminCookie,body:{status:'approved'}});
await request('home',{cookie:googleSignup.cookie});

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
console.log('Security tests PASS: favorites, catalog, address reapproval and Supabase one-time password recovery.');
