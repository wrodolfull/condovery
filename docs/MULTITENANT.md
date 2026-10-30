# Elevadoor multi-tenant — etapa 1

## Modelo implementado

Todos os condomínios usam a mesma aplicação Next.js e o mesmo PostgreSQL Supabase.
Moradores, lojas, produtos, pedidos e categorias continuam vinculados a `condominium_id`.

O login `BOOTSTRAP_ADMIN_EMAIL` existente é promovido a superadmin por `npm run db:bootstrap` **depois** da migração. Não é criada uma segunda conta e o script não altera a senha de uma conta Supabase já existente. A autorização global pertence a `platform_admins`, não à coluna `users.role`.

O painel **Conta → Painel Superadmin** permite listar/criar condomínios, escolher o condomínio ativo e criar administradores locais. A troca atualiza `sessions.active_condominium_id` no backend. A sessão do superadmin passa a consultar o `condominium_id` selecionado sem alterar sua identidade. Usuários comuns e administradores locais não conseguem usar essas rotas.

O superadmin configura: nome, identificador (`slug`), código de acesso, torres (letras ou números até 30), e opcionalmente domínio desejado. Categorias padrão são criadas por condomínio.

O superadmin cria uma conta de administrador local com e-mail e senha inicial de no mínimo 12 caracteres via Supabase Auth. Por enquanto a senha inicial precisa ser compartilhada por canal seguro. Um endereço de e-mail só pode existir em um condomínio (limitação atual da tabela `users`).

## O que ainda falta (NÃO considerar pronto para venda multi-domínio)

1. `custom_domain` apenas cadastra um nome de domínio, **não** configura DNS, TLS, certificados ou resolve automaticamente o condomínio pelo cabeçalho Host.
2. Precisamos implantar roteamento de domínio/subdomínio e URL `/c/<condominio>/loja/<loja>`, com resolução de tenant **no servidor**, proteção de Host confiável, verificação de propriedade do domínio e proteção de sessão em domínios diferentes.
3. Cadastro/login e fluxo de convites precisam ser adaptados a cada domínio e múltiplos vínculos por usuário (`condominium_memberships`).
4. Implementar convites por e-mail e configuração de senha inicial, auditoria de trocas de tenant e testes de isolamento por múltiplos condomínios para cada rota.
5. Testes com domínio real somente depois da configuração do proxy HTTPS e dos registros DNS.

## Aplicação local

1. Fazer merge da PR e `git pull origin main`.
2. Configurar certificado `NODE_EXTRA_CA_CERTS` no PowerShell.
3. Executar `npm run db:migrate`.
4. Executar `npm run db:bootstrap` para conceder acesso global ao administrador configurado no `.env.local`.
5. Executar `npm run dev`, acessar a conta principal e o **Painel Superadmin**.

**Não** executar scripts de migração de domínios em produção antes de confirmar quais nomes de host serão usados e como o reverse proxy direcionará os pedidos.
