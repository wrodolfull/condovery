// Run hourly from cron/PM2 on the Condovery server.
// Removes donated giveaways after 48 hours, including their media stored in Supabase.
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required.');
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Supabase storage credentials missing.');
const db=new pg.Client({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:false});
const storage=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
await db.connect();
try {
 const items=await db.query("SELECT id,condominium_id,image_url FROM giveaway_items WHERE status='donated' AND donated_at <= now()-interval '48 hours' ORDER BY donated_at LIMIT 200");
 let completed=0;
 for(const item of items.rows){
   const asset=/^\/api\/media\/([0-9a-f-]{36})$/i.exec(item.image_url||'');
   if(asset){
     const media=await db.query('SELECT id,storage_key FROM media_assets WHERE id=$1 AND condominium_id=$2',[asset[1],item.condominium_id]);
     if(media.rowCount){
       if(media.rows[0].storage_key){
         const {error}=await storage.storage.from('condovery-media').remove([media.rows[0].storage_key]);
         if(error){console.error('Could not remove giveaway image',item.id,error.message);continue;}
       }
       await db.query('DELETE FROM media_assets WHERE id=$1 AND condominium_id=$2',[asset[1],item.condominium_id]);
     }
   }
   const deleted=await db.query("DELETE FROM giveaway_items WHERE id=$1 AND status='donated' AND donated_at <= now()-interval '48 hours' RETURNING id",[item.id]);
   completed+=deleted.rowCount;
 }
 console.log('Expired donated giveaways removed:',completed);
}finally{await db.end();}
