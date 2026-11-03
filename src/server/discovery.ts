import type {PoolClient} from "pg";
import {query,transaction} from "@/lib/db";
import {enqueueNotice} from "@/server/push";
import {
  discoveryCampaigns,discoveryMessages,discoveryVariant,
  discoveryWindowOpen,localDiscoveryTime,type DiscoveryCampaign,
} from "@/lib/discovery-campaigns";

type Rule={condominium_id:string;campaign:DiscoveryCampaign};
type Opportunity={eventKey:string;targetId:string|null;shopName?:string};
type Recipient={id:string};
const CAMPAIGN_LIMIT_PER_RUN=120;

async function opportunity(tx:PoolClient,condominiumId:string,campaign:DiscoveryCampaign,date:string)
  :Promise<Opportunity|null>{
  // A new shop must actually be approved, open and selling at least one product.
  const productReady=
    "p.condominium_id=s.condominium_id AND p.shop_id=s.id " +
    "AND p.visibility='available' AND p.is_available=true AND p.deleted_at IS NULL " +
    "AND p.moderation_blocked=false AND (p.stock IS NULL OR p.stock>0)";
  const shopReady="s.condominium_id=$1 AND s.status='approved' AND s.is_open=true";
  if(campaign==="new_shop"){
    const r=await tx.query<{id:string;name:string}>(
      "SELECT s.id,s.name FROM shops s WHERE "+shopReady+
      " AND s.created_at>=now()-interval '3 days' " +
      "AND EXISTS(SELECT 1 FROM products p WHERE "+productReady+") " +
      "ORDER BY s.created_at DESC,s.id LIMIT 1",[condominiumId]
    );
    const shop=r.rows[0];
    return shop?{eventKey:"discovery:new_shop:"+shop.id,targetId:shop.id,shopName:shop.name}:null;
  }
  if(campaign==="new_products"){
    const r=await tx.query(
      "SELECT 1 FROM products p JOIN shops s ON s.id=p.shop_id " +
      "WHERE "+shopReady+" AND "+productReady+
      " AND p.created_at>=now()-interval '48 hours' LIMIT 1",[condominiumId]
    );
    return r.rowCount?{eventKey:"discovery:products:"+condominiumId+":"+date,targetId:null}:null;
  }
  // Sunday campaign is never sent if food categories have no products for sale.
  const r=await tx.query(
    "SELECT 1 FROM products p JOIN shops s ON s.id=p.shop_id " +
    "JOIN categories c ON c.id=p.category_id AND c.condominium_id=p.condominium_id " +
    "WHERE "+shopReady+" AND "+productReady+" AND c.is_active=true AND (" +
    "lower(c.name) LIKE ANY(ARRAY['%doce%','%bolo%','%pão%','%salgad%','%refei%','%lanche%','%pizza%','%sobremesa%','%sorvete%','%açaí%','%bebida%','%aliment%','%marmita%'])" +
    ") LIMIT 1",[condominiumId]
  );
  return r.rowCount?{eventKey:"discovery:sunday:"+condominiumId+":"+date,targetId:null}:null;
}

async function eligibleRecipients(tx:PoolClient,condominiumId:string,eventKey:string){
  const r=await tx.query<Recipient>(
    "SELECT u.id FROM users u JOIN push_preferences p ON p.user_id=u.id " +
    "WHERE u.condominium_id=$1 AND u.status='approved' AND p.discovery=true " +
    "AND EXISTS (SELECT 1 FROM push_devices d JOIN sessions s ON s.token_hash=d.session_hash " +
      "WHERE d.user_id=u.id AND d.condominium_id=$1 AND d.disabled=false " +
      "AND s.client_kind='mobile' AND s.expires_at>now()) " +
    "AND NOT EXISTS (SELECT 1 FROM discovery_delivery_history h WHERE h.user_id=u.id AND h.event_key=$2) " +
    "AND NOT EXISTS (SELECT 1 FROM discovery_delivery_history h WHERE h.user_id=u.id AND h.created_at>now()-interval '48 hours') " +
    "AND (SELECT count(*) FROM discovery_delivery_history h WHERE h.user_id=u.id " +
      "AND h.created_at>now()-interval '7 days')<2 " +
    "ORDER BY u.id LIMIT $3",[condominiumId,eventKey,CAMPAIGN_LIMIT_PER_RUN]
  );
  return r.rows;
}

/** Called by the existing push worker, not by a public endpoint.
 * Tenant-level advisory locks serialize concurrent workers and enforce per-user caps.
 * All outbox records and rate-limit history commit atomically.
 */
export async function enqueueDueDiscoveryCampaigns(now=new Date()){
  const local=localDiscoveryTime(now);
  const openRules=discoveryCampaigns.filter(r=>discoveryWindowOpen(r.key,local)).map(r=>r.key);
  if(!openRules.length)return {checked:0,queued:0};
  // The platform admin must explicitly enable a rule before anything sends.
  const rules=await query<Rule>(
    "SELECT r.condominium_id,r.campaign FROM discovery_campaign_rules r " +
    "JOIN condominiums c ON c.id=r.condominium_id AND c.is_active=true " +
    "WHERE r.enabled=true AND r.campaign=ANY($1::text[]) ORDER BY r.condominium_id",
    [openRules]
  );
  const byCondo=new Map<string,DiscoveryCampaign[]>();
  for(const row of rules.rows){
    const list=byCondo.get(row.condominium_id)??[];
    list.push(row.campaign);byCondo.set(row.condominium_id,list);
  }
  let queued=0,checked=0;
  for(const [condominiumId,campaigns] of byCondo){
    await transaction(async tx=>{
      const lock=await tx.query<{locked:boolean}>(
        "SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS locked",
        ["discovery:"+condominiumId]
      );
      if(!lock.rows[0]?.locked)return;
      for(const campaign of campaigns){
        const item=await opportunity(tx,condominiumId,campaign,local.date);
        if(!item)continue;
        checked++;
        const candidates=await eligibleRecipients(tx,condominiumId,item.eventKey);
        for(const recipient of candidates){
          const variant=discoveryVariant(recipient.id,item.eventKey);
          const message=discoveryMessages(campaign,item.shopName)[variant];
          const kind=campaign==="new_shop"?"discovery_shop":
            campaign==="new_products"?"discovery_products":"discovery_sunday";
          await enqueueNotice(tx,{
            userId:recipient.id,condominiumId,kind,
            title:message.title,body:message.body,targetId:item.targetId,eventKey:item.eventKey,
          });
          const notice=await tx.query<{id:string}>(
            "SELECT id FROM push_notifications WHERE user_id=$1 AND condominium_id=$2 AND event_key=$3",
            [recipient.id,condominiumId,item.eventKey]
          );
          // This history survives inbox clearing and is the rate-limit authority.
          const inserted=await tx.query(
            "INSERT INTO discovery_delivery_history(user_id,condominium_id,campaign,event_key,variant,notification_id) " +
            "VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,event_key) DO NOTHING",
            [recipient.id,condominiumId,campaign,item.eventKey,variant,notice.rows[0]?.id??null]
          );
          queued+=inserted.rowCount??0;
        }
      }
    });
  }
  return {checked,queued};
}
