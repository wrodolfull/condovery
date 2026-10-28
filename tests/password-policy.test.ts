import test from 'node:test';
import assert from 'node:assert/strict';
import {isValidPassword,passwordStatus} from '../src/lib/password-policy';

test('accepts exactly eight characters with uppercase, digit and special',()=>{
  assert.equal('A1!aaaaa'.length,8);
  assert.equal(isValidPassword('A1!aaaaa'),true);
  assert.equal(isValidPassword('Á1!aaaaa'),true);
});
test('requires every rule, not just eight characters',()=>{
  for(const candidate of ['A1!aaaa','a1!aaaaa','AA!aaaaa','AA1aaaaa','abcdefgh']){
    assert.equal(isValidPassword(candidate),false,candidate);
  }
  assert.equal(isValidPassword('A1!'+ 'a'.repeat(98)),false,'more than 100 characters');
});
test('indicates progress without revealing password text',()=>{
  const empty=passwordStatus('');
  assert.equal(empty.strength,0);
  assert.equal(empty.valid,false);
  const short=passwordStatus('A1!');
  assert.equal(short.length,3);
  assert.deepEqual(short.requirements.map(x=>x.met),[false,true,true,true]);
  const valid=passwordStatus('A1!aaaaa');
  assert.equal(valid.valid,true);
  assert.deepEqual(valid.requirements.map(x=>x.met),[true,true,true,true]);
  const strong=passwordStatus('Abcdefghi123!@#');
  assert.equal(strong.strength,4);
});
