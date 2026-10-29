-- Stable open-first pagination of approved shops within each condominium.
CREATE INDEX IF NOT EXISTS idx_shops_tenant_public_directory
  ON public.shops (condominium_id, is_open DESC, created_at DESC, id DESC)
  WHERE status='approved';
