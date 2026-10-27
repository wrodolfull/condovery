import pg from 'pg';
if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required.');
const client=new pg.Client({connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:false});
await client.connect();
try{
  const result=await client.query("DELETE FROM ad_metric_dedupe WHERE day < current_date - interval '30 days'");
  console.log('Expired advertising deduplication keys removed:',result.rowCount);
}finally{await client.end();}
