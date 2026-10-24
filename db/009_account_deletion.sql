-- Self-service removal: close the account and store while retaining anonymized order records.
-- A status of 'deleted' is irreversible from the administration UI.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE public.users ADD CONSTRAINT users_status_check
 CHECK(status IN ('pending','approved','suspended','deleted'));
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_status_check;
ALTER TABLE public.shops ADD CONSTRAINT shops_status_check
 CHECK(status IN ('pending','approved','suspended','deleted'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- External Supabase Auth and Storage deletions are not transactional with PostgreSQL.
-- Retain a durable cleanup job without the resident's name/email/phone.
CREATE TABLE IF NOT EXISTS public.account_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id),
  auth_user_id uuid NOT NULL,
  email_hash text NOT NULL,
  storage_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  auth_done boolean NOT NULL DEFAULT false,
  storage_done boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS account_deletion_jobs_pending_idx
 ON public.account_deletion_jobs(created_at)
 WHERE finished_at IS NULL;
ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;
