import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';

const origin=process.env.VISUAL_URL||'http://127.0.0.1:3000';
await mkdir('artifacts/visual',{recursive:true});

const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const widths=[320,360,390,430,768,1280];
let checked=0;
async function verifyRoundCategories(page,selector,width){
  const results=await page.locator(selector+' .category-art').evaluateAll(elements=>elements.map(el=>{
    const bounds=el.getBoundingClientRect();
    const style=getComputedStyle(el);
    return {width:bounds.width,height:bounds.height,radius:style.borderRadius};
  }));
  if(!results.length||results.some(item=>Math.abs(item.width-item.height)>1||item.radius!=='50%')){
    throw new Error('Categories must be true circles at '+width+'px: '+JSON.stringify(results));
  }
}
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
    // Privacy and terms are public, accessible before login and on narrow screens.
    await page.goto(origin+'/conheca',{waitUntil:'domcontentloaded'});
    await page.locator('.lp-footer-links a[href="/politica-de-privacidade"]').waitFor({state:'visible'});
    await page.locator('.lp-footer-links a[href="/termos-de-uso"]').waitFor({state:'visible'});
    await verify(page,'landing-legal-links',width);
    for(const [slug,title] of [['politica-de-privacidade','Política de Privacidade'],['termos-de-uso','Termos de Uso']]){
      const response=await page.goto(origin+'/'+slug,{waitUntil:'domcontentloaded'});
      if(response?.status()!==200)throw new Error('Legal page '+slug+' HTTP '+response?.status());
      await page.getByRole('heading',{name:title,exact:true,level:1}).waitFor({state:'visible'});
      if(await page.locator('article section').count()<8)throw new Error('Incomplete legal content: '+slug);
      await verify(page,'legal-'+slug,width);
    }
    await page.goto(origin,{waitUntil:'domcontentloaded'});
    await page.locator('.auth-card').waitFor({state:'visible'});
    await verify(page,'login',width);
    await page.getByRole('button',{name:'Cadastre-se',exact:true}).click();
    const registerPassword=page.locator('.auth-card input[autocomplete="new-password"]');
    await registerPassword.fill('A1!aaaaa');
    const feedback=await page.locator('.password-feedback').innerText();
    if(!feedback.includes('8 caracteres')||!feedback.includes('Todos os requisitos obrigatórios'))
      throw new Error('Password strength and requirement indicators did not update live: '+feedback);
    await verify(page,'password-feedback',width);
    await page.locator('.auth-switch button').click();
    await page.locator('.auth-card input[type="email"]').fill('buyer-smoke@example.com');
    await page.locator('.auth-card input[type="password"]').fill('NewPassword123!');
    const loginReply=page.waitForResponse(response=>response.url().includes('/api/auth/login')&&response.request().method()==='POST');
    await page.getByRole('button',{name:'Entrar com e-mail'}).click();
    const loginResult=await loginReply;
    if(loginResult.status()!==200){
      const data=await loginResult.json().catch(()=>({}));
      throw new Error('Visual buyer login returned HTTP '+loginResult.status()+': '+String(data.error||'unknown').slice(0,120));
    }
    await page.locator('.hero-banner').waitFor({state:'visible',timeout:15000});
    if(await page.locator('.header-inner .location').count()!==0)
      throw new Error('Resident header must not include condominium location at '+width+'px');
    const storeShortcut=page.getByRole('button',{name:'Minha loja / Quero vender',exact:true});
    await storeShortcut.waitFor({state:'visible'});
    await verify(page,'home',width);
    // A decorated plus must live inside the existing product-open button, not
    // introduce a nested button or bypass product customization on click.
    const addHint=page.locator('.product-grid .product-card:not(.is-unavailable) .product-card-add-hint').first();
    await addHint.waitFor({state:'visible'});
    const affordance=await addHint.evaluate(el=>{
      const style=getComputedStyle(el);
      return {color:style.backgroundColor,radius:parseFloat(style.borderRadius),pointerEvents:style.pointerEvents,
        parent:el.closest('button')?.className};
    });
    if(affordance.color!=='rgb(255, 207, 37)'||affordance.radius<8||
       affordance.pointerEvents!=='none'||affordance.parent!=='product-open')
      throw new Error('Product plus affordance inconsistent: '+JSON.stringify(affordance));
    if(await page.getByText('Produtos adicionados nos últimos 3 dias',{exact:true}).count())
      throw new Error('The Novidades por aqui subtitle should be removed');
    await addHint.scrollIntoViewIfNeeded();
    const hintBox=await addHint.boundingBox();
    const photoBox=await addHint.locator('xpath=ancestor::*[contains(@class,"product-card")][1]').locator('.product-card-media').boundingBox();
    const priceBox=await addHint.locator('xpath=..').locator('.product-prices').boundingBox();
    if(!hintBox||!photoBox||!priceBox)throw new Error('The price-footer plus must be visible and tappable');
    if(hintBox.y<photoBox.y+photoBox.height-1||hintBox.x<priceBox.x+priceBox.width-1)
      throw new Error('Product plus must sit below photo, to the right of the prices at '+width+'px');
    await page.mouse.click(hintBox.x+hintBox.width/2,hintBox.y+hintBox.height/2);
    await page.locator('.product-detail').waitFor({state:'visible'});
    await page.getByRole('button',{name:'Início Elevadoor'}).click();
    await page.locator('.hero-banner').waitFor({state:'visible'});
    // Web inbox shares the same ten-at-a-time list and preferences as native.
    await page.getByRole('button',{name:'Notificações',exact:true}).click();
    await page.getByRole('heading',{name:'Notificações',exact:true}).waitFor({state:'visible'});
    await page.getByRole('button',{name:'Preferências de notificações'}).waitFor({state:'visible'});
    await verify(page,'notifications',width);
    await page.getByRole('button',{name:'Preferências de notificações'}).click();
    await page.getByRole('switch',{name:'Avisos do condomínio'}).waitFor({state:'visible'});
    await verify(page,'notification-preferences',width);
    await page.getByRole('button',{name:'Início Elevadoor'}).click();
    await page.locator('.hero-banner').waitFor({state:'visible'});
    await storeShortcut.click();
    await page.getByRole('heading',{name:'Painel do vendedor'}).waitFor({state:'visible'});
    await verify(page,'seller-shortcut',width);
    await page.getByRole('button',{name:'Início Elevadoor'}).click();
    await page.locator('.hero-banner').waitFor({state:'visible'});
    await verifyRoundCategories(page,'.category-track:not(.explore-category-track)',width);
    const nav=(label)=>page.locator(width<900?'.bottom-nav':'.desktop-nav')
      .getByRole('button',{name:label,exact:true});
    await nav('Explorar').click();
    await page.locator('.explore-category-track').waitFor({state:'visible'});
    await verify(page,'explore',width);
    await verifyRoundCategories(page,'.explore-category-track',width);
    await page.locator('.shops-list .shop-row').first().click();
    await page.locator('.shop-rating').waitFor({state:'visible'});
    await verify(page,'shop',width);
    const shopPath=new URL(page.url()).pathname;
    if(!/^\/loja\/[a-z0-9-]+$/.test(shopPath))throw Error('Store profile must expose readable storefront URL');
    const shared=await context.newPage();
    await shared.goto(origin+shopPath,{waitUntil:'domcontentloaded'});
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
    await page.locator('.account-legal-links a[href="/politica-de-privacidade"]').waitFor({state:'visible'});
    await page.locator('.account-legal-links a[href="/termos-de-uso"]').waitFor({state:'visible'});
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
      await sellerPage.locator('.auth-card input[type="password"]').fill('A1!aaaaa');
      await sellerPage.getByRole('button',{name:'Entrar com e-mail'}).click();
      await sellerPage.locator('.hero-banner').waitFor({state:'visible',timeout:15000});
      await sellerPage.locator('.bottom-nav').getByRole('button',{name:'Conta'}).click();
      await sellerPage.locator('.account-shortcuts button').filter({hasText:/Minha loja|Quero vender/}).first().click();
      await sellerPage.locator('.seller-tabs').waitFor({state:'visible'});
      const stages=sellerPage.locator('.seller-order-sections');
      await stages.waitFor({state:'visible'});
      for(const [stage,scene] of [['Novos','seller-new'],['Em andamento','seller-ongoing'],['Histórico','seller-history']]){
        await stages.getByRole('tab',{name:new RegExp(stage)}).click();
        if(await stages.getByRole('tab',{name:new RegExp(stage)}).getAttribute('aria-selected')!=='true')
          throw new Error('Seller order tab did not become selected: '+stage);
        await verify(sellerPage,scene,width);
      }
      const firstSummary=sellerPage.locator('.seller-order-summary').first();
      if(await firstSummary.count()){
        await firstSummary.click();
        await sellerPage.locator('.seller-order-expanded').first().waitFor({state:'visible'});
        await verify(sellerPage,'seller-order-details',width);
        await firstSummary.click();
      }
      await sellerPage.locator('.seller-tabs button').filter({hasText:'Avaliações'}).click();
      await sellerPage.locator('.seller-review-card').first().waitFor({state:'visible'});
      await verify(sellerPage,'seller-reviews',width);
      await sellerContext.close();

      // The platform superadmin retains the active condominium picker in the header.
      const adminContext=await browser.newContext({viewport:{width,height:820},deviceScaleFactor:1});
      const adminPage=await adminContext.newPage();
      await adminPage.goto(origin,{waitUntil:'domcontentloaded'});
      await adminPage.locator('.auth-card').waitFor({state:'visible'});
      await adminPage.locator('.auth-card input[type="email"]').fill(process.env.BOOTSTRAP_ADMIN_EMAIL||'admin-smoke@example.com');
      await adminPage.locator('.auth-card input[type="password"]').fill(process.env.BOOTSTRAP_ADMIN_PASSWORD||'CIOnlyLongSecurePass123!');
      await adminPage.getByRole('button',{name:'Entrar com e-mail'}).click();
      await adminPage.locator('.header-inner.admin-header .location').waitFor({state:'visible',timeout:15000});
      await adminPage.getByText('Você está em',{exact:true}).waitFor({state:'visible'});
      await verify(adminPage,'admin-header',width);
      // Growth dashboard has no background polling and does not load unrelated
      // tenant-selection or campaign APIs unless those sections are opened.
      const adminRequests=[];
      adminPage.on('request',req=>{
        const pathname=new URL(req.url()).pathname;
        if(pathname.startsWith('/api/platform/'))adminRequests.push(pathname);
      });
      await adminPage.locator('.bottom-nav').getByRole('button',{name:'Conta'}).click();
      await adminPage.locator('.account-shortcuts button').filter({hasText:'Painel Superadmin'}).click();
      await adminPage.getByRole('heading',{name:'Evolução do Elevadoor'}).waitFor({state:'visible'});
      await adminPage.locator('.platform-growth-kpi').first().waitFor({state:'visible'});
      if(!await adminPage.locator('.platform-growth-ranking table').count())
        throw new Error('Global condominium ranking is missing');
      if(adminRequests.some(path=>path==='/api/platform/discovery-campaigns'))
        throw new Error('Unopened campaigns panel must not fetch its data');
      if(adminRequests.some(path=>path==='/api/platform/condominiums'))
        throw new Error('Growth tab must not load unrelated condominium lists');
      await verify(adminPage,'platform-growth',width);
      await adminPage.getByRole('button',{name:'7 dias'}).click();
      await adminPage.locator('.platform-growth-kpi').first().waitFor({state:'visible'});
      await verify(adminPage,'platform-growth-week',width);
      await adminPage.getByRole('button',{name:'Condomínios',exact:true}).click();
      await adminPage.getByRole('heading',{name:'Criar condomínio'}).waitFor({state:'visible'});
      await adminContext.close();
    }
  }
  console.log('Responsive visual QA PASS: '+checked+' views checked at '+widths.join(', ')+'px');
}finally{
  await browser.close();
}
