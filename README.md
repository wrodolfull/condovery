# Condovery

Marketplace **mobile-first** privado para moradores de condomínios. Vitrine
híbrida (produtos, ofertas e lojas), busca, favoritos, carrinho por loja,
entrega/retirada e conclusão da conversa pelo WhatsApp.

## Arquitetura

- **Interface:** Next.js 15 + React 19 + TypeScript, web responsiva e PWA.
- **Backend:** Next.js API Routes (Node), autenticação por sessão opaca HttpOnly,
  isolamento por condomínio, autorização por perfil e rate limiting.
- **Banco:** PostgreSQL do Supabase, acessível exclusivamente no backend.
  Consultas SQL parametrizadas, índices e paginação no servidor.
- **Identidade:** Supabase Auth para cadastro com e-mail/senha,
  **confirmação de e-mail**, login, recuperação de senha e Google OAuth PKCE.
  Nenhum login usa bcrypt para verificar senhas no banco Condovery.
- **Imagens:** Supabase Storage privado. Upload pelo backend; redução para
  WebP (até 960px) e remoção de metadados de imagens.
- **Residência:** código do condomínio, torre/apartamento e Supabase Auth; acesso direto, sem aprovação manual.

## Preparação do ambiente

1. Execute npm install.
2. Copie .env.example para .env.local. Configure as variáveis de conexão
   do PostgreSQL e do Supabase Auth/Storage, além de APP_URL.
3. Configure no painel Supabase os providers Email (com **Confirm email**)
   e Google, redirects, SMTP e o template de reset. Instruções detalhadas:
   [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md).
4. Crie o bucket privado condovery-media.
5. Execute npm run db:migrate para aplicar o SQL base e as migrações.
6. Defina BOOTSTRAP_* no .env.local e execute npm run db:bootstrap.
   O administrador é criado ou identificado no Supabase Auth sem gravação
   da sua senha no PostgreSQL do Condovery.
7. Execute npm run dev.

Os nomes das 23 torres são apenas dados padrão do piloto. Ajuste as torres
reais antes de admitir moradores.

## Escopo da primeira versão

- Login, cadastro, recuperação de senha (Supabase Auth) e login Google;
- Cadastro imediato de moradores e lojas; administração mantém suspensão e reativação;
- Catálogo com categorias, ofertas, produtos e busca paginada;
- Favoritos por morador e condomínio;
- Cadastro de lojas, produtos, fotos, preço, estoque e horário orientativo;
- Carrinho de uma loja por vez, observações e preferências de entrega;
- Registro de pedidos antes do link WhatsApp, com confirmação manual
  do vendedor, conclusão e cancelamento;
- Dashboard administrativo de moradores, lojas e categorias.

Não há gateway de pagamento, disparo automático de WhatsApp, notificações
push ou rastreamento de entrega. Abrir o WhatsApp não comprova pagamento,
envio da mensagem ou confirmação de venda.

## Testes

- npm run typecheck
- npm test
- npm run build

O GitHub Actions executa testes automatizados com PostgreSQL real e um
**stub local isolado de Supabase Auth**, simulando confirmação, login e
recuperação, além de API de pedidos. Testes manuais com Supabase Auth/Google
reais, e-mails e Storage continuam obrigatórios antes da produção.

## Migração de autenticação antiga

O backend anterior armazenava hashes bcrypt locais. Eles são mantidos
somente para uma transição administrada e **não autenticam usuários nesta
versão**. Associe as identidades existentes ao Supabase Auth com confirmação
de e-mail e migração segura de senha. Não faça a implantação em uma base
com contas reais sem plano de migração, backup e testes de reversão.

## Visual

A navegação mobile-first se inspira na organização de aplicativos de
delivery, com componentes e identidade própria do Condovery.


## Lojas compartilháveis e avaliações

As lojas podem ser compartilhadas pelo link privado `/?loja=UUID`, que exige
acesso ao condomínio. Compradores de pedidos concluídos podem avaliar de
1 a 5 estrelas com comentário de até 200 caracteres. O vendedor modera
antes da publicação. Consulte [docs/SHOP_REVIEWS.md](docs/SHOP_REVIEWS.md).

## Ativação de loja, fotos e disponibilidade

Um único login permite comprar e vender. A loja exige WhatsApp válido e aceitação das regras de convivência, mas não aprovação administrativa. Produtos têm os estados disponível, indisponível (visível em cinza) e oculto (somente vendedor). A nova gestão inclui fotos de perfil pessoal e da loja. O pedido fica registrado antes do WhatsApp, com opção de reabrir a conversa. Veja [docs/SELLER_ONBOARDING.md](docs/SELLER_ONBOARDING.md).

## Cadastro imediato e regras

Não há aprovação prévia para moradores ou lojas. Com código do condomínio e autenticação Supabase, moradores podem entrar e vender imediatamente. Lojas aceitam regras de convivência e podem ser denunciadas, ocultadas ou suspensas pela administração. Detalhes em [docs/INSTANT_ACCESS.md](docs/INSTANT_ACCESS.md). Não há detecção automática de imagens inadequadas nesta versão.
