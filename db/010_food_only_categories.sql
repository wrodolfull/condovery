-- Hide legacy non-food categories without deleting categories, products or orders.
-- Existing category IDs and historical records are retained for audit/history.
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
-- Category state is now solely controlled by the administrator. Never reset it during migration.
CREATE INDEX IF NOT EXISTS categories_condo_active_idx
  ON public.categories(condominium_id,sort_order,name) WHERE is_active=true;
