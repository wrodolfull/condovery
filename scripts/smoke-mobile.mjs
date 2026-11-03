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
  assert.equal((await request("mobile/config")).data.google, true,
    "Supabase-enabled backend must expose native Google login");
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
  // Regression: expired or revoked sessions cannot read tenant data or create
  // an order. Logout and a cached UI must never be relied on for authorization.
  for(const kind of ["mobile","web"]){
    const expiredToken=crypto.randomBytes(32).toString("hex");
    await db.query(
      "INSERT INTO sessions(token_hash,user_id,client_kind,expires_at) VALUES($1,$2,$3,now()-interval '2 minutes')",
      [hash(expiredToken),buyer.me.id,kind]
    );
    const credential=kind==="mobile"?{token:expiredToken}:{cookie:"condovery_session="+expiredToken};
    assert.equal((await request("me",credential)).data.viewer,null);
    await request("home",{...credential,expected:401});
    await request("orders",{...credential,expected:401});
    await request("orders/quote",{...credential,method:"POST",body:{items:[]},expected:401});
  }
  // A token explicitly revoked by the server is no longer usable.
  const revokedToken=crypto.randomBytes(32).toString("hex");
  await db.query(
    "INSERT INTO sessions(token_hash,user_id,client_kind,expires_at) VALUES($1,$2,'mobile',now()+interval '1 day')",
    [hash(revokedToken),buyer.me.id]
  );
  assert.equal((await request("me",{token:revokedToken})).data.viewer.id,buyer.me.id);
  await db.query("DELETE FROM sessions WHERE token_hash=$1",[hash(revokedToken)]);
  assert.equal((await request("me",{token:revokedToken})).data.viewer,null);
  await request("orders",{token:revokedToken,expected:401});
  await request("home", { token: buyer.token });
  const emptyShop = await request("shops/mine", { token: buyer.token });
  assert.equal(emptyShop.data.shop, null);
  assert.deepEqual(emptyShop.data.products, []);
  for (const path of [
    "admin/summary",
    "platform/condominiums",
    "fairs/manage",
    "fairs/seller",
  ])
    await request(path, { token: buyer.token, expected: 403 });
  // Non-owners must never see seller orders, even though the bearer scope is allowed.
  await request("orders?scope=seller", { token: buyer.token, expected: 404 });
  await request("orders?scope=admin", { token: buyer.token, expected: 403 });
  await request("orders?scope=seller", { token: seller.token, expected: 404 });
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
  // Native and web credentials see the same resident's saved shops.
  assert.deepEqual((await request("favorite-shops",{token:buyer.token})).data.ids,[]);
  await request("favorite-shops",{token:buyer.token,method:"POST",body:{shop_id:owned.id}});
  await request("favorite-shops",{token:buyer.token,method:"POST",body:{shop_id:owned.id}});
  const savedMobile=(await request("favorite-shops",{token:buyer.token})).data;
  const savedWeb=(await request("favorite-shops",{cookie:buyer.cookie})).data;
  assert.deepEqual(savedMobile.ids,[owned.id]);
  assert.deepEqual(savedWeb.ids,savedMobile.ids);
  assert.equal(savedMobile.shops[0].name,owned.name);
  assert.deepEqual((await request("favorite-shops",{token:seller.token})).data.ids,[]);
  await request("favorite-shops",{token:buyer.token,method:"POST",body:{shop_id:crypto.randomUUID()},expected:404});
  await request("favorite-shops/"+owned.id,{token:buyer.token,method:"DELETE"});
  assert.deepEqual((await request("favorite-shops",{cookie:buyer.cookie})).data.ids,[]);
  // Even an old native app, browser client or crafted HTTP request may not
  // publish a shop-originated notice. No broadcast or inbox entry is created.
  const notice = {
    title: "Novidade para os vizinhos",
    body: "Aviso de teste isolado.",
    client_key: crypto.randomUUID(),
  };
  for (const options of [{ token: seller.token }, { cookie: seller.cookie }]) {
    await request("shops/mine/push", {
      method: "POST", ...options, body: notice, expected: 410,
    });
  }
  await request("shops/mine/push", {
    method: "POST",cookie: buyer.cookie,body: notice,expected: 410,
  });
  for (const method of ["GET","PUT","DELETE"]) {
    await request("push/shops/" + owned.id, {
      method,token:buyer.token,expected:410,
    });
  }
  const blockedBroadcasts=await db.query(
    "SELECT count(*)::int AS n FROM push_broadcasts WHERE sender_id=$1 AND shop_id=$2",
    [seller.me.id,owned.id]
  );
  assert.equal(blockedBroadcasts.rows[0].n,0);
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
  const adminAnnouncement=(await request("admin/push/announcements", {
    cookie: admin,
    method: "POST",
    body: { ...notice, client_key: crypto.randomUUID() },
    expected: 201,
  })).data;
  assert.ok(adminAnnouncement.id);
  const inbox=(await request("push/inbox",{token:buyer.token})).data.notifications;
  assert.ok(inbox.some(n=>n.title===notice.title&&n.kind==="condominium"));
  await request("push/inbox/"+inbox[0].id,{token:seller.token,expected:404});
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
  const unreadBefore=(await request("push/summary",{token:seller.token})).data.unread_count;
  assert.ok(Number.isInteger(unreadBefore));
  const deviceStatus=(await request("push/status",{token:seller.token})).data;
  assert.ok(deviceStatus.registered_devices>=1,"Seller device must be registered");
  assert.equal(typeof deviceStatus.transport_enabled,"boolean");
  assert.equal(typeof deviceStatus.provider_configured,"boolean");
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
  // LISTEN/NOTIFY signals the persistent worker only after the delivery
  // transaction commits, without making the checkout wait for Expo.
  const listener=new pg.Client({
    connectionString:process.env.DATABASE_URL,
    ssl:process.env.DATABASE_SSL==="true"?{rejectUnauthorized:true}:false,
  });
  await listener.connect();
  await listener.query("LISTEN elevadoor_push_ready");
  let received=0;
  const wakePromise=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error("No realtime push notification after new order")),5000);
    listener.on("notification",msg=>{
      if(msg.channel!=="elevadoor_push_ready")return;
      received++;
      clearTimeout(timeout);
      resolve();
    });
  });
  const placed = (
    await request("orders", {
      token: buyer.token,
      method: "POST",
      body: { ...draft, expected_total_cents: quote.total_cents },
      expected: 201,
    })
  ).data.order;
  try {
    await wakePromise;
    assert.equal(received,1,"New order must notify the worker immediately after commit");
  } finally {
    await listener.end();
  }
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
  const unreadAfter=(await request("push/summary",{token:seller.token})).data.unread_count;
  assert.equal(unreadAfter,unreadBefore+1,"New order must light unread badge without push worker");
  const sellerNotices=(await request("push/inbox",{token:seller.token})).data.notifications;
  const sellerNotice=sellerNotices.find(n=>n.kind==="seller_order"&&n.target_id===placed.id);
  assert.ok(sellerNotice,"Seller must see the new order in their inbox");
  await request("push/inbox/"+sellerNotice.id,{token:seller.token,method:"PATCH"});
  const unreadRead=(await request("push/summary",{token:seller.token})).data.unread_count;
  assert.equal(unreadRead,unreadAfter-1,"Badge must clear when notice is read");
  // Reproduce the reported scenario: web buyer -> mobile seller inbox.
  const webPlaced=(await request("orders",{
    cookie:buyer.cookie,method:"POST",expected:201,
    body:{...draft,client_order_key:crypto.randomUUID(),expected_total_cents:quote.total_cents}
  })).data.order;
  const afterWeb=(await request("push/summary",{token:seller.token})).data.unread_count;
  assert.equal(afterWeb,unreadRead+1,"Web purchase must appear as seller unread notice");
  assert.ok((await request("push/inbox",{token:seller.token})).data.notifications.some(
    n=>n.kind==="seller_order"&&n.target_id===webPlaced.id
  ));


  // A seller can jump from a notification into an exact order page,
  // including old orders not present in the first paginated list.
  const ownerOrder=(await request("orders/"+placed.id,{token:seller.token})).data.order;
  assert.equal(ownerOrder.id,placed.id);
  await request("orders/"+placed.id,{cookie:admin,expected:404});
  await request("orders/" + placed.id, {
    cookie: seller.cookie,
    method: "PATCH",
    body: { status: "confirmed" },
  });
  // Once confirmed, a due order produces a *single* completion reminder
  // without needing a physical device or an Expo provider.
  await db.query("UPDATE orders SET updated_at=now()-interval '3 hours' WHERE id=$1",[placed.id]);
  const {enqueueDueCompletionReminders}=await import("../src/server/push.ts");
  await enqueueDueCompletionReminders();
  await enqueueDueCompletionReminders();
  assert.equal((await db.query(
    "SELECT count(*)::int AS n FROM push_notifications WHERE event_key=$1",
    ["seller-reminder:"+placed.id],
  )).rows[0].n,1,"Completion reminders must be idempotent");
  assert.ok((await request("push/inbox",{token:seller.token})).data.notifications.some(
    n=>n.kind==="seller_reminder"&&n.target_id===placed.id
  ));
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

  // Google first-time registration must not create an account before
  // checking a condominium invitation, and the short-lived grant is one use.
  const newGrant = crypto.randomBytes(32).toString("hex");
  const signupVerifier = crypto.randomBytes(32).toString("hex");
  const signupState = crypto.randomBytes(32).toString("hex");
  const signupEmail = "google-new-" + tag + "@example.com";
  const verifiedGoogleId = crypto.randomUUID();
  await db.query(
    "INSERT INTO mobile_auth_grants(token_hash,challenge,client_state,auth_user_id,email,name) VALUES($1,$2,$3,$4,$5,$6)",
    [
      hash(newGrant),
      crypto.createHash("sha256").update(signupVerifier).digest("base64url"),
      signupState, verifiedGoogleId, signupEmail, "Moradora Google",
    ],
  );
  const newIdentity = (await request("mobile/auth/google/exchange", {
    method: "POST",
    body: { code: newGrant, verifier: signupVerifier, state: signupState },
  })).data;
  assert.equal(newIdentity.registration_required, true);
  assert.equal(newIdentity.email, signupEmail);
  assert.equal(newIdentity.name, "Moradora Google");
  assert.match(newIdentity.signup_token, /^[a-f0-9]{64}$/);
  await request("mobile/auth/google/exchange", {
    method: "POST",
    body: { code: newGrant, verifier: signupVerifier, state: signupState },
    expected: 401,
  });
  const googleRegistration = {
    signup_token: newIdentity.signup_token,
    name: "Moradora Google", phone: "11999990000",
    invite, tower: condo.towers[0], apartment: "1202",
  };
  await request("mobile/auth/register-google", {
    method: "POST", body: { ...googleRegistration, invite: "InvalidOtherInvite123" },
    expected: 400,
  });
  assert.equal((await db.query("SELECT count(*)::int AS total FROM users WHERE email=$1",
    [signupEmail])).rows[0].total, 0, "Google grant without a valid condominium invite must not create an account");
  const signedUp = (await request("mobile/auth/register-google", {
    method: "POST", body: googleRegistration,
  })).data;
  assert.match(signedUp.access_token, /^[a-f0-9]{64}$/);
  const googleMember = (await request("me", { token: signedUp.access_token })).data.viewer;
  assert.equal(googleMember.email, signupEmail);
  assert.equal(googleMember.condominium_id, fixture.id);
  await request("mobile/auth/register-google", {
    method: "POST", body: googleRegistration, expected: 401,
  });
  await request("auth/logout", { token: signedUp.access_token, method: "POST" });
  console.log("Google registration: verified identity, invite, session and one-time grants PASS.");
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
  // Historical shop broadcasts may already be queued on deployed instances.
  // They must disappear from the inbox and must never be delivered by the
  // upgraded worker, without erasing the historical audit record.
  const legacyShopNotice=crypto.randomUUID();
  await db.query(
    "INSERT INTO push_notifications(id,user_id,condominium_id,kind,title,body,target_id,event_key) VALUES($1,$2,$3,'shop',$4,$5,$6,$7)",
    [legacyShopNotice,seller.me.id,seller.me.condominium_id,
      "Old shop message","Retired notice",owned.id,"retired-shop:"+tag]
  );
  const legacyDevice=(await db.query(
    "SELECT id,session_hash FROM push_devices WHERE user_id=$1 LIMIT 1",
    [seller.me.id]
  )).rows[0];
  await db.query(
    "INSERT INTO push_deliveries(notification_id,device_id,session_hash) VALUES($1,$2,$3)",
    [legacyShopNotice,legacyDevice.id,legacyDevice.session_hash]
  );
  assert.ok(!(await request("push/inbox",{token:seller.token})).data.notifications.some(n=>n.id===legacyShopNotice));
  await request("push/inbox/"+legacyShopNotice,{token:seller.token,expected:404});
  // Legacy moderation outcomes must never appear in inbox, unread count,
  // details or push delivery, even if they were queued by an older release.
  const legacyModerationNotice=crypto.randomUUID();
  const unreadBeforeLegacy=(await request("push/summary",{token:seller.token})).data.unread_count;
  await db.query(
    "INSERT INTO push_notifications(id,user_id,condominium_id,kind,title,body,event_key) "+
    "VALUES($1,$2,$3,'review_update','Old moderation outcome','Private decision',$4)",
    [legacyModerationNotice,seller.me.id,seller.me.condominium_id,"old-review-update:"+tag]
  );
  await db.query(
    "INSERT INTO push_deliveries(notification_id,device_id,session_hash) VALUES($1,$2,$3)",
    [legacyModerationNotice,legacyDevice.id,legacyDevice.session_hash]
  );
  assert.equal((await request("push/summary",{token:seller.token})).data.unread_count,unreadBeforeLegacy);
  assert.ok(!(await request("push/inbox",{token:seller.token})).data.notifications.some(
    n=>n.id===legacyModerationNotice
  ));
  await request("push/inbox/"+legacyModerationNotice,{token:seller.token,expected:404});
  await request("push/inbox/"+legacyModerationNotice,{token:seller.token,method:"PATCH"});
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
  const retiredState=(await db.query(
    "SELECT state,last_error FROM push_deliveries WHERE notification_id=$1",
    [legacyShopNotice]
  )).rows[0];
  assert.deepEqual(retiredState,{state:"failed",last_error:"SHOP_NOTICES_DISABLED"});
  const legacyModerationState=(await db.query(
    "SELECT state,last_error FROM push_deliveries WHERE notification_id=$1",
    [legacyModerationNotice],
  )).rows[0];
  assert.deepEqual(legacyModerationState,{state:"failed",last_error:"REVIEW_MODERATION_PRIVATE"});
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
  // Page size is deliberately bounded, and clearing never reaches another
  // user's or tenant's notices. Unread entries are deleted without being opened.
  // Earlier in this smoke flow the buyer explicitly logged out.
  const activeBuyerToken=(await request("mobile/auth/login",{
    method:"POST",body:{email:buyer.email,password}
  })).data.access_token;
  const noticeIds=Array.from({length:12},()=>crypto.randomUUID());
  for (const [index,id] of noticeIds.entries()) {
    await db.query(
      "INSERT INTO push_notifications(id,user_id,condominium_id,kind,title,body,event_key) VALUES($1,$2,$3,'order',$4,$5,$6)",
      [id,buyer.me.id,buyer.me.condominium_id,"Notification page "+index,"Unread test", "inbox-pagination:"+tag+":"+index],
    );
  }
  const firstTen=(await request("push/inbox?limit=10&page=0",{token:activeBuyerToken})).data;
  assert.equal(firstTen.notifications.length,10);
  assert.equal(firstTen.hasMore,true);
  const secondPage=(await request("push/inbox?limit=10&page=1",{token:activeBuyerToken})).data;
  assert.ok(secondPage.notifications.length>=2);
  assert.ok(secondPage.notifications.every(n=>!firstTen.notifications.some(a=>a.id===n.id)));
  await request("push/inbox?limit=31",{token:activeBuyerToken,expected:400});
  await request("push/inbox?limit=-1",{token:activeBuyerToken,expected:400});
  await request("push/inbox?limit=10.5",{token:activeBuyerToken,expected:400});
  const sellerBeforeClear=(await request("push/inbox?limit=10",{token:seller.token})).data;
  const beforeDelete=(await request("push/summary",{token:activeBuyerToken})).data.unread_count;
  assert.ok(beforeDelete>=12);
  await request("push/inbox",{token:activeBuyerToken,method:"DELETE"});
  assert.equal((await request("push/summary",{token:activeBuyerToken})).data.unread_count,0);
  assert.deepEqual((await request("push/inbox?limit=10",{token:activeBuyerToken})).data.notifications,[]);
  const sellerAfterClear=(await request("push/inbox?limit=10",{token:seller.token})).data;
  assert.deepEqual(sellerAfterClear.notifications.map(n=>n.id),sellerBeforeClear.notifications.map(n=>n.id));
  assert.equal((await request("push/inbox",{token:activeBuyerToken,method:"DELETE"})).data.deleted,0);
  console.log("Scoped inbox clear-all and 10-item pagination PASS.");

  // Marketing is opt-in only, controlled by the superadmin, and never
  // crosses tenant boundaries. Clearing inbox must NOT reset frequency caps.
  const defaultDiscovery=(await request("push/preferences",{token:activeBuyerToken})).data;
  assert.equal(defaultDiscovery.preferences.discovery,false,"Existing residents must be opted out");
  const rulesDefault=(await request("platform/discovery-campaigns",{cookie:admin})).data.campaigns;
  assert.equal(rulesDefault.length,3);
  assert.ok(rulesDefault.every(c=>c.enabled===false&&c.variants.length===2));
  await request("platform/discovery-campaigns",{token:activeBuyerToken,expected:403});
  await request("platform/discovery-campaigns",{
    token:activeBuyerToken,method:"PATCH",
    body:{campaign:"new_products",enabled:true},expected:403,
  });
  await request("push/devices",{
    token:activeBuyerToken,method:"POST",body:{
      installation_id:crypto.randomUUID(),
      expo_token:"ExpoPushToken[discovery_"+tag.replaceAll("-","")+"]",
      platform:"android",project_id:project,
    },
  });
  // Explicit user consent, independently of operational messages.
  await request("push/preferences",{
    token:activeBuyerToken,method:"PATCH",
    body:{condominium:false,orders:true,seller_orders:false,discovery:true},
  });
  assert.equal((await request("push/preferences",{token:activeBuyerToken})).data.preferences.discovery,true);
  // Backwards-compatible old app PATCH should never reset a marketing opt-in.
  await request("push/preferences",{
    token:activeBuyerToken,method:"PATCH",
    body:{condominium:false,orders:true,seller_orders:false},
  });
  assert.equal((await request("push/preferences",{token:activeBuyerToken})).data.preferences.discovery,true);
  const {enqueueDueDiscoveryCampaigns}=await import("../src/server/discovery.ts");
  const midday=new Date("2026-11-02T15:05:00Z");
  assert.equal((await enqueueDueDiscoveryCampaigns(midday)).queued,0,"Disabled campaigns cannot notify");
  await request("platform/discovery-campaigns",{
    cookie:admin,method:"PATCH",body:{campaign:"new_products",enabled:true},
  });
  const marketingFirst=await enqueueDueDiscoveryCampaigns(midday);
  assert.equal(marketingFirst.queued,1,"Only the opted-in buyer gets the discovery message");
  const newNotice=(await request("push/inbox?limit=10",{token:activeBuyerToken})).data.notifications[0];
  assert.equal(newNotice.kind,"discovery_products");
  assert.match(newNotice.title,/novidade|nova/i);
  assert.equal((await enqueueDueDiscoveryCampaigns(midday)).queued,0,"Replay cannot duplicate recipients");
  assert.equal((await db.query(
    "SELECT count(*)::int AS n FROM discovery_delivery_history WHERE user_id=$1",
    [buyer.me.id],
  )).rows[0].n,1);
  await request("push/inbox",{token:activeBuyerToken,method:"DELETE"});
  assert.equal((await enqueueDueDiscoveryCampaigns(midday)).queued,0,
    "Inbox clearing cannot reset the promotional frequency cap");
  await request("platform/discovery-campaigns",{
    cookie:admin,method:"PATCH",body:{campaign:"sunday_food",enabled:true},
  });
  assert.equal((await enqueueDueDiscoveryCampaigns(new Date("2026-11-01T22:05:00Z"))).queued,0,
    "48-hour cooldown blocks a different campaign in the same period");
  await request("push/preferences",{
    token:activeBuyerToken,method:"PATCH",
    body:{condominium:false,orders:true,seller_orders:false,discovery:false},
  });
  assert.equal((await request("push/preferences",{token:activeBuyerToken})).data.preferences.discovery,false);
  await request("platform/discovery-campaigns",{
    cookie:admin,method:"PATCH",body:{campaign:"new_products",enabled:false},
  });
  await request("platform/discovery-campaigns",{
    cookie:admin,method:"PATCH",body:{campaign:"sunday_food",enabled:false},
  });
  console.log("Opt-in discovery, three A/B previews, admin gating and durable caps PASS.");

  process.env.PUSH_ENABLED = "false";
  console.log(
    "Provider queue, receipts and invalid-device cleanup PASS (mock transport; no real push sent).",
  );
  console.log(
    "Mobile audience, identity confirmation, disabled shop announcements, admin messages, orders, idempotency and revocation PASS.",
  );
} finally {
  await db.end();
}
