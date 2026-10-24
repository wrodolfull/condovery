import pg from 'pg';
import {createClient} from '@supabase/supabase-js';

if(!process.env.DATABASE_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error('DATABASE_URL, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const db=new pg.Client({connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:false});
const supabase=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
});
const bucket='condovery-media';
await db.connect();
let processed=0,pending=0;
try{
  const jobs=await db.query(
    'SELECT id,auth_user_id,storage_keys,auth_done,storage_done FROM account_deletion_jobs '+
    'WHERE finished_at IS NULL ORDER BY created_at LIMIT 100'
  );
  for(const job of jobs.rows){
    try{
      if(!job.auth_done){
        const {error}=await supabase.auth.admin.deleteUser(job.auth_user_id);
        if(error&&error.status!==404&&error.code!=='user_not_found')throw error;
        await db.query('UPDATE account_deletion_jobs SET auth_done=true WHERE id=$1',[job.id]);
      }
      if(!job.storage_done){
        const keys=Array.isArray(job.storage_keys)?[...new Set(job.storage_keys)]:[];
        for(let i=0;i<keys.length;i+=100){
          const {error}=await supabase.storage.from(bucket).remove(keys.slice(i,i+100));
          if(error)throw error;
        }
        await db.query('UPDATE account_deletion_jobs SET storage_done=true WHERE id=$1',[job.id]);
      }
      await db.query("UPDATE account_deletion_jobs SET finished_at=now(),storage_keys='[]'::jsonb,last_error=NULL WHERE id=$1",
        [job.id]);
      processed++;
    }catch(error){
      const reason=error instanceof Error?error.message:'Unknown external cleanup error';
      await db.query('UPDATE account_deletion_jobs SET attempts=attempts+1,last_error=$2 WHERE id=$1',
        [job.id,reason.slice(0,200)]);
      pending++;
    }
  }
  console.log('Deleted-account cleanup: completed='+processed+' pending='+pending);
  if(pending)process.exitCode=1;
}finally{await db.end();}
