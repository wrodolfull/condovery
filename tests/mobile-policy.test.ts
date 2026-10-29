import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { mobileRouteAllowed } from "../src/lib/mobile-policy";
import { sessionCredential } from "../src/lib/auth";
import { expoTokenValid } from "../src/server/push";
import { retryDelay } from "../src/server/push-dispatch";
const id = "22da294e-aab1-43ba-b9df-4807b87cf880";
test("mobile credentials can buy and use owner-scoped seller capabilities", () => {
  for (const [path, method] of [
    ["home", "GET"],
    ["favorite-shops","GET"],
    ["favorite-shops","POST"],
    ["favorite-shops/"+id,"DELETE"],
    ["orders", "POST"],
    ["orders/"+id,"GET"],
    ["orders/quote", "POST"],
    ["shops/" + id + "/reviews", "GET"],
    ["media/" + id, "GET"],
    ["giveaways/" + id, "PUT"],
    ["push/inbox/" + id, "GET"],
    ["me", "DELETE"],
    ["ads/" + id + "/impression", "POST"],
    ["ads/" + id + "/click", "POST"],
  ])
    assert.equal(mobileRouteAllowed(path, method), true, path);
  for (const [path, method] of [
    ["admin/summary", "GET"],
    ["platform/condominiums", "GET"],
    ["fairs/manage", "GET"],
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

test("mobile seller operations are allowlisted but privileged admin endpoints remain blocked", () => {
  for (const [route,method] of [
    ["shops/mine","GET"],["shops/mine","POST"],["shops/mine","PATCH"],
    ["shops/mine/push","POST"],
    ["shops/mine/status","PATCH"],["shops/mine/reviews","GET"],
    ["shops/mine/reviews/"+id,"PATCH"],["products","POST"],
    ["products/"+id,"PATCH"],["products/"+id,"DELETE"],
    ["orders/"+id,"PATCH"],["seller/insights","GET"],
    ["fairs/seller","GET"],["fairs/"+id+"/applications","POST"],
    ["fairs/"+id+"/applications/"+id,"DELETE"],["media","POST"],
  ]) assert.equal(mobileRouteAllowed(route,method),true,route+" "+method);
  for (const route of ["admin/summary","fairs/manage","media/ad"])
    assert.equal(mobileRouteAllowed(route,"POST"),false,route);
});

test("shop bookmarks keep mobile mutation methods explicitly scoped", () => {
  for (const [path,method] of [
    ["favorite-shops","DELETE"],["favorite-shops","PATCH"],
    ["favorite-shops/"+id,"GET"],["favorite-shops/"+id,"POST"],
    ["favorite-shops/not-a-uuid","DELETE"],
  ]) assert.equal(mobileRouteAllowed(path,method),false,path+" "+method);
});
