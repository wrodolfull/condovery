import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { query } from './db';

export type Viewer = {
  id: string; condominium_id: string; name: string; email: string; phone: string;
  role: 'admin'|'resident'; status: 'pending'|'approved'|'suspended';
  tower: string; apartment: string; condominium_name: string; towers: string[];
};
export const tokenHash=(token:string)=>crypto.createHash('sha256').update(token).digest('hex');
export const inviteHash=(value:string)=>crypto.createHash('sha256').update(value.trim()).digest('hex');

export async function sessionViewer(req: NextRequest): Promise<Viewer|null> {
  const token = req.cookies.get('condovery_session')?.value;
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const {rows} = await query<Viewer>(
    "SELECT u.id,u.condominium_id,u.name,u.email,u.phone,u.role,u.status,u.tower,u.apartment,c.name AS condominium_name,c.towers FROM sessions s JOIN users u ON u.id=s.user_id JOIN condominiums c ON c.id=u.condominium_id WHERE s.token_hash=$1 AND s.expires_at>now() AND c.is_active=true",
    [tokenHash(token)]
  );
  return rows[0] ?? null;
}
export function issueSession(response: NextResponse, token: string) {
  response.cookies.set('condovery_session', token, {
    httpOnly:true, secure:process.env.NODE_ENV === 'production',sameSite:'lax',path:'/',maxAge:60*60*24*14
  });
}
export function clearSession(response: NextResponse) {
  response.cookies.set('condovery_session','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
}
