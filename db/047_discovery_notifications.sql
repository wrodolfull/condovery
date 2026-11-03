-- 047: Opt-in neighborhood discovery campaigns. Existing members stay opted out.
ALTER TABLE public.push_preferences
  ADD COLUMN IF NOT EXISTS discovery boolean NOT NULL DEFAULT false;

-- Marketing notifications are separate from transactions and community alerts.
ALTER TABLE public.push_notifications DROP CONSTRAINT IF EXISTS push_notifications_kind_check;
ALTER TABLE public.push_notifications ADD CONSTRAINT push_notifications_kind_check
  CHECK (kind IN (
    'condominium','shop','order','seller_order','seller_review',
    'seller_reminder','review_update',
    'discovery_shop','discovery_products','discovery_sunday'
  ));

-- Rules start disabled until a platform admin intentionally enables them.
CREATE TABLE IF NOT EXISTS public.discovery_campaign_rules (
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  campaign text NOT NULL CHECK(campaign IN ('new_shop','new_products','sunday_food')),
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(condominium_id,campaign)
);

-- Durable frequency cap: survives inbox deletion, device changes and reinstall.
-- One record per message recipient and campaign event; never store a device token here.
CREATE TABLE IF NOT EXISTS public.discovery_delivery_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id) ON DELETE CASCADE,
  campaign text NOT NULL CHECK(campaign IN ('new_shop','new_products','sunday_food')),
  event_key text NOT NULL,
  variant smallint NOT NULL CHECK(variant IN (0,1)),
  notification_id uuid REFERENCES public.push_notifications(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,event_key)
);
CREATE INDEX IF NOT EXISTS idx_discovery_history_user_time
  ON public.discovery_delivery_history(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discovery_history_tenant_event
  ON public.discovery_delivery_history(condominium_id,event_key);

-- Only the authenticated server backend can read or alter these tables.
DO $$
DECLARE tab text; r text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['discovery_campaign_rules','discovery_delivery_history'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',tab);
    FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',tab,r);
      END IF;
    END LOOP;
  END LOOP;
END $$;
