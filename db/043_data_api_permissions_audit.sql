-- Idempotent Data API lockdown for all backend-owned Elevadoor business tables.
-- App traffic uses DATABASE_URL with the owning PostgreSQL role. Do not use a
-- Supabase anon/authenticated/service_role client to query these tables directly.
-- Run after 042. Back up and test in a staging environment before production.
DO $$
DECLARE
  table_name text;
  role_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'condominiums','users','sessions','login_attempts','categories','shops',
    'products','media_assets','orders','order_items','favorites',
    'google_oauth_flows','google_signup_pending','password_reset_tokens',
    'password_reset_attempts','content_reports','shop_reviews',
    'account_deletion_jobs','shop_deletion_jobs','platform_admins',
    'advertising_campaigns','ads_settings','ad_metric_daily','ad_metric_dedupe',
    'giveaway_items','marketing_leads','auth_rate_events',
    'community_fairs','community_fair_products','ad_report_shares',
    'mobile_oauth_flows','mobile_auth_grants','mobile_signup_pending',
    'push_preferences','push_devices','shop_push_subscriptions',
    'push_broadcasts','push_notifications','push_deliveries','shop_favorites'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', table_name);
    FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', table_name, role_name);
      END IF;
    END LOOP;
  END LOOP;
END $$;
