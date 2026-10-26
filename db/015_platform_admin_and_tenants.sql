-- Platform-level access is independent from ordinary condominium admin role.
-- All mutations remain server-side; never trust selected condominium from the browser.
CREATE TABLE IF NOT EXISTS platform_admins (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS active_condominium_id uuid REFERENCES condominiums(id);
CREATE INDEX IF NOT EXISTS idx_sessions_active_condo ON sessions(active_condominium_id);
-- Optional per-tenant hostname. DNS/TLS must be configured separately by deployment.
ALTER TABLE condominiums ADD COLUMN IF NOT EXISTS custom_domain text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_condominiums_custom_domain
  ON condominiums(lower(custom_domain)) WHERE custom_domain IS NOT NULL;
