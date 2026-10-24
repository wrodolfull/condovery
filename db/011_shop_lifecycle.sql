-- Keep historical shops and their orders while allowing a seller to start over.
-- No destructive removal of referenced shop/order rows.
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_owner_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS shops_one_current_per_owner_idx
 ON public.shops(owner_id) WHERE status <> 'deleted';

-- Persist external Storage cleanup so failed deletions can be retried.
CREATE TABLE IF NOT EXISTS public.shop_deletion_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id),
  storage_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  storage_done boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS shop_deletion_jobs_pending_idx
 ON public.shop_deletion_jobs(created_at) WHERE finished_at IS NULL;
ALTER TABLE public.shop_deletion_jobs ENABLE ROW LEVEL SECURITY;
