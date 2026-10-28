import test from 'node:test';
import assert from 'node:assert/strict';
import {rateFingerprint} from '../src/lib/auth-rate-limit';
import {requestOriginPolicy} from '../src/lib/request-protection';
const opts={method:'POST',origin:'https://condovery.example',fetchSite:'same-origin',requestHost:'condovery.example',production:true};
test('anti-automation HMAC is stable but segregated by kind and action',()=>{
  const secret='a'.repeat(64);
  const account=rateFingerprint(secret,'login','id','resident@example.com');
  assert.equal(account.length,64);
  assert.equal(account,rateFingerprint(secret,'login','id','resident@example.com'));
  assert.notEqual(account,rateFingerprint(secret,'recovery','id','resident@example.com'));
  assert.notEqual(account,rateFingerprint(secret,'login','ip','resident@example.com'));
  assert.notEqual(account,rateFingerprint('b'.repeat(64),'login','id','resident@example.com'));
  assert.ok(!account.includes('resident'));
});
test('cross-site POST is refused; same-origin and server requests allowed',()=>{
  assert.equal(requestOriginPolicy(opts),'allow');
  assert.equal(requestOriginPolicy({...opts,origin:'https://evil.example'}),'reject');
  assert.equal(requestOriginPolicy({...opts,origin:'https://sibling.condovery.example'}),'reject');
  assert.equal(requestOriginPolicy({...opts,origin:'http://condovery.example'}),'reject');
  assert.equal(requestOriginPolicy({...opts,origin:null,fetchSite:'cross-site'}),'reject');
  assert.equal(requestOriginPolicy({...opts,origin:null,fetchSite:'same-site'}),'reject');
  assert.equal(requestOriginPolicy({...opts,origin:null,fetchSite:null}),'allow');
  assert.equal(requestOriginPolicy({...opts,method:'GET',origin:'https://evil.example'}),'allow');
});
