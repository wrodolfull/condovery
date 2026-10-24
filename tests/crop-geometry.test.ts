import test from 'node:test';
import assert from 'node:assert/strict';
import {cropGeometry} from '../src/lib/crop-geometry';

test('square crop of a wide image centers and permits horizontal dragging',()=>{
  const c=cropGeometry(2000,1000,320,1,1);
  assert.equal(c.sw,1000);assert.equal(c.sh,1000);
  assert.equal(c.sx,500);assert.equal(c.sy,0);
  const left=cropGeometry(2000,1000,320,1,1,10000);
  assert.equal(left.sx,0);
  const right=cropGeometry(2000,1000,320,1,1,-10000);
  assert.equal(right.sx,1000);
});
test('cover crop and zoom cannot sample beyond source image',()=>{
  for(const aspect of [1,1.17,3])for(const zoom of [1,1.2,2,3]){
    for(const x of [-100000,0,100000])for(const y of [-100000,0,100000]){
      const c=cropGeometry(800,1600,320,aspect,zoom,x,y);
      assert.ok(c.sx>=-0.00001&&c.sy>=-0.00001);
      assert.ok(c.sx+c.sw<=800.00001&&c.sy+c.sh<=1600.00001);
    }
  }
});
