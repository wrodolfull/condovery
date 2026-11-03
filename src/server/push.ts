import type { PoolClient } from "pg";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, transaction } from "@/lib/db";
import { bad } from "@/lib/api-error";
import { sessionCredential, tokenHash, type Viewer } from "@/lib/auth";
import {discoveryCampaigns,discoveryMessages} from "@/lib/discovery-campaigns";

export type PushKind = "condominium" | "order" | "seller_order" |
  "seller_review" | "seller_reminder" | "discovery_shop" | "discovery_products" | "discovery_sunday";
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
export const expoTokenValid = (value: string) =>
  /^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,200}\]$/.test(value);
const uuid = z.string().uuid();
type Notice = {
  userId: string;
  condominiumId: string;
  kind: PushKind;
  title: string;
  body: string;
  targetId: string | null;
  eventKey: string;
};
/** Outbox and order commit together. A repeated event cannot enqueue another delivery. */
export async function enqueueNotice(tx: PoolClient, n: Notice) {
  const r = await tx.query(
    "INSERT INTO push_notifications(user_id,condominium_id,kind,title,body,target_id,event_key) " +
      "SELECT id,condominium_id,$3,$4,$5,$6,$7 FROM users WHERE id=$1 AND condominium_id=$2 AND status='approved' " +
      "ON CONFLICT(user_id,event_key) DO NOTHING RETURNING id",
    [
      n.userId,
      n.condominiumId,
      n.kind,
      n.title,
      n.body,
      n.targetId,
      n.eventKey,
    ],
  );
  if (!r.rowCount) return;
  await tx.query(
    "INSERT INTO push_deliveries(notification_id,device_id,session_hash) " +
      "SELECT $1,d.id,d.session_hash FROM push_devices d JOIN sessions s ON s.token_hash=d.session_hash " +
      "LEFT JOIN push_preferences p ON p.user_id=d.user_id " +
      "WHERE d.user_id=$2 AND d.condominium_id=$3 AND d.disabled=false AND s.expires_at>now() AND s.client_kind='mobile' " +
      "AND CASE $4 WHEN 'condominium' THEN COALESCE(p.condominium,true) WHEN 'order' THEN COALESCE(p.orders,true) " +
      "WHEN 'seller_order' THEN COALESCE(p.seller_orders,true) " +
      "WHEN 'seller_review' THEN COALESCE(p.seller_orders,true) " +
      "WHEN 'seller_reminder' THEN COALESCE(p.seller_orders,true) " +
      "WHEN 'discovery_shop' THEN COALESCE(p.discovery,false) " +
      "WHEN 'discovery_products' THEN COALESCE(p.discovery,false) " +
      "WHEN 'discovery_sunday' THEN COALESCE(p.discovery,false) " +
      "ELSE false END ON CONFLICT DO NOTHING",
    [r.rows[0].id, n.userId, n.condominiumId, n.kind],
  );
}
export async function enqueueNewOrder(
  tx: PoolClient,
  order: { id: string; condominium_id: string; shop_id: string },
) {
  const r = await tx.query(
    "SELECT owner_id FROM shops WHERE id=$1 AND condominium_id=$2",
    [order.shop_id, order.condominium_id],
  );
  if (r.rowCount)
    await enqueueNotice(tx, {
      userId: r.rows[0].owner_id,
      condominiumId: order.condominium_id,
      kind: "seller_order",
      title: "Novo pedido na sua loja",
      body: "Você recebeu um pedido. Abra o painel da loja para conferir.",
      targetId: order.id,
      eventKey: "order-created:" + order.id,
    });
}
export async function enqueueOrderStatus(
  tx: PoolClient,
  order: {
    id: string;
    condominium_id: string;
    buyer_id: string;
    status: string;
  },
) {
  if (order.status === "completed" || order.status === "cancelled") {
    // A fulfilled or cancelled order no longer needs a red-badge reminder.
    await tx.query(
      "UPDATE push_notifications SET read_at=COALESCE(read_at,now()) " +
      "WHERE target_id=$1 AND condominium_id=$2 AND kind='seller_reminder'",
      [order.id,order.condominium_id],
    );
  }
  const labels: Record<string, string> = {
    confirmed: "confirmado",
    completed: "concluído",
    cancelled: "cancelado",
  };
  await enqueueNotice(tx, {
    userId: order.buyer_id,
    condominiumId: order.condominium_id,
    kind: "order",
    title: "Seu pedido foi " + (labels[order.status] ?? "atualizado"),
    body: "Abra o Elevadoor para conferir os detalhes.",
    targetId: order.id,
    eventKey: "order-status:" + order.id + ":" + order.status,
  });
}

