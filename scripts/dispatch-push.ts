import { dispatchPush } from "../src/server/push-dispatch";
import { pool } from "../src/lib/db";
async function main() {
  try {
    console.log(
      JSON.stringify({ event: "push_dispatch", ...(await dispatchPush()) }),
    );
  } catch {
    console.error("push_dispatch_failed");
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
void main();
