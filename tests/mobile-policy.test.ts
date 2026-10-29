import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { mobileRouteAllowed } from "../src/lib/mobile-policy";
import { sessionCredential } from "../src/lib/auth";
import { expoTokenValid } from "../src/server/push";
import { retryDelay } from "../src/server/push-dispatch";
const id = "22da294e-aab1-43ba-b9df-4807b87cf880";
test("mobile credentials can buy and use only resident capabilities", () => {
  for (const [path, method] of [
    ["home", "GET"],
    ["orders", "POST"],
    ["orders/quote", "POST"],
    ["shops/" + id + "/reviews", "GET"],
    ["media/" + id, "GET"],
    ["giveaways/" + id, "PUT"],
    ["push/inbox/" + id, "GET"],
    ["me", "DELETE"],
  ])
    assert.equal(mobileRouteAllowed(path, method), true, path);
  for (const [path, method] of [
    ["admin/summary", "GET"],
    ["platform/condominiums", "GET"],
    ["shops/mine", "GET"],
    ["shops/mine/push", "POST"],
    ["products", "POST"],
    ["orders/" + id, "PATCH"],
    ["fairs/manage", "GET"],
    ["fairs/seller", "GET"],
    ["media/ad", "POST"],
    ["auth/login", "POST"],
  ])
    assert.equal(mobileRouteAllowed(path, method), false, path);
});
test("bearer and cookie audiences are distinguished; invalid bearer never falls back", () => {
  const token = "a".repeat(64);
  assert.deepEqual(
    sessionCredential(
      new NextRequest("https://example.com", {
        headers: { Authorization: "Bearer " + token },
      }),
    ),
    { token, kind: "mobile" },
  );
  assert.deepEqual(
    sessionCredential(
      new NextRequest("https://example.com", {
        headers: { Cookie: "condovery_session=" + token },
      }),
    ),
    { token, kind: "web" },
  );
  assert.equal(
    sessionCredential(
      new NextRequest("https://example.com", {
        headers: {
          Authorization: "Bearer invalid",
          Cookie: "condovery_session=" + token,
        },
      }),
    ),
    null,
  );
});
test("push validates tokens and bounds provider backoff", () => {
  assert.equal(expoTokenValid("ExpoPushToken[abcdefghij_123]"), true);
  assert.equal(expoTokenValid("https://attacker.example/token"), false);
  assert.equal(retryDelay(1), 30);
  assert.equal(retryDelay(30), 1800);
});
