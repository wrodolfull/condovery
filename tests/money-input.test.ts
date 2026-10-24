import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMoneyInput} from '../src/lib/money-input';

test('accepts money input on Windows and Android with comma or dot',()=>{
  for(const [raw,cents] of [['',0],['0',0],['1',100],['12',1200],
    ['12,5',1250],['12.50',1250],['0,01',1],['.25',25],
    ['10,00',1000],['10000,00',1_000_000]] as const){
    assert.equal(parseMoneyInput(raw),cents,'input '+raw);
  }
});

test('rejects invalid, negative, and above-maximum money',()=>{
  for(const raw of ['abc','1,234','-5','10 00','10,5,','10001','10000,01']){
    assert.equal(parseMoneyInput(raw),null,'input '+raw);
  }
});
