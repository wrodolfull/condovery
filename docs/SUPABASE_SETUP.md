# Supabase setup (backend-only)

Condovery uses **Supabase PostgreSQL as its database** and Supabase Auth for
**Google identity verification**. All application records flow through the
Next.js API server; the browser has no Supabase DB credentials, client or
PostgREST calls. Custom password sign-in is retained for existing residents;
Google Auth validates identity through Supabase and then issues Condovery's
own HttpOnly session, subject to condominium approval.

## Steps in Supabase Dashboard

1. Create a Supabase project in your chosen region (Brazil if available and
   appropriate to your data policy). In **Connect**, copy the actual connection
   string; do not invent the pooler host. For an always-on Node backend, use
   **Session Pooler** (5432) on IPv4-only hosts, or Direct for IPv6.
   For serverless, use the **Transaction Pooler** (6543), with a small client
   pool. Set DATABASE_SSL=true. Set DATABASE_POOL_MAX=1 on serverless.
2. Add DATABASE_URL, DATABASE_SSL and DATABASE_POOL_MAX to the **server**
   environment. Never expose the DB password on the frontend.
3. Add SUPABASE_URL and SUPABASE_ANON_KEY in the server environment only.
   Enable **Google** in Authentication > Providers and provide Google OAuth
   Client ID and secret from Google Cloud Console.
4. In Google Cloud OAuth configuration, register the Supabase callback URL:
   https://YOUR_PROJECT.supabase.co/auth/v1/callback
   Add the appropriate authorized JavaScript origins for your deployment.
5. In Supabase Auth > URL Configuration, whitelist the exact Condovery app
   callback: https://YOUR_DOMAIN/api/auth/google/callback
   (and http://localhost:3000/api/auth/google/callback only for development).
   Set APP_URL=https://YOUR_DOMAIN for production.
6. In Storage, create a PRIVATE bucket named \`condovery-media\`. Add the
   SUPABASE_SERVICE_ROLE_KEY to the server environment ONLY, never
   NEXT_PUBLIC_*. No public bucket and no browser file upload bypass.
7. Run \`npm run db:migrate\`, then \`npm run db:bootstrap\`, in an authorized
   deployment environment. For preexisting databases, the additive migration
   \`db/002_supabase_google_storage.sql\` preserves residents/orders.
8. Verify both password and Google login, request approval, product upload,
   seller approval, WhatsApp hand-off and delivery instructions from an
   Android and an iPhone before enabling your condominium pilot.

## Security notes

- RLS is enabled on business tables on Supabase projects (the API uses the
  database connection as a trusted backend). Use a dedicated restricted DB
  role when production hardening; do not grant \`anon\` or
  \`authenticated\` PostgREST CRUD permissions.
- Google identity never automatically approves condominium membership.
  New Google accounts need an invitation and admin approval.
- Images are stored in private Storage, served by authorized
  \`/api/media/:id\` handlers; no service keys or object paths are returned.
- Never copy service role, DB password, Google Client Secret or invitation
  into commits or browser-readable variables.
- For password reset via email, an SMTP mail service and recovery flow still
  need to be configured prior to public launch.
- Maintain LGPD notices, backups, rate limiting, abuse controls and routine
  vulnerability scans. A passing CI run does not replace security QA.
