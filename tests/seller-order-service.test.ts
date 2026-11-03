import test from "node:test";
import assert from "node:assert/strict";
import {
  sellerOrderNeedsAttention,sellerBuyerWhatsApp,SELLER_ORDER_WAIT_ALERT_MINUTES,
} from "../src/lib/seller-order-service";

test("seller overdue alert is passive, exclusive to unconfirmed orders and timezone-safe",()=>{
  const now=Date.parse("2026-11-02T18:00:00Z");
  const old={status:"awaiting_confirmation",created_at:new Date(now-20*60_000).toISOString()};
  assert.equal(SELLER_ORDER_WAIT_ALERT_MINUTES,20);
  assert.equal(sellerOrderNeedsAttention(old,now),true);
  assert.equal(sellerOrderNeedsAttention({...old,created_at:new Date(now-19*60_000).toISOString()},now),false);
  assert.equal(sellerOrderNeedsAttention({...old,status:"confirmed"},now),false);
  assert.equal(sellerOrderNeedsAttention({...old,status:"cancelled"},now),false);
  assert.equal(sellerOrderNeedsAttention({...old,created_at:"invalid"},now),false);
  assert.equal(sellerOrderNeedsAttention({...old,created_at:new Date(now+1000).toISOString()},now),false);
});
test("seller contact only opens a normalized Brazilian WhatsApp with order reference",()=>{
  const local=sellerBuyerWhatsApp("(19) 99999-1234",1042);
  const intl=sellerBuyerWhatsApp("+55 19 99999-1234",1042);
  assert.equal(local,intl);
  const link=new URL(local!);
  assert.equal(link.hostname,"wa.me");
  assert.equal(link.pathname,"/5519999991234");
  assert.match(link.searchParams.get("text")??"",/pedido #1042/);
  for(const value of ["","123","https://attacker.example","5511111111111111111"]){
    assert.equal(sellerBuyerWhatsApp(value,100),null);
  }
});
