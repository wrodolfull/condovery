export function normalizeCondominiumSlug(value:string):string{
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60).replace(/-$/,'');
}
export function normalizeTenantDomain(value:string):string{
  const domain=value.trim().toLowerCase().replace(/\.$/,'');
  if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(domain))
    throw new Error('Domínio inválido.');
  return domain;
}
