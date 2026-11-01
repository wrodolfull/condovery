/**
 * Read-only pre-launch security checks: configuration and effective database
 * privileges. Never prints credential values, connection URLs or personal data.
 * Usage: npm run security:preflight
 */
import pg from 'pg';

let failures = 0;
const fail = (message) => { failures++; console.error('FALHA: ' + message); };
const ok = (message) => console.log('OK: ' + message);

const required = [
  'APP_URL','DATABASE_URL','SUPABASE_URL','SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY','AUTH_RATE_LIMIT_SECRET'
];
for (const key of required) {
  if (!process.env[key]) fail('Variável obrigatória ausente: ' + key);
}
function httpsUrl(name) {
  if (!process.env[name]) return;
  try {
    if (new URL(process.env[name]).protocol !== 'https:') fail(name + ' precisa usar HTTPS');
    else ok(name + ' usa HTTPS');
  } catch { fail(name + ' não é uma URL válida'); }
}
httpsUrl('APP_URL');
httpsUrl('SUPABASE_URL');
if (process.env.DATABASE_SSL !== 'true') fail('DATABASE_SSL deve ser true para verificar TLS do PostgreSQL');
else ok('TLS do PostgreSQL habilitado');
const secret = process.env.AUTH_RATE_LIMIT_SECRET || '';
if (Buffer.byteLength(secret, 'utf8') < 32 || secret.startsWith('replace-with-')) {
  fail('AUTH_RATE_LIMIT_SECRET precisa conter pelo menos 32 bytes aleatórios privados');
} else ok('Segredo de rate limit está configurado (entropia não verificada)');
for (const name of Object.keys(process.env)) {
  if (/^(NEXT_PUBLIC_|EXPO_PUBLIC_)/.test(name) &&
      /(DATABASE_URL|SERVICE_ROLE|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN)/i.test(name)) {
    fail('Variável potencialmente sensível exposta ao bundle: ' + name);
  }
}

if (process.env.DATABASE_URL) {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
    connectionTimeoutMillis: 5000
  });
  try {
    await client.connect();
    // Inspect effective grants, including privileges inherited via PUBLIC.
    // All tables in public are application-owned; intentional exceptions
    // must be reviewed rather than silently ignored.
    const { rows } = await client.query(`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
        EXISTS (
          SELECT 1 FROM pg_roles r
          WHERE r.rolname IN ('anon','authenticated','service_role')
            AND (
              has_table_privilege(r.oid,c.oid,'SELECT') OR
              has_table_privilege(r.oid,c.oid,'INSERT') OR
              has_table_privilege(r.oid,c.oid,'UPDATE') OR
              has_table_privilege(r.oid,c.oid,'DELETE')
            )
        ) AS exposed
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind IN ('r','p')
      ORDER BY c.relname
    `);
    if (!rows.length) fail('Nenhuma tabela encontrada em public; confira o projeto Supabase');
    for (const table of rows) {
      if (!table.rls_enabled) fail('RLS desabilitado: public.' + table.table_name);
      if (table.exposed) fail('Permissão Data API ativa: public.' + table.table_name);
    }
    if (rows.length) ok(rows.length + ' tabelas verificadas quanto a RLS e permissões efetivas');
  } catch {
    fail('Não foi possível auditar o PostgreSQL; confira conectividade, credenciais e certificado TLS');
  } finally {
    await client.end().catch(() => {});
  }
}

if (failures) {
  console.error('Preflight: ' + failures + ' problema(s). Nenhuma configuração foi alterada.');
  process.exitCode = 1;
} else {
  console.log('Preflight sem problemas detectados. Não substitui testes de invasão ou auditoria do proxy.');
}
