# Segurança do Supabase e operação de ADS

## Migração de segurança
A migração 032 habilita RLS e revoga acesso a todas as tabelas de negócio do
Condovery em public para PUBLIC, anon, authenticated e service_role.
O backend utiliza a conexão PostgreSQL com o papel proprietário das tabelas
(normalmente postgres). Supabase Auth e Storage operam em outros schemas.
**Faça backup e teste em homologação antes de aplicar em produção.**

Auditoria no SQL Editor:
```sql
SELECT schemaname,tablename,rowsecurity FROM pg_tables
WHERE schemaname='public' ORDER BY tablename;
SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('anon','authenticated','service_role')
ORDER BY table_name,grantee;
```
Valide também privilégios efetivos, DEFAULT PRIVILEGES e acesso direto a
tabelas futuras. Não habilite policies públicas para contornar erros no frontend.

## ADS e faturamento
As métricas de impressões e cliques contam uma sessão autenticada uma vez por
campanha e dia UTC (alcance único diário aproximado, não visualizações totais).
A impressão requer 50% do card visível em navegadores com IntersectionObserver.
Não são salvos user_id, IP nem cookies: somente hash irreversível diário do
token. Remova os hashes após 30 dias usando tarefa diária:
```sh
node --env-file=.env.local scripts/cleanup-ad-metrics.mjs
```
Valores de contrato e status (pendente/faturado/pago) são registrados
**manualmente**, não constituem cobrança processada nem conciliação financeira.
O parceiro comercial é referência em texto; não concede permissões ou comissões.
Os relatórios são exclusivos do superadmin.

## Listagens administrativas
GET /api/admin/directory aceita kind=users|shops, page, search, status e tower
(para moradores), com 25 resultados por página. /api/admin/directory/export
gera CSV com os mesmos filtros (máximo 5.000 registros), escapando fórmulas.
Os dados exportados são pessoais e devem ser tratados adequadamente.
