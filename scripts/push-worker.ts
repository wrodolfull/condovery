/**
 * Persistent, near-real-time push delivery.
 *
 * Postgres sends NOTIFY after the transaction that creates a delivery commits.
 * LISTEN wakes this worker immediately; 15-second polling also recovers
 * notifications missed across reconnects and processes delayed retries.
 * Expo/FCM delivery to Android is asynchronous and cannot be guaranteed.
 */
import pg from "pg";
import { dispatchPush } from "../src/server/push-dispatch";
import { pool } from "../src/lib/db";

const channel = "elevadoor_push_ready";
const fallbackMs = 15_000;
let stopped = false;
let busy = false;
let pending = false;
let failures = 0;
const listener = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : false,
  application_name: "elevadoor-push-listener",
});

function log(event: string, extra: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ event, ...extra }));
}

async function drain() {
  if (stopped || busy) return;
  busy = true;
  try {
    do {
      pending = false;
      try {
        const result = await dispatchPush();
        if (result.sent || result.checked || result.reminders)
          log("push_worker_dispatch", result);
        failures = 0;
      } catch {
        failures++;
        log("push_worker_dispatch_failed", { consecutive_failures: failures });
        // A signal can arrive during provider failure; bounded periodic retry
        // is safer than hammering Expo or the database in a tight loop.
        pending = false;
      }
    } while (pending && !stopped);
  } finally {
    busy = false;
  }
}

function wake() {
  if (stopped) return;
  if (busy) pending = true;
  else void drain();
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  // This is a dedicated connection; do not use the request pool for LISTEN.
  await listener.connect();
  listener.on("notification", message => {
    if (message.channel === channel) wake();
  });
  listener.on("error", () => {
    log("push_worker_listener_error");
    process.exit(1); // systemd restarts and restores LISTEN connection
  });
  listener.on("end", () => {
    if (!stopped) {
      log("push_worker_listener_disconnected");
      process.exit(1);
    }
  });
  await listener.query("LISTEN " + channel);
  log("push_worker_ready", { fallback_seconds: fallbackMs / 1000 });
  // Catch deliveries created while listener was offline.
  wake();
  const poll = setInterval(wake, fallbackMs);
  const shutdown = async () => {
    if (stopped) return;
    stopped = true;
    clearInterval(poll);
    const limit = Date.now() + 20_000;
    while (busy && Date.now() < limit)
      await new Promise(resolve => setTimeout(resolve, 100));
    await listener.end().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(busy ? 1 : 0);
  };
  process.once("SIGTERM", () => { void shutdown(); });
  process.once("SIGINT", () => { void shutdown(); });
}

main().catch(() => {
  log("push_worker_startup_failed");
  process.exit(1);
});
