/**
 * Persistent push worker compatible with Supabase session pooler.
 *
 * Some pooled PostgreSQL connections accept LISTEN but never deliver NOTIFY.
 * Poll a lightweight indexed queue predicate every 2 seconds instead.
 * Scheduled maintenance continues checking receipts, reminders and retries.
 * Actual handset delivery latency is controlled by Expo / FCM / Android.
 */
import { query, pool } from "../src/lib/db";
import { dispatchPush } from "../src/server/push-dispatch";
import {enqueueDueDiscoveryCampaigns} from "../src/server/discovery";

const pollMs = 2_000;
const maintenanceMs = 30_000;
const discoveryCheckMs = 10 * 60_000;
let stopping = false;
let busy = false;
let timer: ReturnType<typeof setInterval> | undefined;
let lastMaintenance = 0;
let lastDiscoveryCheck = 0;
let consecutiveFailures = 0;

function log(event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...extra }));
}

function safeFailure(error: unknown) {
  // Log the machine-readable code, not SQL text, credentials or connection URLs.
  return error && typeof error === "object" && "code" in error
    && typeof error.code === "string" ? error.code : "UNKNOWN";
}

async function tick() {
  if (stopping || busy) return;
  busy = true;
  try {
    const now = Date.now();
    const maintenance = now - lastMaintenance >= maintenanceMs;
    if (maintenance) lastMaintenance = now;
    if (!maintenance) {
      // Check for due sends without scanning orders or starting an Expo request.
      const r = await query<{ ready: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM push_deliveries " +
        "WHERE state='pending' AND available_at<=now() LIMIT 1) AS ready",
      );
      if (!r.rows[0]?.ready) return;
    }
    if(maintenance && now-lastDiscoveryCheck>=discoveryCheckMs){
      lastDiscoveryCheck=now;
      const discovery=await enqueueDueDiscoveryCampaigns(new Date(now));
      if(discovery.queued)log("discovery_campaigns_queued",discovery);
    }
    const result = await dispatchPush();
    if (result.sent || result.checked || result.reminders)
      log("push_worker_dispatch", result);
    consecutiveFailures = 0;
  } catch (error) {
    consecutiveFailures++;
    log("push_worker_dispatch_failed", {
      code: safeFailure(error),
      consecutive_failures: consecutiveFailures,
    });
  } finally {
    busy = false;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  await query("SELECT 1"); // Verify DB access and report a real startup error.
  log("push_worker_ready", {
    mode: "polling",
    poll_seconds: pollMs / 1000,
    maintenance_seconds: maintenanceMs / 1000,
  });
  await tick(); // Recover work queued while the process was stopped.
  timer = setInterval(() => { void tick(); }, pollMs);
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    if (timer) clearInterval(timer);
    const deadline = Date.now() + 20_000;
    while (busy && Date.now() < deadline)
      await new Promise(resolve => setTimeout(resolve, 100));
    await pool.end().catch(() => {});
    process.exit(busy ? 1 : 0);
  };
  process.once("SIGTERM", () => { void shutdown(); });
  process.once("SIGINT", () => { void shutdown(); });
}

main().catch(error => {
  log("push_worker_startup_failed", { code: safeFailure(error) });
  process.exit(1);
});
