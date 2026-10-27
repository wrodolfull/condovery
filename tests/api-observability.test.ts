import test from 'node:test';
import assert from 'node:assert/strict';
import {safeApiRoute,buildApiRequestMetric} from '../src/lib/api-observability';

test('route labels never expose ids, slugs, e-mails or unrecognized path values',()=>{
  assert.equal(safeApiRoute(['orders','b2c-123','review']),'/api/orders/:param/reviews'.replace('/reviews','/:param'));
  assert.equal(safeApiRoute(['auth','login']),'/api/auth/login');
  assert.equal(safeApiRoute(['platform','condominiums','private-condo-name','switch']),
    '/api/platform/condominiums/:param/switch');
  assert.equal(safeApiRoute(['media','user@example.com?token=secret']),'/api/media/:param');
  assert.equal(safeApiRoute([]),'/api');
  assert.equal(safeApiRoute(['a','b','c','d','e','f']),'/api/:param/:param/:param/:param/:param/*');
});

test('all server errors and slow requests are measured even without sampling',()=>{
  const common={method:'GET',parts:['orders','private-uuid'],durationMs:1};
  assert.deepEqual(buildApiRequestMetric({...common,status:500},{sampleRate:0}),{
    event:'condovery_api_request',kind:'error',method:'GET',
    route:'/api/orders/:param',status:500,duration_ms:1
  });
  assert.equal(buildApiRequestMetric({...common,status:200,durationMs:1500},{sampleRate:0})?.kind,'slow');
});

test('fast requests respect sampling and timings are rounded',()=>{
  const data={method:'POST',parts:['auth','login'],status:200,durationMs:27.6};
  assert.equal(buildApiRequestMetric(data,{sampleRate:0}),null);
  assert.equal(buildApiRequestMetric(data,{sampleRate:0.2,random:()=>0.5}),null);
  assert.equal(buildApiRequestMetric(data,{sampleRate:0.2,random:()=>0.1})?.duration_ms,28);
});

test('no user information is present in a metric payload',()=>{
  const metric=buildApiRequestMetric({
    method:'GET',parts:['shops','secret-slug','user@example.com'],status:503,durationMs:120
  },{sampleRate:0});
  const json=JSON.stringify(metric);
  assert.ok(!json.includes('secret-slug'));
  assert.ok(!json.includes('user@example.com'));
});
