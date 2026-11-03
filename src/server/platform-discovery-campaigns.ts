import {NextRequest,NextResponse} from "next/server";
import {z} from "zod";
import {bad} from "@/lib/api-error";
import type {Viewer} from "@/lib/auth";
import {query} from "@/lib/db";
import {discoveryCampaigns,discoveryMessages} from "@/lib/discovery-campaigns";

type SavedRule={campaign:string;enabled:boolean};
const updateSchema=z.object({
  campaign:z.enum(["new_shop","new_products","sunday_food"]),
  enabled:z.boolean(),
}).strict();

const out=(value:unknown)=>NextResponse.json(value,{headers:{"Cache-Control":"private, no-store"}});

/** Platform-only configuration; always scoped to the superadmin's selected tenant. */
export async function handlePlatformDiscoveryCampaigns(
  req:NextRequest,method:string,path:string,u:Viewer
):Promise<NextResponse|null>{
  if(path!=="platform/discovery-campaigns")return null;
  if(!u.is_superadmin||u.status!=="approved")bad("Acesso exclusivo do superadmin.",403);
  if(method!=="GET"&&method!=="PATCH")bad("Método não permitido.",405);

  try{
    if(method==="GET"){
      const saved=await query<SavedRule>(
        "SELECT campaign,enabled FROM discovery_campaign_rules WHERE condominium_id=$1",
        [u.condominium_id]
      );
      const enabled=new Map(saved.rows.map(rule=>[rule.campaign,rule.enabled]));
      return out({campaigns:discoveryCampaigns.map(rule=>({
        ...rule,enabled:enabled.get(rule.key)??false,
        variants:discoveryMessages(rule.key),
      }))});
    }
    const input=updateSchema.parse(await req.json().catch(()=>bad("JSON inválido.")));
    const updated=await query<SavedRule>(
      "INSERT INTO discovery_campaign_rules(condominium_id,campaign,enabled) "+
      "VALUES($1,$2,$3) "+
      "ON CONFLICT(condominium_id,campaign) DO UPDATE "+
      "SET enabled=EXCLUDED.enabled,updated_at=now() "+
      "RETURNING campaign,enabled",
      [u.condominium_id,input.campaign,input.enabled]
    );
    return out({campaign:updated.rows[0]});
  }catch(error:unknown){
    // A fresh web deploy may precede migration 047 on the VPS.
    // Explain this to the authorized admin instead of masking it as an HTTP 500.
    if((error as {code?:string})?.code==="42P01")
      bad("Campanhas ainda não instaladas no banco. Execute a migração 047_discovery_notifications.sql.",503);
    throw error;
  }
}
