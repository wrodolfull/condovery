import test from "node:test";
import assert from "node:assert/strict";
import {
  discoveryCampaigns,discoveryMessages,discoveryVariant,
  discoveryWindowOpen,localDiscoveryTime,
} from "../src/lib/discovery-campaigns";

test("every discovery trigger has two different Brazilian Portuguese messages",()=>{
  assert.deepEqual(discoveryCampaigns.map(c=>c.key),["new_shop","new_products","sunday_food"]);
  for(const campaign of discoveryCampaigns){
    const [a,b]=discoveryMessages(campaign.key,"Doces da Gabi");
    assert.notEqual(a.title,b.title);
    assert.notEqual(a.body,b.body);
    for(const m of [a,b]){
      assert.ok(m.title.length<=70,"Push title bound");
      assert.ok(m.body.length<=240,"Push body bound");
    }
  }
  const variants=discoveryMessages("new_shop","Doces da Gabi");
  assert.ok(variants[0].body.includes("Doces da Gabi"));
  assert.ok(variants[1].body.includes("Doces da Gabi"));
  assert.ok(discoveryMessages("new_shop","x".repeat(300))[0].body.length<=240);
});
test("A/B assignment is stable per recipient and event, never random",()=>{
  const recipient="7e8d22b5-7cd1-4ae7-87e3-7e3b30bb063d";
  const key="discovery:products:test:2026-11-02";
  assert.equal(discoveryVariant(recipient,key),discoveryVariant(recipient,key));
  assert.ok([0,1].includes(discoveryVariant(recipient,key)));
});
test("campaign delivery respects São Paulo hours, Sunday and daily midday window",()=>{
  const t=localDiscoveryTime(new Date("2026-11-01T22:00:00Z")); // 19:00 Sun BRT
  assert.equal(t.weekday,"Sun");
  assert.equal(t.hour,19);
  assert.equal(discoveryWindowOpen("sunday_food",t),true);
  assert.equal(discoveryWindowOpen("sunday_food",{...t,weekday:"Mon"}),false);
  assert.equal(discoveryWindowOpen("new_products",t),false);
  assert.equal(discoveryWindowOpen("new_products",{...t,hour:12}),true);
  assert.equal(discoveryWindowOpen("new_shop",{...t,hour:9}),false);
  assert.equal(discoveryWindowOpen("new_shop",{...t,hour:21}),false);
  assert.equal(discoveryWindowOpen("new_shop",{...t,hour:20,minute:30}),true);
});
