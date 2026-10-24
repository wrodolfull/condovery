import test from 'node:test';
import assert from 'node:assert/strict';
import {clientUUID,uuidV4FromBytes} from '../src/lib/client-uuid';

test('client UUID is RFC 4122 version 4, including via getRandomValues',()=>{
  const uuid=uuidV4FromBytes(new Uint8Array(16).fill(255));
  assert.equal(uuid,'ffffffff-ffff-4fff-bfff-ffffffffffff');
  assert.match(clientUUID(),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(clientUUID(),clientUUID());
});

test('rejects unexpected entropy size',()=>{
  assert.throws(()=>uuidV4FromBytes(new Uint8Array(8)),/16 random bytes/);
});
