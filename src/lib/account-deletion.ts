import {query} from '@/lib/db';
import {storageAdmin, STORAGE_BUCKET} from '@/lib/supabase';

type DeletionJob={
  id:string;auth_user_id:string;storage_keys:string[];auth_done:boolean;storage_done:boolean
};
export async function processAccountDeletionJob(id:string):Promise<'completed'|'pending'>{
  const found=await query<DeletionJob>(
    'SELECT id,auth_user_id,storage_keys,auth_done,storage_done FROM account_deletion_jobs WHERE id=$1',
    [id]
  );
  if(!found.rowCount)return 'completed';
  const job=found.rows[0];
  const admin=storageAdmin();
  try{
    if(!job.auth_done){
      const {error}=await admin.auth.admin.deleteUser(job.auth_user_id);
      if(error&&error.status!==404&&error.code!=='user_not_found')throw error;
      await query('UPDATE account_deletion_jobs SET auth_done=true,last_error=NULL WHERE id=$1',[id]);
    }
    if(!job.storage_done){
      const keys=Array.isArray(job.storage_keys)?[...new Set(job.storage_keys)]:[];
      for(let i=0;i<keys.length;i+=100){
        const {error}=await admin.storage.from(STORAGE_BUCKET).remove(keys.slice(i,i+100));
        if(error)throw error;
      }
      await query('UPDATE account_deletion_jobs SET storage_done=true,last_error=NULL WHERE id=$1',[id]);
    }
    await query(
      'UPDATE account_deletion_jobs SET finished_at=now(),storage_keys=\'[]\'::jsonb,last_error=NULL WHERE id=$1',
      [id]
    );
    return 'completed';
  }catch(e){
    const detail=e instanceof Error?e.message:'External service error';
    await query('UPDATE account_deletion_jobs SET attempts=attempts+1,last_error=$2 WHERE id=$1',
      [id,detail.slice(0,200)]);
    console.error('account_deletion_cleanup_pending',id,detail.slice(0,120));
    return 'pending';
  }
}
