-- Every tenant has a stable, globally unique hostname label.
-- The canonical label has no hyphens where possible: morada-do-vale -> moradadovale.
ALTER TABLE public.condominiums ADD COLUMN IF NOT EXISTS subdomain text;
WITH normalized AS (
 SELECT id,
   COALESCE(NULLIF(regexp_replace(lower(slug),'[^a-z0-9]','','g'),''),'condo') AS base
 FROM public.condominiums WHERE subdomain IS NULL
), ranked AS (
 SELECT id,left(base,48) AS base,
   row_number() OVER (PARTITION BY left(base,48) ORDER BY id) AS rank
 FROM normalized
)
UPDATE public.condominiums c SET subdomain=CASE
 WHEN r.rank=1 AND NOT EXISTS (SELECT 1 FROM public.condominiums t WHERE t.subdomain=r.base) THEN r.base
 ELSE left(r.base,38)||substr(replace(r.id::text,'-',''),1,8)
END FROM ranked r WHERE c.id=r.id AND c.subdomain IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS condominiums_subdomain_unique
 ON public.condominiums(subdomain);
ALTER TABLE public.condominiums DROP CONSTRAINT IF EXISTS condominiums_subdomain_format;
ALTER TABLE public.condominiums ADD CONSTRAINT condominiums_subdomain_format
 CHECK(subdomain IS NULL OR subdomain ~ '^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$');
