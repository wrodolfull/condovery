# Elevadoor — checklist de segurança pré-lançamento

Este checklist cobre os projetos Web/API e Android. A verificação do código não
prova a configuração ativa da VPS, do Nginx ou do Supabase.

## 1. Antes de aplicar mudanças

- Fazer backup do Supabase e comprovar uma restauração em homologação.
- Conferir que `DATABASE_URL` usa o **papel proprietário** das tabelas. As
  tabelas de negócio não devem ser consultadas diretamente usando
  `anon`, `authenticated` ou `service_role`.
- Garantir `DATABASE_SSL=true`, `APP_URL=https://elevadoor.pro`,
  `AUTH_RATE_LIMIT_SECRET` estável e privado, e nenhuma credencial em
  `NEXT_PUBLIC_*` ou `EXPO_PUBLIC_*`.
- Não publicar o conteúdo de arquivos `.env`, tokens ou logs de autenticação.

## 2. Migrações e auditoria do Supabase

Executar as migrações em homologação e depois em produção, com backup:

```bash
cd /var/www/condovery
npm run db:migrate
npm run security:preflight
```

A migração `043_data_api_permissions_audit.sql` aplica RLS e revoga permissões
Data API nas tabelas pertencentes ao backend. O comando `security:preflight` é
**somente leitura**: confere HTTPS/TLS, variáveis e privilégios *efetivos*
de todas as tabelas de `public`, incluindo novas tabelas não cobertas pela
lista da migração. Qualquer falha deve ser investigada antes da publicação.
Tabelas fora do catálogo do Elevadoor devem ser revisadas individualmente.

## 3. HTTPS, proxy e controles de borda

```bash
curl -sSI https://elevadoor.pro/
curl -sSI http://elevadoor.pro/
```

Confirmar redirecionamento HTTP -> HTTPS, HSTS em HTTPS e certificado válido
(incluindo subdomínios utilizados). O backend adiciona HSTS na versão de
produção, mas o Nginx também deve proteger as respostas geradas diretamente
pelo proxy. Revisar o repasse do IP real: o rate limit utiliza `x-real-ip`,
que **deve ser sobrescrito pelo proxy confiável**, nunca aceito do cliente.

Adicionar controles de borda para upload, rotas públicas e tentativas
automatizadas; configurar `client_max_body_size` coerente com uploads de até
10 MiB, sem bloquear requisições legítimas. Não ativar CAPTCHA sem testar
acessibilidade, login Google e cadastro no aplicativo.

## 4. Vulnerabilidades e credenciais

```bash
npm audit --omit=dev --audit-level=high
git log --all --oneline -- .env .env.local google-services.json
```

CI executa audit de dependências de produção nos dois repositórios. Configuração
Dependabot abre PRs semanais. O comando git acima é apenas uma triagem de
**nomes de arquivos**: para auditar segredos efetivamente expostos no histórico,
usar secret scanning apropriado em ambiente autorizado; se houver qualquer
exposição, revogar/rotacionar a credencial e tratar o histórico com cuidado.

## 5. Cenários de autorização obrigatórios

Testar com dois usuários e dois condomínios distintos, com permissões reais:
- Morador A não consegue ler/alterar pedidos, imagens, favoritos ou perfil de B.
- Um condomínio não acessa recursos de outro, mesmo alterando IDs e subdomínio.
- Usuário comum não consegue usar rotas administrativas nem de superadmin.
- Sessão móvel revogada, conta suspensa e sessão expirada recebem 401/403.
- Login Google (Web + APK), cadastro, upload e checkout continuam funcionando.
- API não retorna erros SQL nem segredos e usa `Cache-Control: no-store` em JSON privado.

Verificar status do CI, backups, configuração real do Supabase e testes
manuais antes de fazer merge/deploy. Não executar este procedimento
diretamente no banco de produção sem validação prévia.
