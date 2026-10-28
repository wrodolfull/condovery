# Condovery — autenticação e proteção de dados

## O que já era seguro
- A identidade/senha de novos cadastros pertence a Supabase Auth. A aplicação
  não grava nem lê senha do morador no PostgreSQL; a coluna legada \`password_hash\`
  é mantida para compatibilidade das operações existentes.
- Sessões próprias usam token aleatório de 256 bits armazenado exclusivamente
  como digest SHA-256. Cookie: HttpOnly + SameSite=Lax + Secure em produção.
- Rotas internas exigem sessão; operações administrativas verificam escopo,
  papel e condomínio no servidor (não confiam em campos do frontend).
- Banco e Storage são usados no backend; grants e RLS devem ser auditados
  no ambiente real após migrações.

## O que muda com a migração 034
- Apaga definitivamente hashes locais de senhas, que não eram mais usados
  (os usuários devem entrar via Supabase Auth). NÃO remove usuários.
- Implementa controle transacional de tentativas com advisory locks PostgreSQL
  para login, cadastro, recuperação, validação de convite e início do OAuth.
- Os identificadores guardados em auth_rate_events são HMAC-SHA256 com segredo
  do servidor, nunca e-mail/IP em texto. Convites e OAuth são limitados
  por origem para não bloquear vizinhos que compartilham um código.
- Respostas de recuperação de senha permanecem genéricas mesmo após limite.
- Operações mutáveis via API verificam Origin e Fetch Metadata; solicitações
  entre sites e entre subdomínios sem Origin são rejeitadas.
- Sessões suspensas/pendentes não podem acessar recursos de negócio.
- Cabeçalhos HTTP contra framing, MIME sniffing e acesso a sensores.

## ANTES do merge/deploy
1. Faça backup do banco e valide em homologação.
2. Gere 32 bytes aleatórios e armazene como variável de ambiente privada:
   \`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"\`
   Use o resultado como \`AUTH_RATE_LIMIT_SECRET\` (64 caracteres em hex).
3. Configure a MESMA chave estável em todas as instâncias do Next.js.
   Não publique em NEXT_PUBLIC_*, HTML, logs, CI público ou repositório.
4. Implemente rate limiting também na borda (WAF/CDN/proxy) e configure o
   proxy para sobrescrever x-real-ip. Cabeçalhos de origem e IP de cliente
   não substituem os limites de identidade.
5. Execute \`npm run db:migrate\` ANTES de subir o código novo.
   **Sem a variável AUTH_RATE_LIMIT_SECRET, as rotas de autenticação
   falharão fechadas (500 genérico); configure ANTES da implantação.**
6. Agende \`npm run cleanup:auth-security\` diariamente (eventos >48h).
7. Verifique as políticas reais de senha, MFA, recovery, limites SMTP e
   verificação de e-mail no painel Supabase Auth. Recomenda-se MFA
   obrigatório para superadministradores e administradores.
8. Configure HTTPS + TLS do PostgreSQL, secrets fora de Git, logs sem PII,
   backups cifrados e restauração testada.

## Criptografia de dados pessoais: NÃO ativa nesta PR
Nome, e-mail, telefone, torre/apartamento e dados de pedidos ainda aparecem
em colunas comuns de negócio. RLS, TLS e criptografia de disco gerenciada
não equivalem a criptografia de aplicação ponta a ponta.
Criptografar essas colunas abruptamente quebraria login, busca, filtros de
moradores, chaves únicas, carrinho, pedidos e WhatsApp.

Etapas seguras para uma PR específica de dados pessoais:
1. Inventariar cada campo e seus usos (telefone, endereços, nomes, e-mail,
   conteúdo do pedido e exportações), decidir retenção e minimização LGPD.
2. Definir criptografia de aplicação AES-256-GCM com IV não reutilizado, dados
   autenticados e envelope de chaves versionado, armazenado fora do banco
   em KMS/Vault. Não usar a chave de limitação de tentativas para criptografia.
3. Projetar índices cegos com HMAC para buscas exatas necessárias e manter
   somente projeções minimizadas no restante do sistema.
4. Fazer migração gradual dual-read/dual-write com verificação do backfill,
   testes de recuperação/rotação e rollback comprovado em homologação.
5. Restringir quem pode desencriptar dados, auditar acesso e expurgar
   cópias antigas em backups segundo política.

Nenhuma implementação proporciona garantia absoluta de segurança. Revisão
de permissões do Supabase e pentest em homologação são necessários.
