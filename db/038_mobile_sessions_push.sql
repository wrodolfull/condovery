-- Native sessions have an explicit audience. Existing cookies remain web-only.
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS client_kind text NOT NULL DEFAULT 'web'
  CHECK (client_kind IN ('web','mobile'));

CREATE TABLE IF NOT EXISTS mobile_oauth_flows (
  token_hash text PRIMARY KEY, challenge text NOT NULL, client_state text NOT NULL,
  pkce_storage jsonb NOT NULL, authorization_url text NOT NULL, condominium_id uuid REFERENCES condominiums(id),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes'
);
CREATE TABLE IF NOT EXISTS mobile_auth_grants (
  token_hash text PRIMARY KEY, challenge text NOT NULL, client_state text NOT NULL,
  auth_user_id uuid NOT NULL, email text NOT NULL, name text NOT NULL,
  condominium_id uuid REFERENCES condominiums(id),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '1 minute'
);
CREATE TABLE IF NOT EXISTS mobile_signup_pending (
  token_hash text PRIMARY KEY, auth_user_id uuid NOT NULL, email text NOT NULL,
  name text NOT NULL, condominium_id uuid REFERENCES condominiums(id),
  expires_at timestamptz NOT NULL DEFAULT now()+interval '15 minutes'
);
CREATE INDEX IF NOT EXISTS idx_mobile_oauth_expiry ON mobile_oauth_flows(expires_at);
CREATE INDEX IF NOT EXISTS idx_mobile_grants_expiry ON mobile_auth_grants(expires_at);
CREATE INDEX IF NOT EXISTS idx_mobile_signup_expiry ON mobile_signup_pending(expires_at);

CREATE TABLE IF NOT EXISTS push_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  condominium boolean NOT NULL DEFAULT true,
  orders boolean NOT NULL DEFAULT true,
  seller_orders boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS push_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  condominium_id uuid NOT NULL REFERENCES condominiums(id),
  session_hash text NOT NULL REFERENCES sessions(token_hash) ON DELETE CASCADE,
  installation_id uuid NOT NULL, expo_token text NOT NULL UNIQUE,
  platform text NOT NULL CHECK(platform IN ('android','ios')),
  disabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(installation_id)
);
CREATE INDEX IF NOT EXISTS idx_push_devices_member ON push_devices(condominium_id,user_id) WHERE disabled=false;
CREATE TABLE IF NOT EXISTS shop_push_subscriptions (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  condominium_id uuid NOT NULL REFERENCES condominiums(id),
  PRIMARY KEY(user_id,shop_id)
);
CREATE TABLE IF NOT EXISTS push_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES users(id), condominium_id uuid NOT NULL REFERENCES condominiums(id),
  shop_id uuid REFERENCES shops(id), client_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(sender_id,client_key)
);
CREATE TABLE IF NOT EXISTS push_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  condominium_id uuid NOT NULL REFERENCES condominiums(id),
  kind text NOT NULL CHECK(kind IN ('condominium','shop','order','seller_order')),
  title text NOT NULL, body text NOT NULL,
  target_id uuid, event_key text NOT NULL,
  read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id,event_key)
);
CREATE INDEX IF NOT EXISTS idx_push_inbox ON push_notifications(user_id,condominium_id,created_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES push_notifications(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES push_devices(id) ON DELETE CASCADE,
  -- Capture binding: an old account's queued notification must never follow a re-bound device.
  session_hash text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','receipt','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(), ticket_id text,
  last_error text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(notification_id,device_id)
);
CREATE INDEX IF NOT EXISTS idx_push_dispatch ON push_deliveries(state,available_at);

-- All access is through the authenticated application backend, including push tokens.
DO $$
DECLARE tab text; r text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['mobile_oauth_flows','mobile_auth_grants','mobile_signup_pending',
    'push_preferences','push_devices','shop_push_subscriptions','push_broadcasts','push_notifications','push_deliveries'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC',tab);
    FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
      IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I',tab,r);
      END IF;
    END LOOP;
  END LOOP;
END $$;
