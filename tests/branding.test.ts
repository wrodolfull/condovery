import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(path,'utf8');
const brandedSurfaces=[
  'src/app/page.tsx',
  'src/app/landing/page.tsx',
  'src/app/conheca/page.tsx',
  'src/app/conheca/layout.tsx',
  'src/app/layout.tsx',
  'src/app/manifest.ts',
  'src/app/ajuda/page.tsx',
  'src/app/politica-de-privacidade/page.tsx',
  'src/app/termos-de-uso/page.tsx',
  'src/app/relatorio/ads/[token]/page.tsx',
  'src/app/loja/[slug]/layout.tsx',
  'src/components/HelpCenter.tsx',
  'src/components/LegalPage.tsx',
  'src/components/AdsAdmin.tsx',
  'src/components/AdvertiserReportView.tsx',
  'src/lib/help-content.ts',
  'src/lib/orders.ts',
  'src/server/advertiser-report-pdf.ts',
  'src/server/push.ts',
];
test('all primary UI, SEO, legal, report and outbound-message surfaces use Elevadoor',()=>{
  for(const path of brandedSurfaces){
    const source=read(path);
    assert.doesNotMatch(source,/\bCondovery\b|\bCONDOVERY\b|condovery<span|condovery\.<\/strong>/,
      'Legacy visible branding in '+path);
  }
  assert.match(read('src/app/layout.tsx'),/applicationName: 'Elevadoor'/);
  assert.match(read('src/app/manifest.ts'),/short_name:'Elevadoor'/);
  assert.match(read('src/app/page.tsx'),/elevadoor<span/);
  assert.match(read('src/lib/orders.ts'),/pedido pelo Elevadoor/);
  for(const path of ['public/landing/hero-phones.svg','public/landing/step-explore.svg']){
    assert.match(read(path),/>Elevadoor<\/text>/,path+' mockup wordmark');
  }
});
