-- Additive, safe for previously bootstrapped Condovery databases.
-- All business tables remain in public; Supabase Auth owns auth.users separately.
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_auth_user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_auth_identity_idx
  ON public.users (google_auth_user_id) WHERE google_auth_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.google_oauth_flows (
  token_hash text PRIMARY KEY,
  pkce_storage jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.google_signup_pending (
  token_hash text PRIMARY KEY,
  google_auth_user_id uuid NOT NULL,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS google_signup_pending_exp_idx ON public.google_signup_pending(expires_at);
CREATE INDEX IF NOT EXISTS google_oauth_flows_exp_idx ON public.google_oauth_flows(expires_at);

-- Metadata for private Supabase Storage objects. Existing bytea objects can
-- still be served while older pilots migrate to Storage.
ALTER TABLE public.media_assets ALTER COLUMN bytes DROP NOT NULL;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS storage_key text;
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_storage_key_idx ON public.media_assets(storage_key)
  WHERE storage_key IS NOT NULL;
DO $
BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='media_assets_payload_check') THEN
    ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_payload_check
      CHECK (storage_key IS NOT NULL OR bytes IS NOT NULL);
  END IF;
END $;

-- Indexes aligned with marketplace listing and account workflows.
CREATE INDEX IF NOT EXISTS categories_condo_sort_idx ON public.categories(condominium_id, sort_order, name);
CREATE INDEX IF NOT EXISTS shops_condo_active_idx ON public.shops(condominium_id, is_open, created_at DESC)
  WHERE status='approved';
CREATE INDEX IF NOT EXISTS products_visible_idx ON public.products(condominium_id, created_at DESC)
  WHERE is_available=true;
CREATE INDEX IF NOT EXISTS orders_seller_state_idx ON public.orders(condominium_id,shop_id,status,created_at DESC);

-- Supabase PostgREST (anon/authenticated) is not used for business data.
-- Since this app relies on a privileged server-only PostgreSQL connection,
-- disallow reads/writes through public data APIs. Test locally via regular PG.
DO $$
DECLARE tbl text;
BEGIN
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='auth') THEN
   FOREACH tbl IN ARRAY ARRAY[
    'condominiums','users','sessions','login_attempts','categories',
    'shops','products','media_assets','orders','order_items',
    'google_oauth_flows','google_signup_pending'
   ] LOOP
     EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tbl);
   END LOOP;
 END IF;
END $$;


-- Accelerate case-insensitive substring search in larger condominiums.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON public.products USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS shops_name_trgm_idx
  ON public.shops USING gin(name gin_trgm_ops);
