import { readFile } from 'node:fs/promises';
import pg from 'pg';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const client=new pg.Client({
  connectionString:process.env.DATABASE_URL,
  ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:false
});
await client.connect();
try {
  const schema=await readFile(new URL('../db/schema.sql',import.meta.url),'utf8');
  await client.query(schema);
  const migration=await readFile(new URL('../db/002_supabase_google_storage.sql',import.meta.url),'utf8');
  await client.query(migration);
  console.log('Condovery database schema applied successfully.');
} finally {
  await client.end();
}
