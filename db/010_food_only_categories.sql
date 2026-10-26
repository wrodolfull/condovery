-- Hide legacy non-food categories without deleting categories, products or orders.
-- Existing category IDs and historical records are retained for audit/history.
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
UPDATE public.categories SET is_active=false
WHERE name IN (
  'Beleza','Saúde e bem-estar','Casa e decoração',
  'Eletrônicos','Presentes','Outros'
) AND is_active=true;
CREATE INDEX IF NOT EXISTS categories_condo_active_idx
  ON public.categories(condominium_id,sort_order,name) WHERE is_active=true;
