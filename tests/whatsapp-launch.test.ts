import test from 'node:test';
import assert from 'node:assert/strict';
import {supportsMessengerIntent,whatsappMessengerHref} from '../src/lib/whatsapp-launch';

const chrome='Mozilla/5.0 (Linux; Android 16; SM-A356E) AppleWebKit/537.36 Chrome/142.0 Mobile Safari/537.36';
const source='https://wa.me/5511999998888?text='+encodeURIComponent('Pedido #123\nBolo 2× R$ 15,00\nTotal: R$ 30,00');
test('Android Chrome targets normal WhatsApp Messenger and preserves message',()=>{
  const href=whatsappMessengerHref(source,chrome);
  assert.match(href,/^intent:\/\/send\?/);
  assert.match(href,/#Intent;scheme=whatsapp;package=com\.whatsapp;/);
  assert.ok(!href.includes('package=com.whatsapp.w4b'));
  const phone=new URLSearchParams(href.split('?')[1].split('#Intent')[0]);
  assert.equal(phone.get('phone'),'5511999998888');
  assert.equal(phone.get('text'),'Pedido #123\nBolo 2× R$ 15,00\nTotal: R$ 30,00');
  assert.ok(href.includes('S.browser_fallback_url='+encodeURIComponent(source)));
});

test('Other browsers retain the official wa.me checkout URL',()=>{
  const ios='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1';
  const desktop='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142.0';
  const androidFirefox='Mozilla/5.0 (Android 16; Mobile; rv:135.0) Gecko/135.0 Firefox/135.0';
  const samsung='Mozilla/5.0 (Linux; Android 16) AppleWebKit/537.36 Chrome/122.0 SamsungBrowser/27.0';
  for(const agent of [ios,desktop,androidFirefox,samsung]){
    assert.equal(supportsMessengerIntent(agent),false);
    assert.equal(whatsappMessengerHref(source,agent),source);
  }
  assert.equal(supportsMessengerIntent(chrome),true);
});

test('Malformed and foreign checkout links are not converted to intents',()=>{
  assert.equal(whatsappMessengerHref('javascript:alert(1)',chrome),'javascript:alert(1)');
  assert.equal(whatsappMessengerHref('https://wa.me.evil.com/5511999998888',chrome),'https://wa.me.evil.com/5511999998888');
  assert.equal(whatsappMessengerHref('https://wa.me/not-a-number',chrome),'https://wa.me/not-a-number');
});
