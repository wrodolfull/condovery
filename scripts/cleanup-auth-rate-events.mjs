import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:false});
await client.connect();
try{
  const clean=await client.query("DELETE FROM auth_rate_events WHERE occurred_at < now()-interval '48 hours'");
  console.log('Expired anonymized authentication rate events:',clean.rowCount);
}finally{await client.end();}
