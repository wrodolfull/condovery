-- Backend-owned business tables never require direct Supabase Data API access.
-- Revocation protects projects with permissive public-schema defaults.
-- The connection used by DATABASE_URL must be the owning database role.
DO $$
DECLARE tab_name text;
DECLARE role_name text;
BEGIN
  FOREACH tab_name IN ARRAY ARRAY[
    'condominiums','users','sessions','login_attempts','categories','shops',
    'products','media_assets','orders','order_items','favorites',
    'google_oauth_flows','google_signup_pending','password_reset_tokens',
    'password_reset_attempts','content_reports','shop_reviews',
    'account_deletion_jobs','shop_deletion_jobs','platform_admins',
    'advertising_campaigns','ads_settings','ad_metric_daily','ad_metric_dedupe',
    'giveaway_items','marketing_leads'
  ] LOOP
    IF to_regclass('public.' || tab_name) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC',tab_name);
      FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
          EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I',tab_name,role_name);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;
