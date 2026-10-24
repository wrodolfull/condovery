import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_IMAGE_BYTES,imageSizeIsAllowed} from '../src/lib/image-limits';

test('allow source images up to 10 MiB and reject invalid sizes',()=>{
  assert.equal(MAX_IMAGE_BYTES,10*1024*1024);
  assert.equal(imageSizeIsAllowed(1),true);
  assert.equal(imageSizeIsAllowed(MAX_IMAGE_BYTES),true);
  for(const size of [0,-1,MAX_IMAGE_BYTES+1,NaN,Infinity])assert.equal(imageSizeIsAllowed(size),false);
});
