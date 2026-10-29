/** Restrict the credential, not just the UI. Web credentials cannot be used as bearer tokens. */
export function mobileRouteAllowed(path: string, method: string): boolean {
  if (path.startsWith("mobile/auth/")) return true;
  if (path === "mobile/config" && method === "GET") return true;
  if (path === "me") return ["GET", "PATCH", "DELETE"].includes(method);
  if (path === "auth/logout") return method === "POST";
  if (
    ["home", "catalog", "favorites", "ads", "fairs"].includes(path) &&
    method === "GET"
  )
    return true;
  if (path === "favorites" && method === "POST") return true;
  if (path === "favorite-shops") return method === "GET" || method === "POST";
  if (new RegExp("^favorite-shops/" + "[0-9a-fA-F-]{36}" + "$").test(path)) return method === "DELETE";
  const id = "[0-9a-fA-F-]{36}";
  if (new RegExp("^favorites/" + id + "$").test(path))
    return method === "DELETE";
  if (/^shops\/(?!mine(?:\/|$))[a-z0-9-]+$/.test(path)) return method === "GET";
  if (new RegExp("^shops/" + id + "/reviews$").test(path))
    return method === "GET";
  // Seller endpoints retain all server-side owner, tenant and status checks.
  if (path === "seller/insights") return method === "GET";
  if (path === "fairs/seller") return method === "GET";
  if (new RegExp("^fairs/" + id + "/applications$").test(path)) return method === "POST";
  if (new RegExp("^fairs/" + id + "/applications/" + id + "$").test(path)) return method === "DELETE";
  if (path === "shops/mine")
    return ["GET", "POST", "PATCH", "DELETE"].includes(method);
  if (path === "shops/mine/status") return method === "PATCH";
  if (path === "shops/mine/push") return method === "POST";
  if (path === "shops/mine/reviews") return method === "GET";
  if (new RegExp("^shops/mine/reviews/" + id + "$").test(path))
    return method === "PATCH";
  if (path === "products") return method === "POST";
  if (new RegExp("^products/" + id + "$").test(path))
    return ["PATCH", "DELETE"].includes(method);
  if (new RegExp("^products/" + id + "/visibility$").test(path))
    return method === "PATCH";
  if (new RegExp("^orders/" + id + "$").test(path))
    return method === "PATCH";
  if (path === "media") return method === "POST";
  if (path === "orders") return method === "POST" || method === "GET";
  if (path === "orders/quote" || path === "reports") return method === "POST";
  if (new RegExp("^orders/" + id + "/whatsapp$").test(path))
    return method === "GET";
  if (new RegExp("^orders/" + id + "/review$").test(path))
    return method === "POST";
  if (new RegExp("^media/" + id + "$").test(path)) return method === "GET";
  if (path === "media/profile" || path === "media/giveaway")
    return method === "POST";
  if (new RegExp("^ads/" + id + "/(impression|click)$").test(path))
    return method === "POST";
  if (new RegExp("^fairs/" + id + "$").test(path)) return method === "GET";
  if (path === "giveaways" || new RegExp("^giveaways/" + id + "$").test(path))
    return ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method);
  if (path === "push/devices") return ["POST", "DELETE"].includes(method);
  if (path === "push/preferences") return ["GET", "PATCH"].includes(method);
  if (path === "push/inbox") return method === "GET";
  if (new RegExp("^push/inbox/" + id + "$").test(path))
    return method === "GET" || method === "PATCH";
  if (new RegExp("^push/shops/" + id + "$").test(path))
    return ["GET", "PUT", "DELETE"].includes(method);
  return false;
}
