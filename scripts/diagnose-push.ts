/**
 * Safe production diagnostics: read-only, aggregate counts only.
 * Does not print tokens, users, email addresses, message bodies or device IDs.
 * Run: node --env-file=.env.local --import tsx scripts/diagnose-push.ts
 */
import { pool } from "../src/lib/db";

async function main() {
  const [devices, notices, deliveries, orders] = await Promise.all([
    pool.query(`SELECT count(*)::int AS total,
      count(*) FILTER (WHERE disabled=false)::int AS active,
      count(*) FILTER (WHERE disabled=false AND EXISTS (
        SELECT 1 FROM sessions s WHERE s.token_hash=push_devices.session_hash
          AND s.expires_at>now() AND s.client_kind='mobile'
      ))::int AS eligible
      FROM push_devices`),
    pool.query(`SELECT count(*)::int AS last_24h,
      count(*) FILTER (WHERE kind='seller_order')::int AS seller_order,
      count(*) FILTER (WHERE kind='seller_order' AND read_at IS NULL)::int AS seller_unread,
      max(created_at) AS newest_at
      FROM push_notifications WHERE created_at>=now()-interval '24 hours' AND kind<>'shop'`),
    pool.query(`SELECT state,count(*)::int AS count
      FROM push_deliveries GROUP BY state ORDER BY state`),
    pool.query(`SELECT count(*)::int AS orders_24h FROM orders
      WHERE created_at>=now()-interval '24 hours'`),
  ]);
  console.log(JSON.stringify({
    event: "push_diagnostic",
    environment: {
      push_enabled: process.env.PUSH_ENABLED==="true",
      expo_project_configured: Boolean(process.env.EXPO_PROJECT_ID),
      expo_access_token_configured: Boolean(process.env.EXPO_ACCESS_TOKEN),
      worker_scheduling: "not_checked", // Inspect crontab/systemd separately.
    },
    devices: devices.rows[0],
    notices: notices.rows[0],
    deliveries: deliveries.rows,
    orders: orders.rows[0],
    note: "This does not verify FCM credentials or physical device delivery.",
  },null,2));
}

main().catch(()=>{
  console.error("push_diagnostic_failed: check DB connectivity and migration 038");
  process.exitCode=1;
}).finally(async()=>{await pool.end();});
