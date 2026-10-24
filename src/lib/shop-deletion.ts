import {query} from '@/lib/db';
import {STORAGE_BUCKET,storageAdmin} from '@/lib/supabase';

type ShopDeletionJob={id:string;storage_keys:string[]};
export async function processShopDeletionJob(id:string):Promise<'completed'|'pending'>{
  const found=await query<ShopDeletionJob>(
    'SELECT id,storage_keys FROM shop_deletion_jobs WHERE id=$1 AND finished_at IS NULL',[id]
  );
  if(!found.rowCount)return 'completed';
  const job=found.rows[0];
  try{
    const keys=Array.isArray(job.storage_keys)?[...new Set(job.storage_keys.filter(x=>typeof x==='string'))]:[];
    if(keys.length){
      const storage=storageAdmin();
      for(let i=0;i<keys.length;i+=100){
        const {error}=await storage.storage.from(STORAGE_BUCKET).remove(keys.slice(i,i+100));
        if(error)throw error;
      }
    }
    await query("UPDATE shop_deletion_jobs SET finished_at=now(),storage_keys='[]'::jsonb,last_error=NULL,storage_done=true WHERE id=$1",[id]);
    return 'completed';
  }catch(e){
    const detail=(e instanceof Error?e.message:'Unknown Storage error').slice(0,200);
    await query('UPDATE shop_deletion_jobs SET attempts=attempts+1,last_error=$2 WHERE id=$1',[id,detail]);
    console.error('shop_deletion_storage_cleanup_pending',id,detail);
    return 'pending';
  }
}
