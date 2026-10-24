import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';

const origin=process.env.VISUAL_URL||'http://127.0.0.1:3000';
await mkdir('artifacts/visual',{recursive:true});

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const widths=[320,360,390,430,768,1280];
let checked=0;
async function verify(page,scene,width) {
  await page.waitForTimeout(130);
  const data=await page.evaluate(()=>{
    const view=window.innerWidth;
    const root=document.documentElement;
    const important=['.app-header','.header-inner','.content','.bottom-nav',
      '.floating-cart','.hero-banner','.weekly-offer-banner','.auth-card',
      '.auth-mobile-intro','.white-panel','.checkout-layout','.order-card',
      '.shop-actions','.shop-rating','.shop-reviews-section','.review-form','.seller-review-card'];
    const elements=important.flatMap(selector=>Array.from(document.querySelectorAll(selector))
      .filter(el=>getComputedStyle(el).display!=='none')
      .map(el=>{const r=el.getBoundingClientRect();return {selector,left:r.left,right:r.right};}));
    return {view,documentWidth:root.scrollWidth,offending:elements.filter(x=>x.left < -2||x.right>view+2)};
  });
  if(data.documentWidth>data.view+2||data.offending.length){
    await page.screenshot({path:'artifacts/visual/overflow-'+width+'-'+scene+'.png',fullPage:true});
    throw new Error('Horizontal overflow at '+width+'px ['+scene+']: '+JSON.stringify(data));
  }
  checked++;
  if(['login','home','explore','shop','seller-reviews','orders'].includes(scene)){
    await page.screenshot({path:'artifacts/visual/'+width+'-'+scene+'.png',fullPage:true});
  }
}
try{
  for(const width of widths) {
    const context=await browser.newContext({viewport:{width,height:820},deviceScaleFactor:1});
    const page=await context.newPage();
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.locator('.auth-card').waitFor({state:'visible'});
    await verify(page,'login',width);
    await page.locator('.auth-card input[type="email"]').fill('buyer-smoke@example.com');
    await page.locator('.auth-card input[type="password"]').fill('NewPassword123!');
    await page.getByRole('button',{name:'Entrar com e-mail'}).click();
    await page.locator('.hero-banner').waitFor({state:'visible',timeout:15000});
    await verify(page,'home',width);
    const nav=(label)=>page.locator(width<900?'.bottom-nav':'.desktop-nav')
      .getByRole('button',{name:label,exact:true});
    await nav('Explorar').click();
    await page.locator('.explore-category-track').waitFor({state:'visible'});
    await verify(page,'explore',width);
    await page.locator('.shops-list .shop-row').first().click();
    await page.locator('.shop-rating').waitFor({state:'visible'});
    await verify(page,'shop',width);
    const shareId=new URL(page.url()).searchParams.get('loja');
    if(!shareId)throw Error('Store profile must expose shareable URL');
    const shared=await context.newPage();
    await shared.goto(origin+'/?loja='+shareId,{waitUntil:'domcontentloaded'});
    await shared.locator('.shop-rating').waitFor({state:'visible',timeout:15000});
    await verify(shared,'shop-link',width);
    await shared.close();
    await nav('Pedidos').click();
    await page.locator('.order-filters').waitFor({state:'visible'});
    await verify(page,'orders',width);
    await page.locator('.order-filters button').filter({hasText:'Concluídos'}).click();
    await page.waitForTimeout(200);
    await verify(page,'orders-filtered',width);
    await nav('Conta').click();
    await page.locator('.account-grid').waitFor({state:'visible'});
    await verify(page,'account',width);
    await nav('Início').click();
    await page.locator('.hero-banner').waitFor({state:'visible'});
    await page.locator('.product-open').first().click();
    await page.locator('.product-detail').waitFor({state:'visible'});
    await verify(page,'product',width);
    // Products may have mandatory customizations before they can enter the cart.
    const groups=page.locator('.product-detail .options-picker');
    for(let i=0;i<await groups.count();i++){
      const group=groups.nth(i);
      if((await group.locator('legend').innerText()).includes('Obrigatório'))
        await group.locator('input').first().check();
    }
    await page.locator('.product-detail .primary-button').click();
    await page.locator('.checkout-layout').waitFor({state:'visible'});
    await verify(page,'cart',width);
    await context.close();
    if(width===390){
      const sellerContext=await browser.newContext({viewport:{width,height:820},deviceScaleFactor:1});
      const sellerPage=await sellerContext.newPage();
      await sellerPage.goto(origin,{waitUntil:'domcontentloaded'});
      await sellerPage.locator('.auth-card').waitFor({state:'visible'});
      await sellerPage.locator('.auth-card input[type="email"]').fill('seller-smoke@example.com');
      await sellerPage.locator('.auth-card input[type="password"]').fill('TestPassword789!');
      await sellerPage.getByRole('button',{name:'Entrar com e-mail'}).click();
      await sellerPage.locator('.hero-banner').waitFor({state:'visible',timeout:15000});
      await sellerPage.locator('.bottom-nav').getByRole('button',{name:'Conta'}).click();
      await sellerPage.locator('.account-shortcuts button').first().click();
      await sellerPage.locator('.seller-tabs').waitFor({state:'visible'});
      await sellerPage.locator('.seller-tabs button').filter({hasText:'Avaliações'}).click();
      await sellerPage.locator('.seller-review-card').first().waitFor({state:'visible'});
      await verify(sellerPage,'seller-reviews',width);
      await sellerContext.close();
    }
  }
  console.log('Responsive visual QA PASS: '+checked+' views checked at '+widths.join(', ')+'px');
}finally{
  await browser.close();
}
