import test from "node:test";
import assert from "node:assert/strict";
import {
  sellerOrderSection,sellerOrderSections,sellerOrderCounts,sellerOrdersInSection,
} from "../src/lib/seller-order-sections";

const orders=[
  {id:"fresh",status:"awaiting_confirmation"},
  {id:"ongoing",status:"confirmed"},
  {id:"finished",status:"completed"},
  {id:"another-new",status:"awaiting_confirmation"},
  {id:"cancelled",status:"cancelled"},
];

test("seller tabs categorize only the existing order states",()=>{
  assert.deepEqual(sellerOrderSections.map(tab=>tab.label),["Novos","Em andamento","Histórico"]);
  assert.equal(sellerOrderSection("awaiting_confirmation"),"new");
  assert.equal(sellerOrderSection("confirmed"),"ongoing");
  assert.equal(sellerOrderSection("completed"),"history");
  assert.equal(sellerOrderSection("cancelled"),"history");
});

test("seller tab counts and filtered cards use the same loaded rows",()=>{
  assert.deepEqual(sellerOrderCounts(orders),{new:2,ongoing:1,history:2});
  assert.deepEqual(sellerOrdersInSection(orders,"new").map(o=>o.id),["fresh","another-new"]);
  assert.deepEqual(sellerOrdersInSection(orders,"ongoing").map(o=>o.id),["ongoing"]);
  assert.deepEqual(sellerOrdersInSection(orders,"history").map(o=>o.id),["finished","cancelled"]);
  assert.equal(orders.length,5);
});

test("order status changes move cards between tabs without creating a new status",()=>{
  const latest=orders.map(order=>order.id==="fresh"?{...order,status:"confirmed"}:order);
  assert.deepEqual(sellerOrderCounts(latest),{new:1,ongoing:2,history:2});
  assert.deepEqual(sellerOrderCounts([]),{new:0,ongoing:0,history:0});
});
