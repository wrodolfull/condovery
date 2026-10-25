-- Readable permanent identifiers. Slugs remain attached to shops if renamed.
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS slug text;
-- Legacy UUID links keep working; assign legacy shops a deterministic suffix on
-- collision so a backfill never changes a previously assigned slug.
WITH normalized AS (
  SELECT id,
    COALESCE(NULLIF(trim(both '-' from regexp_replace(
      translate(lower(name),'áàâãäéèêëíìîïóòôõöúùûüçñ','aaaaaeeeeiiiiooooouuuucn'),
      '[^a-z0-9]+','-','g'
    )) ,''),'loja') AS stem
  FROM public.shops WHERE slug IS NULL
), numbered AS (
  SELECT id,left(stem,70) AS stem,
    row_number() OVER(PARTITION BY stem ORDER BY id) AS seq
  FROM normalized
)
UPDATE public.shops s SET slug=CASE
  WHEN n.seq=1 AND NOT EXISTS(SELECT 1 FROM public.shops x WHERE x.slug=n.stem)
    THEN n.stem
  ELSE left(n.stem,60)||'-'||substr(replace(n.id::text,'-',''),1,8)
END
FROM numbered n WHERE s.id=n.id AND s.slug IS NULL;
-- Deleted historical rows continue to occupy their slug, so links are never reassigned.
CREATE UNIQUE INDEX IF NOT EXISTS shops_slug_unique_idx ON public.shops(slug);
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_slug_format;
ALTER TABLE public.shops ADD CONSTRAINT shops_slug_format CHECK(slug IS NULL OR slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
