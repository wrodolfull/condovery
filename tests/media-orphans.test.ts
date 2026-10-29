import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORPHAN_MEDIA_MIN_AGE_DAYS,
  ORPHAN_MEDIA_MAX_BATCH,
  parseOrphanMediaOptions,
  findOrphanMediaSQL,
  lockOrphanMediaSQL,
  mediaReferencedSQL
} from '../src/lib/media-orphans';

test('dry-run is default with at least 30 days and a bounded batch',()=>{
  assert.deepEqual(parseOrphanMediaOptions([]),{apply:false,days:30,limit:50});
  assert.deepEqual(parseOrphanMediaOptions(['--apply','--days=90','--limit=25']),{apply:true,days:90,limit:25});
  assert.equal(ORPHAN_MEDIA_MIN_AGE_DAYS,30);
  assert.equal(ORPHAN_MEDIA_MAX_BATCH,100);
});
test('unsafe or ambiguous cleanup options fail closed',()=>{
  for(const argument of ['--days=29','--days=0','--limit=0','--limit=101','--days=foo','--force','--all','--apply=1']){
    assert.throws(()=>parseOrphanMediaOptions([argument]));
  }
  assert.throws(()=>parseOrphanMediaOptions(['--apply','--apply']));
  assert.throws(()=>parseOrphanMediaOptions(['--days=30','--days=90']));
  assert.throws(()=>parseOrphanMediaOptions(['--limit=999999999999999999999']));
});
test('protect every persisted use of media, including unpublished records',()=>{
  const protectedReferences=[
    ['users','avatar_image'],['shops','logo_image'],['shops','cover_image'],
    ['products','image_url'],['giveaway_items','image_url'],
    ['advertising_campaigns','image_url'],['community_fairs','cover_image_url']
  ];
  for(const [table,column] of protectedReferences){
    assert.match(mediaReferencedSQL,new RegExp('FROM public\\.'+table+'\\s'));
    assert.match(mediaReferencedSQL,new RegExp('\\.'+column+'\\)'));
  }
  assert.equal((mediaReferencedSQL.match(/EXISTS \\(SELECT/g)??[]).length,6);
  assert.doesNotMatch(mediaReferencedSQL,/(status='approved'|published=true|condominium_id=)/);
  assert.match(mediaReferencedSQL,/LOWER/);
});
test('listing and per-asset lock both require aged unreferenced metadata',()=>{
  assert.match(findOrphanMediaSQL,/m\.created_at < now\(\)/);
  assert.match(findOrphanMediaSQL,/AND NOT/);
  assert.match(findOrphanMediaSQL,/LIMIT \$2/);
  assert.match(lockOrphanMediaSQL,/AND NOT/);
  assert.match(lockOrphanMediaSQL,/FOR UPDATE OF m/);
  assert.match(lockOrphanMediaSQL,/m\.condominium_id=\$2/);
});
