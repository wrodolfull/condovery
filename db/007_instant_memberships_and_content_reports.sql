-- Switch from pre-approval to immediate access after condominium code + identity verification.
-- Suspended users/shops remain suspended. Existing pending records become active.
ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'approved';
ALTER TABLE public.shops ALTER COLUMN status SET DEFAULT 'approved';
UPDATE public.users SET status='approved' WHERE status='pending';
UPDATE public.shops SET status='approved' WHERE status='pending';
-- Permanent codes are provided by condominium administration, never generated.
CREATE UNIQUE INDEX IF NOT EXISTS condos_unique_invite_hash_idx
 ON public.condominiums(invite_code_hash);
-- Collect public reports; administrator reviews them AFTER publication.
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  condominium_id uuid NOT NULL REFERENCES public.condominiums(id),
  reporter_id uuid NOT NULL REFERENCES public.users(id),
  target_type text NOT NULL CHECK(target_type IN ('shop','product')),
  target_id uuid NOT NULL,
  reason text NOT NULL CHECK(reason IN ('language','image','inappropriate','other')),
  details text NOT NULL DEFAULT '' CHECK(char_length(details)<=250),
  status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id),
  UNIQUE(condominium_id,reporter_id,target_type,target_id)
);
CREATE INDEX IF NOT EXISTS content_reports_moderator_queue_idx
  ON public.content_reports(condominium_id,status,created_at DESC);
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- A product hidden after a confirmed complaint cannot be republished by the seller until cleared.
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS moderation_blocked boolean NOT NULL DEFAULT false;
