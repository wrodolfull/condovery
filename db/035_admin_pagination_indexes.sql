-- Administrative pagination and common tenant-scoped filters.
CREATE INDEX IF NOT EXISTS idx_ads_admin_created ON public.advertising_campaigns(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_ads_admin_condo_created ON public.advertising_campaigns(condominium_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_ads_admin_billing_created ON public.advertising_campaigns(billing_status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_reports_condo_status_created ON public.content_reports(condominium_id,status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_condominiums_admin_created ON public.condominiums(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_ad_metrics_campaign ON public.ad_metric_daily(campaign_id);
