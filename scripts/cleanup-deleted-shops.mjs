import pg from 'pg';
import {createClient} from '@supabase/supabase-js';

if(!process.env.DATABASE_URL||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error('Missing database or Supabase service connection');
const client=new pg.Client({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:false
});
const storage=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{
  auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
}).storage.from('condovery-media');
await client.connect();
try{
  const jobs=await client.query("SELECT id,storage_keys FROM shop_deletion_jobs WHERE finished_at IS NULL ORDER BY created_at LIMIT 50");
  for(const job of jobs.rows){
    const keys=Array.isArray(job.storage_keys)?[...new Set(job.storage_keys.filter(x=>typeof x==='string'))]:[];
    try{
      for(let i=0;i<keys.length;i+=100){
        const {error}=await storage.remove(keys.slice(i,i+100));
        if(error)throw error;
      }
      await client.query("UPDATE shop_deletion_jobs SET finished_at=now(),storage_keys='[]'::jsonb,storage_done=true,last_error=NULL WHERE id=$1",[job.id]);
    }catch(e){
      const message=(e instanceof Error?e.message:'Storage cleanup failure').slice(0,200);
      await client.query('UPDATE shop_deletion_jobs SET attempts=attempts+1,last_error=$2 WHERE id=$1',[job.id,message]);
      console.error('Cleanup still pending for job '+job.id+': '+message);
    }
  }
  console.log('Shop deletion cleanup checked: '+jobs.rows.length+' jobs');
}finally{await client.end();}
