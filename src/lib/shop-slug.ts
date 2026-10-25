export function slugifyShopName(name:string):string{
  const value=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70).replace(/-+$/,'');
  return value||'loja';
}
export function shopSharePath(slug:string):string{
  return '/loja/'+encodeURIComponent(slug);
}
