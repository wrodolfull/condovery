import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, transaction } from "@/lib/db";
import { bad } from "@/lib/api-error";
import { inviteHash, tokenHash } from "@/lib/auth";
import {
  limitAuthentication,
  clearAuthenticationFailures,
} from "@/lib/auth-rate-limit";
import {
  emailConfigured,
  googleConfigured,
  googleAuthClient,
  passwordAuthClient,
} from "@/lib/supabase";
import { safeAppOrigin } from "@/lib/security";

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const token = () => randomBytes(32).toString("hex");
const credentials = z.object({
  email: z
    .string()
    .email()
    .max(250)
    .transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1).max(100),
});
type Member = {
  id: string;
  status: string;
  supabase_auth_user_id: string | null;
  condominium_id: string;
};

export async function passwordMember(
  req: NextRequest,
  input: unknown,
  tenantId?: string,
): Promise<Member> {
  if (!emailConfigured()) bad("Login por e-mail não configurado.", 503);
  const b = credentials.parse(input);
  await limitAuthentication(req, "login", b.email);
  const { data, error } = await passwordAuthClient().auth.signInWithPassword({
    email: b.email,
    password: b.password,
  });
  if (error?.status === 429)
    bad("Muitas tentativas. Tente novamente mais tarde.", 429);
  if (error || !data.user?.id || !data.user.email_confirmed_at)
    bad("Credenciais inválidas ou e-mail ainda não confirmado.", 401);
  const member = await identityMember(data.user!.id, b.email, tenantId);
  if (!member)
    bad("Conta sem vínculo com um condomínio. Solicite um convite.", 403);
  await clearAuthenticationFailures("login", b.email);
  return member!;
}
async function identityMember(
  authId: string,
  email: string,
  tenantId?: string,
): Promise<Member | null> {
  const r = await query<Member>(
    "SELECT id,status,supabase_auth_user_id,condominium_id FROM users WHERE supabase_auth_user_id=$1 OR email=$2 LIMIT 1",
    [authId, email],
  );
  const m = r.rows[0];
  if (!m) return null;
  if (m.supabase_auth_user_id && m.supabase_auth_user_id !== authId)
    bad("Esta conta está vinculada a outra identidade.", 403);
  if (m.status !== "approved") bad("Conta indisponível.", 403);
  if (tenantId && m.condominium_id !== tenantId)
    bad("Esta conta pertence a outro condomínio.", 403);
  const active = await query(
    "SELECT 1 FROM condominiums WHERE id=$1 AND is_active=true",
    [m.condominium_id],
  );
  if (!active.rowCount) bad("Condomínio indisponível.", 403);
  if (!m.supabase_auth_user_id)
    await query(
      "UPDATE users SET supabase_auth_user_id=$1 WHERE id=$2 AND supabase_auth_user_id IS NULL",
      [authId, m.id],
    );
  return m;
}
async function nativeSession(id: string) {
  const accessToken = token();
  await query(
    "INSERT INTO sessions(token_hash,user_id,expires_at,client_kind) VALUES($1,$2,now()+interval '14 days','mobile')",
    [tokenHash(accessToken), id],
  );
  return json({
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: 14 * 24 * 60 * 60,
  });
}
// The callback URI is part of the released native app's deep-link scheme.
 // Keep it stable even when the optional environment variable was omitted.
const MOBILE_GOOGLE_CALLBACK = "condovery://auth/callback";
function redirectUri() {
  const configured = process.env.MOBILE_AUTH_REDIRECT_URI || MOBILE_GOOGLE_CALLBACK;
  if (configured !== MOBILE_GOOGLE_CALLBACK)
    bad("Retorno do aplicativo não configurado.", 503);
  return configured;
}
function mobileRedirect(destination: URL) {
  const response = NextResponse.redirect(destination);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set("condovery_mobile_flow", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/mobile/auth/google",
    maxAge: 0,
  });
  return response;
}
const shaChallenge = (value: string) =>
  createHash("sha256").update(value).digest("base64url");
