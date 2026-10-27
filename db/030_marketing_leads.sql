-- Public landing page interest form. Accessible only via backend database credentials.
CREATE TABLE IF NOT EXISTS public.marketing_leads (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name varchar(90) NOT NULL,
 condominium varchar(140) NOT NULL,
 contact varchar(180) NOT NULL,
 role varchar(20) NOT NULL CHECK (role IN ('sindico','administradora','morador','outro')),
 ip_hash char(64) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS marketing_leads_rate_idx ON public.marketing_leads(ip_hash,created_at DESC);
CREATE INDEX IF NOT EXISTS marketing_leads_created_idx ON public.marketing_leads(created_at DESC);
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;
-- No public table policies: only the backend DB role has direct access.
