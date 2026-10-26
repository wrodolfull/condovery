import crypto from 'node:crypto';
import { NextRequest } from 'next/server';

// Cookies are automatically issued HttpOnly by route handlers.
export const randomToken=()=>crypto.randomBytes(32).toString('hex');
export const sha256=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');

export function safeAppOrigin(req:NextRequest):string {
  const allowed=process.env.APP_URL?.replace(/\/$/,'');
  if(process.env.TENANT_BASE_DOMAIN){
    const hostname=req.nextUrl.hostname.toLowerCase();
    const base=process.env.TENANT_BASE_DOMAIN.toLowerCase();
    const suffix='.'+base;
    if(hostname.endsWith(suffix)){
      const label=hostname.slice(0,-suffix.length);
      if(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)&&!['www','api','admin'].includes(label))
        return 'https://'+hostname;
    }
  }
  if(allowed){
    const origin=new URL(allowed).origin;
    if(process.env.NODE_ENV==='production'&&!origin.startsWith('https://')&&!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('APP_URL must use HTTPS in production');
    return origin;
  }
  if(process.env.NODE_ENV==='production')throw new Error('APP_URL is required for OAuth.');
  return req.nextUrl.origin;
}
export function oauthCookie(name:string,value:string,maxAge=600){
  return {name,value,options:{
    httpOnly:true as const,
    sameSite:'lax' as const,
    secure:process.env.NODE_ENV==='production',
    path:'/',maxAge
  }};
}
