-- Server-side anti-automation events: never store a raw email or IP.
CREATE TABLE IF NOT EXISTS public.auth_rate_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('login','registration','recovery','invitation','oauth')),
  subject_hash char(64) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS auth_rate_events_lookup_idx
  ON public.auth_rate_events(action,subject_hash,occurred_at DESC);
CREATE INDEX IF NOT EXISTS auth_rate_events_expiration_idx
  ON public.auth_rate_events(occurred_at);
ALTER TABLE public.auth_rate_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_rate_events FROM PUBLIC;
DO $$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      EXECUTE format('REVOKE ALL ON public.auth_rate_events FROM %I',role_name);
    END IF;
  END LOOP;
END $$;

-- Password authentication is provided by Supabase Auth. The old application
-- password hashes are not consulted by any login or recovery handler.
-- Leave the nullable column for backward-compatible INSERTs; destroy hashes.
UPDATE public.users SET password_hash=NULL WHERE password_hash IS NOT NULL;
