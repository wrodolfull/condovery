import { query, transaction } from "@/lib/db";
type Delivery = {
  id: string;
  device_id: string;
  expo_token: string;
  title: string;
  body: string;
  kind: string;
  notification_id: string;
  attempts: number;
};
type Ticket = { status: string; id?: string; details?: { error?: string } };
export function retryDelay(attempt: number) {
  return Math.min(1800, 30 * 2 ** Math.max(0, attempt - 1));
}
async function failure(
  d: Pick<Delivery, "id" | "device_id" | "attempts">,
  code: string,
) {
  const terminal =
    [
      "DeviceNotRegistered",
      "MessageTooBig",
      "InvalidCredentials",
      "UNAUTHORIZED",
    ].includes(code) || d.attempts >= 6;
  if (code === "DeviceNotRegistered")
    await query("UPDATE push_devices SET disabled=true WHERE id=$1", [
      d.device_id,
    ]);
  await query(
    "UPDATE push_deliveries SET state=$2,last_error=$3,available_at=now()+($4::int*interval '1 second') WHERE id=$1",
    [d.id, terminal ? "failed" : "pending", code, retryDelay(d.attempts)],
  );
}
/** Injectable transport for tests; never logs tokens, credentials or notification text. */
export async function dispatchPush(transport: typeof fetch = fetch) {
  if (process.env.PUSH_ENABLED !== "true")
    return { enabled: false, sent: 0, checked: 0 };
  if (!process.env.EXPO_ACCESS_TOKEN || !process.env.EXPO_PROJECT_ID)
    throw new Error("Push credentials are not configured");
  const request = async (path: string, body: unknown) => {
    const r = await transport("https://exp.host/--/api/v2/push/" + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer " + process.env.EXPO_ACCESS_TOKEN,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok)
      throw new Error(r.status === 429 ? "RATE_LIMIT" : "PROVIDER_UNAVAILABLE");
    return (await r.json()) as { data: Ticket[] | Record<string, Ticket> };
  };
  await query(
    "UPDATE push_deliveries SET state='pending' WHERE state='sending' AND available_at<now()",
  );
  // Seller-authored shop messages are retired. Do not send old queued ones.
  // Keep their historical database records for audit; never expose their
  // content again in the resident inbox.
  await query(
    "UPDATE push_deliveries d SET state='failed',last_error='SHOP_NOTICES_DISABLED' " +
      "FROM push_notifications n WHERE n.id=d.notification_id AND n.kind='shop' " +
      "AND d.state IN ('pending','receipt')",
  );
  // Recheck current binding, authorization and opt-out at dispatch, not only at enqueue time.
  await query(
    "UPDATE push_deliveries d SET state='failed',last_error='INELIGIBLE' WHERE state IN ('pending','receipt') AND (created_at<now()-interval '24 hours' OR NOT EXISTS(" +
      "SELECT 1 FROM push_devices dev JOIN sessions s ON s.token_hash=dev.session_hash JOIN push_notifications n ON n.id=d.notification_id " +
      "JOIN users u ON u.id=n.user_id JOIN condominiums c ON c.id=n.condominium_id LEFT JOIN push_preferences p ON p.user_id=u.id " +
      "WHERE dev.id=d.device_id AND dev.session_hash=d.session_hash AND dev.user_id=n.user_id AND dev.condominium_id=n.condominium_id " +
      "AND s.user_id=dev.user_id AND u.condominium_id=n.condominium_id AND u.status='approved' AND c.is_active=true AND dev.disabled=false AND s.expires_at>now() " +
      "AND CASE n.kind WHEN 'condominium' THEN COALESCE(p.condominium,true) WHEN 'order' THEN COALESCE(p.orders,true) " +
      "WHEN 'seller_order' THEN COALESCE(p.seller_orders,true) ELSE EXISTS(SELECT 1 FROM shop_push_subscriptions sub JOIN shops sh ON sh.id=sub.shop_id " +
      "WHERE sub.user_id=u.id AND sub.shop_id=n.target_id AND sub.condominium_id=n.condominium_id AND sh.status='approved') END))",
  );
  const claimed = await transaction(async (tx) => {
    const r = await tx.query<Delivery>(
      "SELECT d.id,d.device_id,d.attempts,dev.expo_token,n.id AS notification_id,n.title,n.body,n.kind " +
        "FROM push_deliveries d JOIN push_devices dev ON dev.id=d.device_id AND dev.session_hash=d.session_hash JOIN push_notifications n ON n.id=d.notification_id AND n.user_id=dev.user_id AND n.condominium_id=dev.condominium_id " +
        "WHERE d.state='pending' AND n.kind<>'shop' AND d.available_at<=now() ORDER BY d.created_at LIMIT 100 FOR UPDATE OF d SKIP LOCKED",
    );
    for (const d of r.rows) {
      d.attempts++;
      await tx.query(
        "UPDATE push_deliveries SET state='sending',attempts=attempts+1,available_at=now()+interval '2 minutes' WHERE id=$1",
        [d.id],
      );
    }
    return r.rows;
  });
  let sent = 0,
    checked = 0;
  if (claimed.length) {
    try {
      const result = await request(
        "send",
        claimed.map((d) => ({
          to: d.expo_token,
          title: d.title,
          body: d.body,
          sound: "default",
          ttl: 3600,
          channelId:
            d.kind === "order" || d.kind === "seller_order"
              ? "pedidos"
              : "avisos",
          data: { notification_id: d.notification_id },
        })),
      );
      const tickets = Array.isArray(result.data) ? result.data : [];
      for (let i = 0; i < claimed.length; i++) {
        const d = claimed[i],
          ticket = tickets[i];
        if (ticket?.status === "ok" && ticket.id) {
          await query(
            "UPDATE push_deliveries SET state='receipt',ticket_id=$2,available_at=now()+interval '15 minutes' WHERE id=$1",
            [d.id, ticket.id],
          );
          sent++;
        } else await failure(d, ticket?.details?.error ?? "MISSING_TICKET");
      }
    } catch {
      for (const d of claimed) await failure(d, "PROVIDER_UNAVAILABLE");
    }
  }
  const waiting = await query<Delivery & { ticket_id: string }>(
    "SELECT id,device_id,attempts,ticket_id FROM push_deliveries WHERE state='receipt' AND available_at<=now() LIMIT 100",
  );
  if (waiting.rowCount) {
    try {
      const result = await request("getReceipts", {
        ids: waiting.rows.map((d) => d.ticket_id),
      });
      const receipts = Array.isArray(result.data) ? {} : result.data;
      for (const d of waiting.rows) {
        const receipt = receipts[d.ticket_id];
        if (receipt?.status === "ok") {
          await query(
            "UPDATE push_deliveries SET state='sent',last_error=NULL WHERE id=$1",
            [d.id],
          );
          checked++;
        } else if (receipt)
          await failure(d, receipt.details?.error ?? "RECEIPT_ERROR");
        else
          await query(
            "UPDATE push_deliveries SET available_at=now()+interval '15 minutes' WHERE id=$1",
            [d.id],
          );
      }
    } catch {
      /* Retain ticket IDs for the next receipt check; never resend on a receipt lookup failure. */
    }
  }
  await query("DELETE FROM mobile_oauth_flows WHERE expires_at<now()");
  await query("DELETE FROM mobile_auth_grants WHERE expires_at<now()");
  await query("DELETE FROM mobile_signup_pending WHERE expires_at<now()");
  await query(
    "DELETE FROM push_notifications WHERE created_at<now()-interval '90 days'",
  );
  return { enabled: true, sent, checked };
}
