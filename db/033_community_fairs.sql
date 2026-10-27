-- Thematic fairs reuse shop products and the existing checkout.
CREATE TABLE IF NOT EXISTS public.community_fairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id),
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 600),
  cover_image_url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (cover_image_url IS NULL OR cover_image_url ~ '^/api/media/[0-9a-fA-F-]{36}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS community_fairs_id_condominium_uidx
  ON public.community_fairs(id,condominium_id);
CREATE INDEX IF NOT EXISTS community_fairs_active_idx
  ON public.community_fairs(condominium_id,starts_at,ends_at) WHERE published=true;
CREATE UNIQUE INDEX IF NOT EXISTS products_id_condominium_for_fair_uidx
  ON public.products(id,condominium_id);
CREATE TABLE IF NOT EXISTS public.community_fair_products (
  fair_id uuid NOT NULL,
  condominium_id uuid NOT NULL,
  product_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending','approved','rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  PRIMARY KEY(fair_id,product_id),
  FOREIGN KEY(fair_id,condominium_id)
    REFERENCES public.community_fairs(id,condominium_id) ON DELETE CASCADE,
  FOREIGN KEY(product_id,condominium_id)
    REFERENCES public.products(id,condominium_id)
);
CREATE INDEX IF NOT EXISTS community_fair_products_review_idx
  ON public.community_fair_products(condominium_id,fair_id,status,submitted_at DESC);
-- Tables are server-only, consistent with the Condovery Data API lockdown.
ALTER TABLE public.community_fairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_fair_products ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.community_fairs,public.community_fair_products FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON public.community_fairs, public.community_fair_products FROM %I',role_name);
    END IF;
  END LOOP;
END $$;
