-- Revocable, expiring report links for individual advertising campaigns.
-- Only SHA-256 token digests are stored; raw bearer tokens never reach PostgreSQL.
CREATE TABLE IF NOT EXISTS public.ad_report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.advertising_campaigns(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CONSTRAINT ad_report_shares_expiry_check CHECK (expires_at > created_at)
);
CREATE INDEX IF NOT EXISTS ad_report_shares_campaign_created_idx
  ON public.ad_report_shares(campaign_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ad_report_shares_expiry_idx
  ON public.ad_report_shares(expires_at) WHERE revoked_at IS NULL;
ALTER TABLE public.ad_report_shares ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_report_shares FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON public.ad_report_shares FROM %I',role_name);
    END IF;
  END LOOP;
END $$;
