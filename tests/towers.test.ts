import test from 'node:test';
import assert from 'node:assert/strict';
import {towerLabel,towerLabels,currentTowerScheme} from '../src/lib/towers';

test('supports thirty towers with letters through AD',()=>{
  const names=towerLabels('letters',30);
  assert.equal(names.length,30);
  assert.equal(names[0],'Torre A');
  assert.equal(names[25],'Torre Z');
  assert.deepEqual(names.slice(26),['Torre AA','Torre AB','Torre AC','Torre AD']);
  assert.equal(currentTowerScheme(names),'letters');
});
test('supports thirty numbered towers',()=>{
  const names=towerLabels('numbers',30);
  assert.equal(names.length,30);
  assert.equal(names[0],'Torre 1');assert.equal(names[29],'Torre 30');
  assert.equal(currentTowerScheme(names),'numbers');
});
test('rejects invalid counts or indices',()=>{
  for(const count of [0,31,2.5])assert.throws(()=>towerLabels('letters',count));
  assert.throws(()=>towerLabel('numbers',30));
});
