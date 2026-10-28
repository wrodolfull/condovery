import test from 'node:test';
import assert from 'node:assert/strict';
import {buildAdvertiserPdf} from '../src/server/advertiser-report-pdf';
import type {AdvertiserReport} from '../src/server/advertiser-report';

test('advertiser PDF exports valid PDF header, xref and multiple pages without commercial fields',()=>{
  const daily=Array.from({length:45},(_,i)=>{
    const date=new Date('2026-09-01T00:00:00Z');
    date.setUTCDate(date.getUTCDate()+i);
    return {day:date.toISOString().slice(0,10),impressions:10+i,clicks:i%5};
  });
  const report:AdvertiserReport={
    campaign:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',merchant_name:'Marmitaria (Centro)',headline:'Refeicoes por encomenda',
      condominium_name:'Morada do Vale',starts_at:'2026-09-01T00:00:00.000Z',expires_at:'2026-11-01T00:00:00.000Z'},
    period:{from:'2026-09-01',to:'2026-10-15',range:'all'},
    totals:{impressions:1440,clicks:100,ctr:6.94},
    daily,daily_truncated:false,disclaimer:'Dados agregados.'
  };
  const pdf=buildAdvertiserPdf(report);
  const raw=pdf.toString('latin1');
  assert.ok(raw.startsWith('%PDF-1.4'));
  assert.match(raw,/\/Type \/Pages \/Kids/);
  assert.match(raw,/\/Count 3/);
  assert.match(raw,/xref\n0 \d+\n/);
  assert.ok(raw.includes('Marmitaria'));
  assert.ok(raw.includes('1440')||raw.includes('1.440'));
  assert.ok(!raw.includes('contract_amount_cents'));
  assert.ok(pdf.length>3000);
});