/** Notify the owner after a completed buyer review is persisted.
 * Must be called inside the same transaction as the review itself.
 */
export async function enqueueNewReview(
  tx: PoolClient,
  review: { id: string; order_id: string; shop_id: string; condominium_id: string },
) {
  const owner = await tx.query(
    "SELECT owner_id FROM shops WHERE id=$1 AND condominium_id=$2 AND status='approved'",
    [review.shop_id, review.condominium_id],
  );
  if (!owner.rowCount) return;
  await enqueueNotice(tx, {
    userId: owner.rows[0].owner_id,
    condominiumId: review.condominium_id,
    kind: "seller_review",
    title: "Nova avaliação na sua loja",
    body: "Um comprador avaliou sua loja. Confira em Avaliações.",
    targetId: review.id,
    eventKey: "seller-review:" + review.id,
  });
}

/** One reminder for each still-confirmed order, after two hours.
 * Called by the scheduled push worker; creates the inbox event even if
 * external transport is disabled. No event is emitted for completed orders.
 */
export async function enqueueDueCompletionReminders() {
  return transaction(async tx => {
    const rows = await tx.query<{
      id: string; condominium_id: string; owner_id: string;
    }>(
      "SELECT o.id,o.condominium_id,s.owner_id FROM orders o " +
      "JOIN shops s ON s.id=o.shop_id AND s.condominium_id=o.condominium_id " +
      "JOIN users owner ON owner.id=s.owner_id AND owner.condominium_id=o.condominium_id AND owner.status='approved' " +
      "WHERE o.status='confirmed' AND o.updated_at<=now()-interval '2 hours' " +
      "AND (o.delivery_day IS NULL OR o.delivery_day<=CURRENT_DATE) " +
      "AND s.status='approved' " +
      "AND NOT EXISTS (SELECT 1 FROM push_notifications n WHERE n.user_id=s.owner_id " +
      "AND n.event_key='seller-reminder:'||o.id::text) " +
      "ORDER BY o.updated_at LIMIT 50 FOR UPDATE OF o SKIP LOCKED",
    );
    for (const order of rows.rows) {
      await enqueueNotice(tx, {
        userId: order.owner_id,
        condominiumId: order.condominium_id,
        kind: "seller_reminder",
        title: "Pedido aguardando conclusão",
        body: "Há um pedido confirmado na sua loja. Verifique se já pode concluí-lo.",
        targetId: order.id,
        eventKey: "seller-reminder:" + order.id,
      });
    }
    return rows.rowCount ?? 0;
  });
}

