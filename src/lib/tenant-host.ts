import {NextRequest} from 'next/server';
import {query} from './db';

export function tenantLabel(slug:string):string{
  return slug.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,48)||'condo';
}
export function tenantSubdomainFromHost(hostname:string,baseDomain:string):string|null{
  const host=hostname.toLowerCase().replace(/\.$/,'');
  const base=baseDomain.toLowerCase().replace(/\.$/,'');
  if(!base||host===base||host==='www.'+base)return null;
  const suffix='.'+base;
  if(!host.endsWith(suffix))return null;
  const label=host.slice(0,-suffix.length);
  // Exactly one subdomain level; no nested, malformed or spoofed hostnames.
  if(!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))return null;
  if(['www','api','admin'].includes(label))return null;
  return label;
}
export async function tenantForRequest(req:NextRequest):Promise<{id:string;name:string;subdomain:string}|null>{
  const base=process.env.TENANT_BASE_DOMAIN;
  if(!base)return null;
  // Next's parsed request URL is the authoritative host after ingress routing.
  // Never use untrusted X-Forwarded-Host for tenant identification.
  const host=req.nextUrl.hostname.toLowerCase();
  const label=tenantSubdomainFromHost(host,base);
  if(!label){
    // Disallow undeclared nested or malformed wildcard hosts from falling through
    // to the central tenant-neutral application.
    if(host.endsWith('.'+base.toLowerCase())&&
      !['www','api','admin'].includes(host.slice(0,-base.length-1)))throw new Error('TENANT_NOT_FOUND');
    return null;
  }
  const found=await query<{id:string;name:string;subdomain:string}>(
    'SELECT id,name,subdomain FROM condominiums WHERE subdomain=$1 AND is_active=true',
    [label]);
  if(!found.rowCount)throw new Error('TENANT_NOT_FOUND');
  return found.rows[0];
}
export function isTenantHostname(req:NextRequest):boolean{
  return Boolean(process.env.TENANT_BASE_DOMAIN&&tenantSubdomainFromHost(req.nextUrl.hostname,process.env.TENANT_BASE_DOMAIN));
}
