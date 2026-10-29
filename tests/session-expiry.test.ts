import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceSessionGeneration,currentSessionGeneration,sessionWasRevoked
} from '../src/lib/session-expiry';

test('a 401 from a protected request expires only the currently active login',()=>{
  const current=currentSessionGeneration();
  assert.equal(sessionWasRevoked(401,'orders','GET',current),true);
  assert.equal(sessionWasRevoked(401,'products','POST',current),true);
  assert.equal(sessionWasRevoked(403,'orders','GET',current),false);
  assert.equal(sessionWasRevoked(500,'orders','GET',current),false);
  advanceSessionGeneration();
  assert.equal(sessionWasRevoked(401,'orders','GET',current),false);
  assert.equal(sessionWasRevoked(401,'orders','GET',currentSessionGeneration()),true);
});
test('invalid login, signup and wrong account deletion password are not session expiry',()=>{
  const current=currentSessionGeneration();
  for(const path of ['auth/login','auth/register','auth/password/request','auth/register-google','public/condominium']){
    assert.equal(sessionWasRevoked(401,path,'POST',current),false);
  }
  assert.equal(sessionWasRevoked(401,'me','DELETE',current),false);
  assert.equal(sessionWasRevoked(401,'me','PATCH',current),true);
});