export async function handleMobileAuth(
  req: NextRequest,
  method: string,
  path: string,
  tenantId?: string,
): Promise<NextResponse | null> {
  if (path === "mobile/config" && method === "GET")
    return json({
      version: 1,
      google:
        googleConfigured() &&
        (!process.env.MOBILE_AUTH_REDIRECT_URI ||
          process.env.MOBILE_AUTH_REDIRECT_URI === MOBILE_GOOGLE_CALLBACK),
    });
  if (!path.startsWith("mobile/auth/")) return null;
  if (path === "mobile/auth/login" && method === "POST")
    return nativeSession(
      (await passwordMember(req, await req.json(), tenantId)).id,
    );
  if (path === "mobile/auth/google/start" && method === "POST") {
    if (!googleConfigured()) bad("Login Google indisponível.", 503);
    redirectUri();
    const b = z
      .object({
        challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
        state: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(await req.json());
    await limitAuthentication(req, "oauth", "mobile-start");
    const flow = token();
    const { client, pkceValues } = googleAuthClient();
    const callback = safeAppOrigin(req) + "/api/mobile/auth/google/callback";
    const { data, error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback, skipBrowserRedirect: true },
    });
    if (error || !data.url) bad("Não foi possível iniciar o Google.", 502);
    await query(
      "INSERT INTO mobile_oauth_flows(token_hash,challenge,client_state,pkce_storage,authorization_url,condominium_id) VALUES($1,$2,$3,$4::jsonb,$5,$6)",
      [
        tokenHash(flow),
        b.challenge,
        b.state,
        JSON.stringify(Object.fromEntries(pkceValues)),
        data.url,
        tenantId ?? null,
      ],
    );
    return json({
      url: safeAppOrigin(req) + "/api/mobile/auth/google/open?flow=" + flow,
    });
  }
  if (path === "mobile/auth/google/open" && method === "GET") {
    const flow = req.nextUrl.searchParams.get("flow");
    if (!flow || !/^[a-f0-9]{64}$/.test(flow)) bad("Acesso expirado.", 401);
    const r = await query(
      "SELECT authorization_url FROM mobile_oauth_flows WHERE token_hash=$1 AND expires_at>now()",
      [tokenHash(flow!)],
    );
    if (!r.rowCount) bad("Acesso expirado.", 401);
    const response = NextResponse.redirect(r.rows[0].authorization_url);
    response.cookies.set("condovery_mobile_flow", flow!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/mobile/auth/google",
      maxAge: 600,
    });
    return response;
  }
  if (path === "mobile/auth/google/callback" && method === "GET") {
    const destination = new URL(redirectUri());
    const flow = req.cookies.get("condovery_mobile_flow")?.value;
    const code = req.nextUrl.searchParams.get("code");
    const r =
      flow && /^[a-f0-9]{64}$/.test(flow)
        ? await query(
            "DELETE FROM mobile_oauth_flows WHERE token_hash=$1 AND expires_at>now() RETURNING *",
            [tokenHash(flow)],
          )
        : null;
    const saved = r?.rows[0];
    if (saved) destination.searchParams.set("state", saved.client_state);
    if (!saved || !code) {
      destination.searchParams.set("error", "expired");
      return mobileRedirect(destination);
    }
    const { client } = googleAuthClient(saved.pkce_storage);
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    const user = data.user;
    if (
      error ||
      !user?.email_confirmed_at ||
      !user.email ||
      !user.identities?.some((i) => i.provider === "google")
    ) {
      destination.searchParams.set("error", "google_failed");
      return mobileRedirect(destination);
    }
    const grant = token();
    await query(
      "INSERT INTO mobile_auth_grants(token_hash,challenge,client_state,auth_user_id,email,name,condominium_id) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        tokenHash(grant),
        saved.challenge,
        saved.client_state,
        user.id,
        user.email.trim().toLowerCase(),
        String(user.user_metadata?.full_name ?? "").slice(0, 90),
        saved.condominium_id,
      ],
    );
    destination.searchParams.set("code", grant);
    return mobileRedirect(destination);
  }
  if (path === "mobile/auth/google/exchange" && method === "POST") {
    const b = z
      .object({
        code: z.string().regex(/^[a-f0-9]{64}$/),
        verifier: z.string().regex(/^[a-f0-9]{64}$/),
        state: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .parse(await req.json());
    await limitAuthentication(req, "oauth", "mobile-exchange");
    const r = await query(
      "DELETE FROM mobile_auth_grants WHERE token_hash=$1 AND challenge=$2 AND client_state=$3 AND expires_at>now() RETURNING *",
      [tokenHash(b.code), shaChallenge(b.verifier), b.state],
    );
    if (!r.rowCount) bad("Acesso expirado. Entre novamente.", 401);
    const g = r.rows[0];
    if (tenantId && g.condominium_id && g.condominium_id !== tenantId)
      bad("Condomínio inválido.", 403);
    const member = await identityMember(
      g.auth_user_id,
      g.email,
      tenantId ?? g.condominium_id ?? undefined,
    );
    if (member) return nativeSession(member.id);
    const pending = token();
    await query(
      "INSERT INTO mobile_signup_pending(token_hash,auth_user_id,email,name,condominium_id) VALUES($1,$2,$3,$4,$5)",
      [tokenHash(pending), g.auth_user_id, g.email, g.name, g.condominium_id],
    );
    return json({
      registration_required: true,
      signup_token: pending,
      email: g.email,
      name: g.name,
    });
  }
  if (path === "mobile/auth/register-google" && method === "POST") {
    const b = z
      .object({
        signup_token: z.string().regex(/^[a-f0-9]{64}$/),
        invite: z.string().min(10).max(150),
        name: z.string().trim().min(2).max(90),
        phone: z.string().min(10).max(20),
        tower: z.string().min(1).max(60),
        apartment: z.string().min(1).max(24),
      })
      .parse(await req.json());
    await limitAuthentication(req, "registration", tokenHash(b.signup_token));
    const id = await transaction(async (tx) => {
      const pending = await tx.query(
        "SELECT * FROM mobile_signup_pending WHERE token_hash=$1 AND expires_at>now() FOR UPDATE",
        [tokenHash(b.signup_token)],
      );
      if (!pending.rowCount)
        bad("Cadastro expirado. Entre novamente com Google.", 401);
      const p = pending.rows[0];
      const deleting = await tx.query(
        "SELECT 1 FROM account_deletion_jobs WHERE email_hash=$1 AND finished_at IS NULL",
        [tokenHash(p.email)],
      );
      if (deleting.rowCount)
        bad("A exclusão anterior ainda está em processamento.", 409);
      const condo = await tx.query(
        "SELECT id,towers FROM condominiums WHERE invite_code_hash=$1 AND is_active=true",
        [inviteHash(b.invite)],
      );
      const c = condo.rows[0];
      if (!c) bad("Código de convite inválido.");
      if (
        (p.condominium_id && p.condominium_id !== c.id) ||
        (tenantId && tenantId !== c.id)
      )
        bad("Código de outro condomínio.", 403);
      if (!c.towers.includes(b.tower)) bad("Torre inválida.");
      const created = await tx.query(
        "INSERT INTO users(condominium_id,name,email,phone,password_hash,supabase_auth_user_id,google_auth_user_id,tower,apartment,status) VALUES($1,$2,$3,$4,NULL,$5,$5,$6,$7,'approved') ON CONFLICT(email) DO NOTHING RETURNING id",
        [c.id, b.name, p.email, b.phone, p.auth_user_id, b.tower, b.apartment],
      );
      if (!created.rowCount) bad("E-mail já cadastrado. Faça login.", 409);
      await tx.query("DELETE FROM mobile_signup_pending WHERE token_hash=$1", [
        tokenHash(b.signup_token),
      ]);
      return created.rows[0].id as string;
    });
    return nativeSession(id);
  }
  return null;
}
