-- Speed up the paginated tenant catalog without caching user/tenant data.
-- Partial index excludes hidden and soft-deleted products, matching the catalog query.
CREATE INDEX IF NOT EXISTS idx_products_tenant_catalog_recent
  ON public.products (condominium_id, created_at DESC, id DESC)
  WHERE visibility <> 'hidden' AND deleted_at IS NULL;
