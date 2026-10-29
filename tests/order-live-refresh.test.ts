import assert from "node:assert/strict";
import test from "node:test";
import {mergeRefreshedOrders} from "../src/lib/order-live-refresh";

test("buyer live refresh replaces a short first page and removes stale entries",()=>{
  const fresh=[{id:"new",status:"confirmed"},{id:"first",status:"completed"}];
  const old=[{id:"first",status:"awaiting_confirmation"},{id:"stale",status:"confirmed"}];
  assert.deepEqual(mergeRefreshedOrders(fresh,old,false),fresh);
});
test("buyer live refresh preserves loaded history and updates matching status",()=>{
  const fresh=[{id:"new",status:"confirmed"},{id:"first",status:"completed"}];
  const old=[{id:"first",status:"awaiting_confirmation"},{id:"older",status:"confirmed"}];
  assert.deepEqual(mergeRefreshedOrders(fresh,old,true),[...fresh,old[1]]);
});
