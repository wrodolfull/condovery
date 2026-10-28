import type {NextRequest} from 'next/server';
import {bad} from '@/lib/api-error';

export type RequestOriginPolicy='allow'|'reject';
/** Browser-origin CSRF protection; non-browser clients still require credentials. */
export function requestOriginPolicy(input:{
  method:string;origin:string|null;fetchSite:string|null;requestHost:string;production:boolean;
}):RequestOriginPolicy{
  if(input.method==='GET'||input.method==='HEAD'||input.method==='OPTIONS')return 'allow';
  if(input.fetchSite==='cross-site')return 'reject';
  if(input.origin){
    let origin:URL;
    try{origin=new URL(input.origin);}catch{return 'reject';}
    if(!['https:','http:'].includes(origin.protocol)||origin.username||origin.password)return 'reject';
    if(origin.host.toLowerCase()!==input.requestHost.toLowerCase())return 'reject';
    if(input.production&&origin.protocol!=='https:'&&
      !['localhost','127.0.0.1'].includes(origin.hostname))return 'reject';
  }
  // Modern browsers disclose Origin or Sec-Fetch-Site on state-changing
  // requests. Same-site requests without Origin can originate at a sibling
  // subdomain; refuse those, but allow legacy server clients without either.
  if(!input.origin&&input.fetchSite==='same-site')return 'reject';
  return 'allow';
}
export function protectMutation(req:NextRequest,method:string){
  const result=requestOriginPolicy({
    method,origin:req.headers.get('origin'),
    fetchSite:req.headers.get('sec-fetch-site'),
    // Next.js may normalize req.nextUrl.host to an internal proxy hostname.
    // The HTTP Host header preserves the public host that the browser used.
    requestHost:req.headers.get('host')?.trim()||req.nextUrl.host,
    production:process.env.NODE_ENV==='production'
  });
  if(result==='reject')bad('Origem da solicitação não permitida.',403);
}
