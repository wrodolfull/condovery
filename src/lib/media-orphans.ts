/**
 * Only delete media whose metadata was registered but never referenced by
 * any persisted content. Paths are global media IDs; check across tenants,
 * including suspended/hidden/deleted content and historical campaigns.
 */
export const ORPHAN_MEDIA_MIN_AGE_DAYS=30;
export const ORPHAN_MEDIA_MAX_BATCH=100;

const sourceColumns=[
  {table:'users',columns:['avatar_image']},
  {table:'shops',columns:['cover_image','logo_image']},
  {table:'products',columns:['image_url']},
  {table:'giveaway_items',columns:['image_url']},
  {table:'advertising_campaigns',columns:['image_url']},
  {table:'community_fairs',columns:['cover_image_url']}
] as const;

// All table and column names are controlled by the code, never user input.
// No status or tenant filter: even a suspended shop or an archived ad protects
// any referenced image. LOWER is intentional for older uppercase UUID links.
export const mediaReferencedSQL='('+sourceColumns.map(({table,columns},i)=>{
  const alias='r'+i;
  return `EXISTS (SELECT 1 FROM public.${table} ${alias} WHERE (${columns.map(column=>
    `LOWER(${alias}.${column}) = '/api/media/' || m.id::text`).join(' OR ')}))`;
}).join(' OR ')+')';

export const findOrphanMediaSQL=`
  SELECT m.id,m.condominium_id,m.storage_key,m.created_at
  FROM public.media_assets m
  WHERE m.created_at < now() - ($1::int * interval '1 day')
    AND NOT ${mediaReferencedSQL}
  ORDER BY m.created_at,m.id
  LIMIT $2
`;

// Row lock protects the metadata while the Storage request is in flight;
// reference checks are deliberately repeated immediately before removal.
export const lockOrphanMediaSQL=`
  SELECT m.id,m.condominium_id,m.storage_key
  FROM public.media_assets m
  WHERE m.id=$1 AND m.condominium_id=$2
    AND m.created_at < now() - ($3::int * interval '1 day')
    AND NOT ${mediaReferencedSQL}
  FOR UPDATE OF m
`;

export type OrphanMediaOptions={apply:boolean;days:number;limit:number};
export function parseOrphanMediaOptions(args:string[]):OrphanMediaOptions{
  let apply=false,days=ORPHAN_MEDIA_MIN_AGE_DAYS,limit=50;
  const seen=new Set<string>();
  for(const argument of args){
    if(argument==='--apply'){
      if(seen.has('apply'))throw new Error('Opção --apply duplicada.');
      seen.add('apply');apply=true;continue;
    }
    const match=/^--(days|limit)=(\d+)$/.exec(argument);
    if(!match||seen.has(match[1]))throw new Error('Opção desconhecida ou duplicada: '+argument);
    seen.add(match[1]);
    const value=Number(match[2]);
    if(!Number.isSafeInteger(value))throw new Error('Número inválido para '+match[1]);
    if(match[1]==='days')days=value;
    else limit=value;
  }
  if(days<ORPHAN_MEDIA_MIN_AGE_DAYS||days>3650)
    throw new Error('A idade mínima é de 30 dias; --days deve ficar entre 30 e 3650.');
  if(limit<1||limit>ORPHAN_MEDIA_MAX_BATCH)
    throw new Error('Use --limit entre 1 e '+ORPHAN_MEDIA_MAX_BATCH+'.');
  return {apply,days,limit};
}