async function broadcast(
  u: Viewer,
  b: { title: string; body: string; client_key: string },
) {
  return transaction(async (tx) => {
    await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "push-broadcast:" + u.id,
    ]);
    const old = await tx.query(
      "SELECT id,condominium_id,shop_id FROM push_broadcasts WHERE sender_id=$1 AND client_key=$2",
      [u.id, b.client_key],
    );
    let id = old.rows[0]?.id;
    if (
      id &&
      (old.rows[0].condominium_id !== u.condominium_id ||
        old.rows[0].shop_id !== null)
    )
      bad("Chave de envio já utilizada em outro contexto.", 409);
    if (!id) {
      const count = await tx.query(
        "SELECT count(*)::int AS n FROM push_broadcasts WHERE sender_id=$1 AND created_at>now()-interval '1 hour'",
        [u.id],
      );
      if (count.rows[0].n >= 5)
        bad("Limite de cinco avisos por hora atingido.", 429);
      const r = await tx.query(
        "INSERT INTO push_broadcasts(sender_id,condominium_id,shop_id,client_key) VALUES($1,$2,NULL,$3) RETURNING id",
        [u.id, u.condominium_id, b.client_key],
      );
      id = r.rows[0].id;
      await tx.query(
        "INSERT INTO push_notifications(user_id,condominium_id,kind,title,body,target_id,event_key) " +
          "SELECT u.id,u.condominium_id,$2,$3,$4,NULL,$5 FROM users u WHERE u.condominium_id=$1 AND u.status='approved' " +
          "ON CONFLICT(user_id,event_key) DO NOTHING",
        [u.condominium_id, "condominium", b.title, b.body, "broadcast:" + id],
      );
      await tx.query(
        "INSERT INTO push_deliveries(notification_id,device_id,session_hash) " +
          "SELECT n.id,d.id,d.session_hash FROM push_notifications n JOIN push_devices d ON d.user_id=n.user_id AND d.condominium_id=n.condominium_id " +
          "JOIN sessions s ON s.token_hash=d.session_hash AND s.user_id=d.user_id LEFT JOIN push_preferences p ON p.user_id=n.user_id " +
          "WHERE n.event_key=$1 AND n.condominium_id=$2 AND d.disabled=false AND s.expires_at>now() AND s.client_kind='mobile' " +
          "AND n.kind='condominium' AND COALESCE(p.condominium,true) ON CONFLICT DO NOTHING",
        ["broadcast:" + id, u.condominium_id],
      );
    }
    const count = await tx.query(
      "SELECT count(*)::int AS recipients FROM push_notifications WHERE event_key=$1",
      ["broadcast:" + id],
    );
    return { id, recipients: count.rows[0].recipients, queued: true };
  });
}
export async function handlePushApi(
  req: NextRequest,
  method: string,
  path: string,
  parts: string[],
  u: Viewer,
): Promise<NextResponse | null> {
  if(path==="platform/discovery-campaigns"){
    if(!u.is_superadmin||u.status!=="approved")
      bad("Acesso restrito ao superadmin.",403);
    if(method==="GET"){
      const r=await query<{campaign:string;enabled:boolean}>(
        "SELECT campaign,enabled FROM discovery_campaign_rules WHERE condominium_id=$1",
        [u.condominium_id]
      );
      return json({
        campaigns:discoveryCampaigns.map(rule=>({
          ...rule,enabled:r.rows.find(row=>row.campaign===rule.key)?.enabled??false,
          variants:discoveryMessages(rule.key,rule.key==="new_shop"?"Loja da Vizinha":undefined),
        })),
      });
    }
    if(method==="PATCH"){
      const b=z.object({
        campaign:z.enum(["new_shop","new_products","sunday_food"]),
        enabled:z.boolean(),
      }).strict().parse(await req.json());
      await query(
        "INSERT INTO discovery_campaign_rules(condominium_id,campaign,enabled) VALUES($1,$2,$3) " +
        "ON CONFLICT(condominium_id,campaign) DO UPDATE SET enabled=$3,updated_at=now()",
        [u.condominium_id,b.campaign,b.enabled]
      );
      return json({ok:true});
    }
    bad("Método não permitido.",405);
  }
  // Seller broadcasts are retired. Reject even old clients using the route.
  if (path === "shops/mine/push")
    bad("Avisos de lojas foram desativados.", 410);
  if (path === "admin/push/announcements") {
    if (method !== "POST") bad("Método não permitido.", 405);
    if (u.role !== "admin" || u.status !== "approved")
      bad("Acesso restrito à administração.", 403);
    const b = z
      .object({
        title: z.string().trim().min(3).max(70),
        body: z.string().trim().min(3).max(240),
        client_key: uuid,
      })
      .strict()
      .parse(await req.json());
    return json(await broadcast(u, b), 201);
  }
  if (!path.startsWith("push/")) return null;
  if (path === "push/devices") {
    const credential = sessionCredential(req);
    if (credential?.kind !== "mobile") bad("Use a sessão do aplicativo.", 403);
    const sessionHash = tokenHash(credential!.token);
    if (method === "POST") {
      const b = z
        .object({
          installation_id: uuid,
          expo_token: z.string().refine(expoTokenValid),
          platform: z.enum(["android", "ios"]),
          project_id: uuid,
        })
        .strict()
        .parse(await req.json());
      if (
        !process.env.EXPO_PROJECT_ID ||
        b.project_id !== process.env.EXPO_PROJECT_ID
      )
        bad("Projeto push não configurado.", 503);
      // A refresh with unchanged session and token needs no write or lock.
      // New login sessions still rebind so deliveries target the new session.
      const bindingParams = [
        b.expo_token, u.id, u.condominium_id, sessionHash,
        b.installation_id, b.platform,
      ];
      const bindingSql =
        "SELECT 1 FROM push_devices WHERE expo_token=$1 AND user_id=$2 AND condominium_id=$3 " +
        "AND session_hash=$4 AND installation_id=$5 AND platform=$6 AND disabled=false";
      if ((await query(bindingSql, bindingParams)).rowCount)
        return json({ ok: true });
      await transaction(async (tx) => {
        // Serialize rebinding by token; queued messages are tied to the old session.
        await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          b.expo_token,
        ]);
        await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          "push-devices:" + u.id,
        ]);
        // Recheck after locks: a concurrent request may have bound this device.
        if ((await tx.query(bindingSql, bindingParams)).rowCount) return;
        const count = await tx.query(
          "SELECT count(*)::int AS n FROM push_devices d JOIN sessions s ON s.token_hash=d.session_hash WHERE d.user_id=$1 AND d.disabled=false AND s.expires_at>now() AND d.expo_token<>$2 AND d.installation_id<>$3",
          [u.id, b.expo_token, b.installation_id],
        );
        if (count.rows[0].n >= 10)
          bad(
            "Limite de aparelhos atingido. Saia de uma sessão antiga antes de adicionar outro.",
            429,
          );
        await tx.query(
          "DELETE FROM push_devices WHERE installation_id=$1 AND expo_token<>$2",
          [b.installation_id, b.expo_token],
        );
        await tx.query(
          "INSERT INTO push_devices(user_id,condominium_id,session_hash,installation_id,expo_token,platform) VALUES($1,$2,$3,$4,$5,$6) " +
            "ON CONFLICT(expo_token) DO UPDATE SET user_id=$1,condominium_id=$2,session_hash=$3,installation_id=$4,platform=$6,disabled=false,updated_at=now()",
          [
            u.id,
            u.condominium_id,
            sessionHash,
            b.installation_id,
            b.expo_token,
            b.platform,
          ],
        );
      });
      return json({ ok: true });
    }
    if (method === "DELETE") {
      await query(
        "DELETE FROM push_devices WHERE session_hash=$1 AND user_id=$2",
        [sessionHash, u.id],
      );
      return json({ ok: true });
    }
  }
  // A lightweight inbox count independent of Android permission, Expo tokens,
  // and the dispatch worker. Unread notices belong to the authenticated user.
  if (path === "push/summary" && method === "GET") {
    const r = await query(
      "SELECT count(*)::int AS unread_count FROM push_notifications " +
      "WHERE user_id=$1 AND condominium_id=$2 AND read_at IS NULL AND kind NOT IN ('shop','review_update')",
      [u.id, u.condominium_id],
    );
    return json({ unread_count: Number(r.rows[0].unread_count) });
  }
  // Never return Expo tokens, secrets, device IDs or details from other users.
  // An API-level check cannot prove that cron/FCM or a physical device works.
  if (path === "push/status" && method === "GET") {
    const credential = sessionCredential(req);
    if (credential?.kind !== "mobile") bad("Use a sessão do aplicativo.", 403);
    const sessionHash = tokenHash(credential!.token);
    const r = await query(
      "SELECT count(*)::int AS registered_devices FROM push_devices d " +
      "JOIN sessions s ON s.token_hash=d.session_hash " +
      "WHERE d.user_id=$1 AND d.condominium_id=$2 AND d.session_hash=$3 " +
      "AND d.disabled=false AND s.expires_at>now() AND s.client_kind='mobile'",
      [u.id, u.condominium_id, sessionHash],
    );
    return json({
      registered_devices: Number(r.rows[0].registered_devices),
      transport_enabled: process.env.PUSH_ENABLED === "true",
      provider_configured: Boolean(process.env.EXPO_ACCESS_TOKEN && process.env.EXPO_PROJECT_ID),
    });
  }
  if (path === "push/preferences") {
    if (method === "GET") {
      const r = await query(
        "SELECT condominium,orders,seller_orders,discovery FROM push_preferences WHERE user_id=$1",
        [u.id],
      );
      const seller = await query(
        "SELECT 1 FROM shops WHERE owner_id=$1 AND condominium_id=$2 AND status='approved'",
        [u.id, u.condominium_id],
      );
      return json({
        preferences: r.rows[0] ?? {
          condominium: true,
          orders: true,
          seller_orders: true,
          discovery: false,
        },
        is_seller: Boolean(seller.rowCount),
      });
    }
    if (method === "PATCH") {
      const b = z
        .object({
          condominium: z.boolean(),
          orders: z.boolean(),
          seller_orders: z.boolean(),
          discovery: z.boolean().optional(),
        })
        .strict()
        .parse(await req.json());
      await query(
        "INSERT INTO push_preferences(user_id,condominium,orders,seller_orders,discovery) VALUES($1,$2,$3,$4,COALESCE($5,false)) " +
        "ON CONFLICT(user_id) DO UPDATE SET condominium=$2,orders=$3,seller_orders=$4,discovery=COALESCE($5,push_preferences.discovery)",
        [u.id,b.condominium,b.orders,b.seller_orders,b.discovery??null],
      );
      return json({ ok: true });
    }
  }
  // Old versions may still request subscriptions. Do not restore a send path.
  if (parts[1] === "shops" && parts.length === 3)
    bad("Avisos de lojas foram desativados.", 410);
  if (path === "push/inbox" && method === "DELETE") {
    // Clear all visible notices, even unread ones. Keep other users, tenants and
    // legacy hidden kinds untouched; FK cascade also cancels pending deliveries.
    const removed = await query(
      "DELETE FROM push_notifications WHERE user_id=$1 AND condominium_id=$2 " +
      "AND kind NOT IN ('shop','review_update')",
      [u.id, u.condominium_id],
    );
    return json({ ok: true, deleted: removed.rowCount ?? 0 });
  }
  if (path === "push/inbox" && method === "GET") {
    const page = Number(req.nextUrl.searchParams.get("page") ?? 0);
    const limit = Number(req.nextUrl.searchParams.get("limit") ?? 30);
    if (!Number.isInteger(page) || page < 0 || page > 10000)
      bad("Página inválida.");
    if (!Number.isInteger(limit) || limit < 1 || limit > 30)
      bad("Limite inválido.");
    const r = await query(
      "SELECT id,kind,title,body,target_id,read_at,created_at FROM push_notifications WHERE user_id=$1 AND condominium_id=$2 AND kind NOT IN ('shop','review_update') ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4",
      [u.id, u.condominium_id, limit + 1, page * limit],
    );
    return json({
      notifications: r.rows.slice(0, limit),
      hasMore: r.rows.length > limit,
    });
  }
  if (parts[1] === "inbox" && parts.length === 3) {
    const id = uuid.parse(parts[2]);
    if (method === "GET") {
      const r = await query(
        "SELECT id,kind,title,body,target_id,read_at,created_at FROM push_notifications WHERE id=$1 AND user_id=$2 AND condominium_id=$3 AND kind NOT IN ('shop','review_update')",
        [id, u.id, u.condominium_id],
      );
      if (!r.rowCount) bad("Aviso não encontrado.", 404);
      return json({ notification: r.rows[0] });
    }
    if (method === "PATCH") {
      await query(
        "UPDATE push_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 AND condominium_id=$3 AND kind NOT IN ('shop','review_update')",
        [id, u.id, u.condominium_id],
      );
      return json({ ok: true });
    }
  }
  return null;
}
