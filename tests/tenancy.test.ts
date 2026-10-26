import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCondominiumSlug,normalizeTenantDomain} from '../src/lib/tenancy';
test('tenant slugs and domains are normalized',()=>{
 assert.equal(normalizeCondominiumSlug('Morada do Vale'),'morada-do-vale');
 assert.equal(normalizeTenantDomain('Morada.Exemplo.com.br'),'morada.exemplo.com.br');
 assert.throws(()=>normalizeTenantDomain('https://bad.example.com'));
});
