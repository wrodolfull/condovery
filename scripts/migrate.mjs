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
  const tenants=await readFile(new URL('../db/015_platform_admin_and_tenants.sql',import.meta.url),'utf8');
  await client.query(tenants);
  const hosts=await readFile(new URL('../db/016_condominium_subdomains.sql',import.meta.url),'utf8');
  await client.query(hosts);
  const ads=await readFile(new URL('../db/017_advertising_campaigns.sql',import.meta.url),'utf8');
  await client.query(ads);
  const adMedia=await readFile(new URL('../db/021_ad_image_upload.sql',import.meta.url),'utf8');
  await client.query(adMedia);
  const optionalCategories=await readFile(new URL('../db/018_optional_categories.sql',import.meta.url),'utf8');
  await client.query(optionalCategories);
  const giveaways=await readFile(new URL('../db/019_giveaway_items.sql',import.meta.url),'utf8');
  await client.query(giveaways);
  const retention=await readFile(new URL('../db/020_giveaway_retention.sql',import.meta.url),'utf8');
  await client.query(retention);
  const catalogPerformance=await readFile(new URL('../db/022_catalog_performance.sql',import.meta.url),'utf8');
  await client.query(catalogPerformance);
  const marketingLeads=await readFile(new URL('../db/030_marketing_leads.sql',import.meta.url),'utf8');
  await client.query(marketingLeads);
  const giveawayContact=await readFile(new URL('../db/022_giveaway_contact_whatsapp.sql',import.meta.url),'utf8');
  await client.query(giveawayContact);
  // Commercial reporting must exist before locking down client-facing Data API roles.
  const adReporting=await readFile(new URL('../db/031_ads_reporting.sql',import.meta.url),'utf8');
  await client.query(adReporting);
  const accessHardening=await readFile(new URL('../db/032_public_data_api_hardening.sql',import.meta.url),'utf8');
  await client.query(accessHardening);
  const fairsMigration=await readFile(new URL('../db/033_community_fairs.sql',import.meta.url),'utf8');
  await client.query(fairsMigration);
  const authHardening=await readFile(new URL('../db/034_auth_api_hardening.sql',import.meta.url),'utf8');
  await client.query(authHardening);
  const adminPagination=await readFile(new URL('../db/035_admin_pagination_indexes.sql',import.meta.url),'utf8');
  await client.query(adminPagination);
  const advertiserReports=await readFile(new URL('../db/036_advertiser_report_shares.sql',import.meta.url),'utf8');
  await client.query(advertiserReports);
  const categoryCatalog=await readFile(new URL('../db/037_category_catalog.sql',import.meta.url),'utf8');
  await client.query(categoryCatalog);
  const mobilePush=await readFile(new URL('../db/038_mobile_sessions_push.sql',import.meta.url),'utf8');
  await client.query(mobilePush);
  console.log('Condovery database schema applied successfully.');
} finally {
  await client.end();
}
