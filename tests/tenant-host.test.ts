import test from 'node:test';
import assert from 'node:assert/strict';
import {tenantLabel,tenantSubdomainFromHost} from '../src/lib/tenant-host';

test('friendly tenant label',()=>{
 assert.equal(tenantLabel('morada-do-vale'),'moradadovale');
});
test('subdomains resolve only for the canonical base domain',()=>{
 assert.equal(tenantSubdomainFromHost('moradadovale.condovery.com','condovery.com'),'moradadovale');
 for(const host of ['condovery.com','www.condovery.com','moradadovale.condovery.com.evil.org',
   'other.moradadovale.condovery.com','api.condovery.com','random.net']){
   assert.equal(tenantSubdomainFromHost(host,'condovery.com'),null);
 }
});
