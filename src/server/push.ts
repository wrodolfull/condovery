import type { PoolClient } from "pg";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, transaction } from "@/lib/db";
import { bad } from "@/lib/api-error";
import { sessionCredential, tokenHash, type Viewer } from "@/lib/auth";

export type PushKind = "condominium" | "order" | "seller_order";
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
      "WHEN 'seller_order' THEN COALESCE(p.seller_orders,true) ELSE true END ON CONFLICT DO NOTHING",
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
    body: "Abra o Condovery para conferir os detalhes.",
    targetId: order.id,
    eventKey: "order-status:" + order.id + ":" + order.status,
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
          "SELECT u.id,u.condominium_id,$3,$4,$5,$2,$6 FROM users u WHERE u.condominium_id=$1 AND u.status='approved' " +
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
      await transaction(async (tx) => {
        // Serialize rebinding by token; queued messages are tied to the old session.
        await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          b.expo_token,
        ]);
        await tx.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
          "push-devices:" + u.id,
        ]);
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
  if (path === "push/preferences") {
    if (method === "GET") {
      const r = await query(
        "SELECT condominium,orders,seller_orders FROM push_preferences WHERE user_id=$1",
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
        })
        .strict()
        .parse(await req.json());
      await query(
        "INSERT INTO push_preferences(user_id,condominium,orders,seller_orders) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET condominium=$2,orders=$3,seller_orders=$4",
        [u.id, b.condominium, b.orders, b.seller_orders],
      );
      return json({ ok: true });
    }
  }
  // Old versions may still request subscriptions. Do not restore a send path.
  if (parts[1] === "shops" && parts.length === 3)
    bad("Avisos de lojas foram desativados.", 410);
  if (path === "push/inbox" && method === "GET") {
    const page = Number(req.nextUrl.searchParams.get("page") ?? 0);
    if (!Number.isInteger(page) || page < 0 || page > 10000)
      bad("Página inválida.");
    const r = await query(
      "SELECT id,kind,title,body,target_id,read_at,created_at FROM push_notifications WHERE user_id=$1 AND condominium_id=$2 AND kind<>'shop' ORDER BY created_at DESC,id DESC LIMIT 31 OFFSET $3",
      [u.id, u.condominium_id, page * 30],
    );
    return json({
      notifications: r.rows.slice(0, 30),
      hasMore: r.rows.length > 30,
    });
  }
  if (parts[1] === "inbox" && parts.length === 3) {
    const id = uuid.parse(parts[2]);
    if (method === "GET") {
      const r = await query(
        "SELECT id,kind,title,body,target_id,read_at,created_at FROM push_notifications WHERE id=$1 AND user_id=$2 AND condominium_id=$3 AND kind<>'shop'",
        [id, u.id, u.condominium_id],
      );
      if (!r.rowCount) bad("Aviso não encontrado.", 404);
      return json({ notification: r.rows[0] });
    }
    if (method === "PATCH") {
      await query(
        "UPDATE push_notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 AND condominium_id=$3 AND kind<>'shop'",
        [id, u.id, u.condominium_id],
      );
      return json({ ok: true });
    }
  }
  return null;
}
