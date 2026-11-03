-- 048: targeted read indexes for the superadmin growth dashboard.
-- No per-tenant loops or data copying; all metrics derive from existing tables.
CREATE INDEX IF NOT EXISTS idx_platform_growth_completed_updated
  ON public.orders(updated_at DESC, condominium_id) INCLUDE (total_cents)
  WHERE status='completed';

CREATE INDEX IF NOT EXISTS idx_platform_growth_residents_created
  ON public.users(created_at DESC, condominium_id)
  WHERE role='resident' AND status<>'deleted';

CREATE INDEX IF NOT EXISTS idx_platform_growth_shops_created
  ON public.shops(created_at DESC, condominium_id)
  WHERE status<>'deleted';
