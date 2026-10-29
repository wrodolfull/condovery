import assert from "node:assert/strict";
import crypto from "node:crypto";
import pg from "pg";
// This script deliberately uses the isolated Supabase stub, never real residents.
assert.equal(process.env.SUPABASE_URL, "http://127.0.0.1:3333");
const base = process.env.SMOKE_URL || "http://127.0.0.1:3000";
const project = "11111111-1111-4111-8111-111111111111";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");
async function request(
  path,
  { method = "GET", body, token, cookie, expected = 200 } = {},
) {
  const r = await fetch(base + "/api/" + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  assert.equal(
    r.status,
    expected,
    method + " " + path + ": " + JSON.stringify(data),
  );
  return { data, cookie: r.headers.get("set-cookie")?.split(";")[0] };
}
try {
  const tag = crypto.randomUUID();
  const password = "MobileTest123!";
  const invite = "MobileInvite" + tag.replaceAll("-", "");
  const admin = (
    await request("auth/login", {
      method: "POST",
      body: {
        email: process.env.BOOTSTRAP_ADMIN_EMAIL,
        password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
      },
    })
  ).cookie;
  const fixture = (
    await request("platform/condominiums", {
      cookie: admin,
      method: "POST",
      body: {
        name: "Mobile Test",
        slug: "mobile-" + tag,
        invite_code: invite,
        tower_scheme: "letters",
        tower_count: 2,
      },
      expected: 201,
    })
  ).data.condominium;
  const condo = (
    await request("public/condominium", { method: "POST", body: { invite } })
  ).data;
  const users = [];
  for (const name of ["Buyer", "Seller"]) {
    const email = name.toLowerCase() + "-" + tag + "@example.com";
    await request("auth/register", {
      method: "POST",
      body: {
        name: "Mobile " + name,
        email,
        password,
        phone: "11999991234",
        invite,
        tower: condo.towers[0],
        apartment: "901",
      },
      expected: 201,
    });
    await request("mobile/auth/login", {
      method: "POST",
      body: { email, password },
      expected: 401,
    });
    assert.equal(
      (
        await fetch(
          "http://127.0.0.1:3333/__test/confirm?email=" +
            encodeURIComponent(email),
        )
      ).status,
      200,
    );
    const token = (
      await request("mobile/auth/login", {
        method: "POST",
        body: { email, password },
      })
    ).data.access_token;
    const me = (await request("me", { token })).data.viewer;
    users.push({
      email,
      token,
      me,
      cookie: (
        await request("auth/login", {
          method: "POST",
          body: { email, password },
        })
      ).cookie,
    });
  }
  const [buyer, seller] = users;
  await request("home", { token: buyer.token });
  const emptyShop = await request("shops/mine", { token: buyer.token });
  assert.equal(emptyShop.data.shop, null);
  assert.deepEqual(emptyShop.data.products, []);
  for (const path of [
    "admin/summary",
    "platform/condominiums",
    "fairs/manage",
    "fairs/seller",
    "orders?scope=seller",
  ])
    await request(path, { token: buyer.token, expected: 403 });
  await request("orders/" + crypto.randomUUID(), {
    token: seller.token,
    method: "PATCH",
    body: { status: "confirmed" },
    // The mobile route is allowed; seller ownership is still enforced server-side.
    expected: 404,
  });
  const asCookie = await request("me", {
    cookie: "condovery_session=" + buyer.token,
  });
  assert.equal(asCookie.data.viewer, null);
  const webToken = buyer.cookie.split("=")[1];
  assert.equal((await request("me", { token: webToken })).data.viewer, null);
  // Valid mobile bearer and web cookie credentials reach the campaign lookup.
  // A nonexistent campaign returns 404, not a cookie-only authentication 401.
  for (const event of ["impression", "click"]) {
    const endpoint = "ads/" + crypto.randomUUID() + "/" + event;
    await request(endpoint, { method: "POST", token: buyer.token, expected: 404 });
    await request(endpoint, { method: "POST", cookie: buyer.cookie, expected: 404 });
  }
  await request("push/devices", {
    token: buyer.token,
    method: "POST",
    body: {
      installation_id: crypto.randomUUID(),
      expo_token: "bad",
      platform: "android",
      project_id: project,
    },
    expected: 400,
  });
  for (const [i, u] of users.entries())
    await request("push/devices", {
      token: u.token,
      method: "POST",
      body: {
        installation_id: crypto.randomUUID(),
        expo_token:
          "ExpoPushToken[mobile_test_" + tag.replaceAll("-", "") + i + "]",
        platform: "android",
        project_id: project,
      },
    });
  assert.equal(
    (
      await db.query("SELECT client_kind FROM sessions WHERE token_hash=$1", [
        hash(buyer.token),
      ])
    ).rows[0].client_kind,
    "mobile",
  );
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM sessions WHERE token_hash=$1",
        [buyer.token],
      )
    ).rows[0].n,
    0,
  );
  const owned = (
    await request("shops/mine", {
      method: "POST",
      cookie: seller.cookie,
      body: {
        name: "Mobile Shop " + tag.slice(0, 8),
        whatsapp: "11999991234",
        accept_guidelines: true,
      },
      expected: 201,
    })
  ).data.shop;
  await request("push/shops/" + owned.id, {
    method: "PUT",
    token: buyer.token,
  });
  const notice = {
    title: "Novidade para os vizinhos",
    body: "Aviso de teste isolado.",
    client_key: crypto.randomUUID(),
  };
  const mobileNotice = (await request("shops/mine/push", {
    method: "POST",
    token: seller.token,
    body: notice,
    expected: 201,
  })).data;
  const one = (
    await request("shops/mine/push", {
      method: "POST",
      cookie: seller.cookie,
      body: notice,
      expected: 201,
    })
  ).data;
  const two = (
    await request("shops/mine/push", {
      method: "POST",
      cookie: seller.cookie,
      body: notice,
      expected: 201,
    })
  ).data;
  assert.equal(mobileNotice.id, one.id);
  assert.equal(one.id, two.id);
  assert.equal(one.recipients, 1);
  const inbox = (await request("push/inbox", { token: buyer.token })).data
    .notifications;
  assert.ok(inbox.some((n) => n.title === notice.title));
  await request("push/inbox/" + inbox[0].id, {
    token: seller.token,
    expected: 404,
  });
  await request("push/preferences", {
    token: buyer.token,
    method: "PATCH",
    body: { condominium: false, orders: true, seller_orders: false },
  });
  assert.equal(
    (await request("push/preferences", { token: buyer.token })).data.preferences
      .condominium,
    false,
  );
  await request("push/shops/" + owned.id, {
    token: buyer.token,
    method: "DELETE",
  });
  assert.equal(
    (await request("push/shops/" + owned.id, { token: buyer.token })).data
      .subscribed,
    false,
  );
  await request("platform/condominiums/switch", {
    cookie: admin,
    method: "POST",
    body: { condominium_id: fixture.id },
  });
  const adminMobile = (
    await request("mobile/auth/login", {
      method: "POST",
      body: {
        email: process.env.BOOTSTRAP_ADMIN_EMAIL,
        password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
      },
    })
  ).data.access_token;
  await request("admin/push/announcements", {
    token: adminMobile,
    method: "POST",
    body: notice,
    expected: 403,
  });
  await request("admin/push/announcements", {
    cookie: admin,
    method: "POST",
    body: { ...notice, client_key: crypto.randomUUID() },
    expected: 201,
  });
  const foreign = await db.query(
    "INSERT INTO condominiums(name,slug,invite_code_hash,towers) VALUES('Foreign',$1,$2,'[\"Torre A\"]') RETURNING id",
    ["foreign-" + tag, hash(tag)],
  );
  const foreignUser = await db.query(
    "INSERT INTO users(condominium_id,name,email,phone,password_hash,tower,apartment,status) VALUES($1,'Foreign',$2,'11999991234',NULL,'Torre A','1','approved') RETURNING id",
    [foreign.rows[0].id, "foreign-" + tag + "@example.com"],
  );
  const foreignShop = await db.query(
    "INSERT INTO shops(condominium_id,owner_id,name,whatsapp,status,slug) VALUES($1,$2,'Foreign shop','11999991234','approved',$3) RETURNING id",
    [foreign.rows[0].id, foreignUser.rows[0].id, "foreign-shop-" + tag],
  );
  await request("push/shops/" + foreignShop.rows[0].id, {
    token: buyer.token,
    method: "PUT",
    expected: 404,
  });
  const categories = (await request("home", { token: buyer.token })).data
    .categories;
  const product = (
    await request("products", {
      cookie: seller.cookie,
      method: "POST",
      body: {
        name: "Produto Mobile",
        description: "Produto de teste",
        category_id: categories[0].id,
        price_cents: 1200,
        stock: 10,
        visibility: "available",
        option_groups: [],
      },
      expected: 201,
    })
  ).data.product;
  const draft = {
    shop_id: owned.id,
    items: [{ id: product.id, quantity: 1 }],
    payment_method: "pix",
    fulfillment: "delivery",
    client_order_key: crypto.randomUUID(),
  };
  const quote = (
    await request("orders/quote", {
      token: buyer.token,
      method: "POST",
      body: draft,
    })
  ).data.quote;
  const placed = (
    await request("orders", {
      token: buyer.token,
      method: "POST",
      body: { ...draft, expected_total_cents: quote.total_cents },
      expected: 201,
    })
  ).data.order;
  const repeated = (
    await request("orders", {
      token: buyer.token,
      method: "POST",
      body: { ...draft, expected_total_cents: quote.total_cents },
    })
  ).data.order;
  assert.equal(placed.id, repeated.id);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM push_notifications WHERE event_key=$1",
        ["order-created:" + placed.id],
      )
    ).rows[0].n,
    1,
  );
  await request("orders/" + placed.id, {
    cookie: seller.cookie,
    method: "PATCH",
    body: { status: "confirmed" },
  });
  assert.ok(
    (
      await request("push/inbox", { token: buyer.token })
    ).data.notifications.some(
      (n) => n.kind === "order" && n.target_id === placed.id,
    ),
  );
  const grant = crypto.randomBytes(32).toString("hex"),
    verifier = crypto.randomBytes(32).toString("hex"),
    state = crypto.randomBytes(32).toString("hex");
  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");
  const authId = (
    await db.query("SELECT supabase_auth_user_id FROM users WHERE id=$1", [
      buyer.me.id,
    ])
  ).rows[0].supabase_auth_user_id;
  await db.query(
    "INSERT INTO mobile_auth_grants(token_hash,challenge,client_state,auth_user_id,email,name) VALUES($1,$2,$3,$4,$5,$6)",
    [hash(grant), challenge, state, authId, buyer.email, "Mobile Buyer"],
  );
  await request("mobile/auth/google/exchange", {
    method: "POST",
    body: { code: grant, verifier: "0".repeat(64), state },
    expected: 401,
  });
  const exchanged = (
    await request("mobile/auth/google/exchange", {
      method: "POST",
      body: { code: grant, verifier, state },
    })
  ).data.access_token;
  assert.ok(exchanged);
  await request("mobile/auth/google/exchange", {
    method: "POST",
    body: { code: grant, verifier, state },
    expected: 401,
  });
  await request("auth/logout", { token: exchanged, method: "POST" });
  await request("auth/logout", { method: "POST", token: buyer.token });
  assert.equal((await request("me", { token: buyer.token })).data.viewer, null);
  assert.equal(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM push_devices WHERE user_id=$1",
        [buyer.me.id],
      )
    ).rows[0].n,
    0,
  );
  const { dispatchPush } = await import("../src/server/push-dispatch.ts");
  process.env.PUSH_ENABLED = "true";
  process.env.EXPO_ACCESS_TOKEN = "isolated-provider-transport-only";
  let sentCalls = 0;
  const provider = async (url, init) => {
    const input = JSON.parse(init.body);
    if (url.endsWith("/send")) {
      sentCalls++;
      return Response.json({
        data: input.map((_, i) => ({ status: "ok", id: "mock-receipt-" + i })),
      });
    }
    return Response.json({
      data: Object.fromEntries(
        input.ids.map((id) => [
          id,
          { status: "error", details: { error: "DeviceNotRegistered" } },
        ]),
      ),
    });
  };
  const staleNotice = crypto.randomUUID(),
    optoutNotice = crypto.randomUUID();
  for (const [id, kind, key] of [
    [staleNotice, "order", "stale-device:"],
    [optoutNotice, "condominium", "opt-out:"],
  ]) {
    await db.query(
      "INSERT INTO push_notifications(id,user_id,condominium_id,kind,title,body,event_key) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        id,
        seller.me.id,
        seller.me.condominium_id,
        kind,
        "Isolated test",
        "Must not deliver",
        key + tag,
      ],
    );
    const dev = (
      await db.query(
        "SELECT id,session_hash FROM push_devices WHERE user_id=$1 LIMIT 1",
        [seller.me.id],
      )
    ).rows[0];
    await db.query(
      "INSERT INTO push_deliveries(notification_id,device_id,session_hash) VALUES($1,$2,$3)",
      [id, dev.id, id === staleNotice ? "0".repeat(64) : dev.session_hash],
    );
  }
  await request("push/preferences", {
    token: seller.token,
    method: "PATCH",
    body: { condominium: false, orders: true, seller_orders: true },
  });
  const dispatch = await dispatchPush(provider);
  assert.ok(dispatch.sent > 0);
  assert.equal(sentCalls, 1);
  const filtered = await db.query(
    "SELECT state,last_error FROM push_deliveries WHERE notification_id=ANY($1::uuid[])",
    [[staleNotice, optoutNotice]],
  );
  assert.equal(filtered.rows.length, 2);
  assert.ok(
    filtered.rows.every(
      (d) => d.state === "failed" && d.last_error === "INELIGIBLE",
    ),
  );
  await db.query(
    "UPDATE push_deliveries SET available_at=now()-interval '1 minute' WHERE state='receipt'",
  );
  await dispatchPush(provider);
  assert.ok(
    (
      await db.query(
        "SELECT count(*)::int AS n FROM push_devices WHERE disabled=true",
      )
    ).rows[0].n > 0,
  );
  process.env.PUSH_ENABLED = "false";
  console.log(
    "Provider queue, receipts and invalid-device cleanup PASS (mock transport; no real push sent).",
  );
  console.log(
    "Mobile audience, identity confirmation, tenant isolation, subscriptions, announcements, idempotency and revocation PASS.",
  );
} finally {
  await db.end();
}
