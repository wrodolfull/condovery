-- Unify email/password and Google identities in Supabase Auth.
-- Existing local records and orders remain intact; old password hashes are
-- NOT accepted by the application after this migration. Migrate users via
-- Supabase Auth invitation/reset; do not silently import credentials.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS supabase_auth_user_id uuid;
UPDATE public.users SET supabase_auth_user_id=google_auth_user_id
 WHERE supabase_auth_user_id IS NULL AND google_auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_supabase_auth_id_uidx
 ON public.users(supabase_auth_user_id) WHERE supabase_auth_user_id IS NOT NULL;

-- All new users are inserted with password_hash NULL. Existing hashes are
-- retained for reversible migration only; application code never reads them.
-- Purge legacy hashes after any existing accounts have been migrated.

-- Supabase generates the reset email/link/token. The table below stores only
-- a one-time short-lived *application reset ticket* issued after verifyOtp().
-- Old tickets must be cleared because they belonged to the legacy mail flow.
DELETE FROM public.password_reset_tokens;

-- Protect any pending flows through the server's dedicated database session.
