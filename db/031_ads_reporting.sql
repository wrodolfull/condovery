-- Advertising commercial tracking and privacy-preserving daily statistics.
-- No buyer identity, IP address, session token or WhatsApp number is recorded.
ALTER TABLE public.advertising_campaigns
  ADD COLUMN IF NOT EXISTS contract_amount_cents integer NOT NULL DEFAULT 0
    CHECK (contract_amount_cents >= 0 AND contract_amount_cents <= 2147483647);
ALTER TABLE public.advertising_campaigns
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'pending'
    CHECK (billing_status IN ('pending','invoiced','paid'));
ALTER TABLE public.advertising_campaigns
  ADD COLUMN IF NOT EXISTS commercial_partner text NOT NULL DEFAULT ''
    CHECK (length(commercial_partner) <= 120);

CREATE TABLE IF NOT EXISTS public.ad_metric_daily (
  campaign_id uuid NOT NULL REFERENCES public.advertising_campaigns(id) ON DELETE CASCADE,
  day date NOT NULL,
  impressions integer NOT NULL DEFAULT 0 CHECK(impressions >= 0),
  clicks integer NOT NULL DEFAULT 0 CHECK(clicks >= 0),
  PRIMARY KEY (campaign_id,day)
);
CREATE TABLE IF NOT EXISTS public.ad_metric_dedupe (
  campaign_id uuid NOT NULL REFERENCES public.advertising_campaigns(id) ON DELETE CASCADE,
  day date NOT NULL,
  event_type text NOT NULL CHECK(event_type IN ('impression','click')),
  viewer_hash char(64) NOT NULL,
  PRIMARY KEY (campaign_id,day,event_type,viewer_hash)
);
CREATE INDEX IF NOT EXISTS ad_metric_dedupe_day_idx ON public.ad_metric_dedupe(day);
