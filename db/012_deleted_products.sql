-- Retain product rows for order-item referential integrity and audit history.
-- Deleted products are hidden from catalogue and seller controls; order snapshots persist.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS products_seller_visible_idx
  ON public.products(condominium_id,shop_id,created_at DESC) WHERE deleted_at IS NULL;
