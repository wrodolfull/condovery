import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from './db';
import {tenantForRequest} from './tenant-host';

export type Viewer = {
  id: string; condominium_id: string; name: string; email: string; phone: string; avatar_image:string|null;
  role: 'admin'|'resident'; status: 'pending'|'approved'|'suspended';
  tower: string; apartment: string; condominium_name: string; towers: string[]; is_superadmin:boolean;
};
export const tokenHash=(token:string)=>crypto.createHash('sha256').update(token).digest('hex');
export const inviteHash=(value:string)=>crypto.createHash('sha256').update(value.trim()).digest('hex');
export function sessionCredential(req:NextRequest):{token:string;kind:'web'|'mobile'}|null {
  const authorization=req.headers.get('authorization');
  if(authorization){
    const match=/^Bearer ([0-9a-f]{64})$/.exec(authorization);
    return match?{token:match[1],kind:'mobile'}:null;
  }
  const token=req.cookies.get('condovery_session')?.value;
  return token&&/^[0-9a-f]{64}$/.test(token)?{token,kind:'web'}:null;
}

export async function sessionViewer(req: NextRequest): Promise<Viewer|null> {
  const credential=sessionCredential(req);
  if(!credential)return null;
  const {token,kind}=credential;
  const {rows} = await query<Viewer>(
    "SELECT u.id, CASE WHEN s.client_kind='web' AND pa.user_id IS NOT NULL THEN COALESCE(s.active_condominium_id,u.condominium_id) ELSE u.condominium_id END AS condominium_id,"+
    " u.name,u.email,u.phone,u.avatar_image,CASE WHEN pa.user_id IS NOT NULL THEN 'admin' ELSE u.role END AS role,u.status,u.tower,u.apartment,"+
    " (s.client_kind='web' AND pa.user_id IS NOT NULL) AS is_superadmin,c.name AS condominium_name,c.towers"+
    " FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN platform_admins pa ON pa.user_id=u.id"+
    " JOIN condominiums c ON c.id=CASE WHEN s.client_kind='web' AND pa.user_id IS NOT NULL THEN COALESCE(s.active_condominium_id,u.condominium_id) ELSE u.condominium_id END"+
    " WHERE s.token_hash=$1 AND s.client_kind=$2 AND s.expires_at>now() AND c.is_active=true"+
    " AND (s.client_kind='mobile' OR pa.user_id IS NULL AND u.role<>'admin' OR s.created_at>now()-interval '24 hours')",
    [tokenHash(token),kind]
  );
  const current=rows[0]??null;
  if(!current)return null;
  const tenant=await tenantForRequest(req);
  // Hostname is never a privilege: compare it to the authenticated tenant.
  if(tenant&&tenant.id!==current.condominium_id)return null;
  return current;
}
export function issueSession(response: NextResponse, token: string) {
  response.cookies.set('condovery_session', token, {
    httpOnly:true, secure:process.env.NODE_ENV === 'production',sameSite:'lax',path:'/',maxAge:60*60*24*14
  });
}
export function clearSession(response: NextResponse) {
  response.cookies.set('condovery_session','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
}
