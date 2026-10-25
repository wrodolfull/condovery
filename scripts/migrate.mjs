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
  const unified=await readFile(new URL('../db/003_unified_supabase_auth.sql',import.meta.url),'utf8');
  await client.query(unified);
  const reviews=await readFile(new URL('../db/004_shop_reviews.sql',import.meta.url),'utf8');
  await client.query(reviews);
  const additions=await readFile(new URL('../db/005_seller_profile_product_visibility.sql',import.meta.url),'utf8');
  await client.query(additions);
  const standardCategories=await readFile(new URL('../db/006_default_categories.sql',import.meta.url),'utf8');
  await client.query(standardCategories);
  const instant=await readFile(new URL('../db/007_instant_memberships_and_content_reports.sql',import.meta.url),'utf8');
  await client.query(instant);
  const checkout=await readFile(new URL('../db/008_checkout_options_and_fees.sql',import.meta.url),'utf8');
  await client.query(checkout);
  const accountDeletion=await readFile(new URL('../db/009_account_deletion.sql',import.meta.url),'utf8');
  await client.query(accountDeletion);
  const foodOnly=await readFile(new URL('../db/010_food_only_categories.sql',import.meta.url),'utf8');
  await client.query(foodOnly);
  const shopLifecycle=await readFile(new URL('../db/011_shop_lifecycle.sql',import.meta.url),'utf8');
  await client.query(shopLifecycle);
  const productDeletion=await readFile(new URL('../db/012_deleted_products.sql',import.meta.url),'utf8');
  await client.query(productDeletion);
  const payments=await readFile(new URL('../db/013_offline_payment_methods.sql',import.meta.url),'utf8');
  await client.query(payments);
  const slugs=await readFile(new URL('../db/014_shop_slugs.sql',import.meta.url),'utf8');
  await client.query(slugs);
  console.log('Condovery database schema applied successfully.');
} finally {
  await client.end();
}
