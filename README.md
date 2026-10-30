# Elevadoor

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
  Nenhum login usa bcrypt para verificar senhas no banco Elevadoor.
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
   da sua senha no PostgreSQL do Elevadoor.
7. Execute npm run dev.

Os nomes das 23 torres são apenas dados padrão do piloto. Ajuste as torres
reais antes de admitir moradores.

## Escopo da primeira versão

- Login, cadastro, recuperação de senha (Supabase Auth) e login Google;
- Cadastro imediato de moradores e lojas; administração mantém suspensão e reativação;
- Catálogo de alimentação (bolos, pães, refeições, bebidas, lanches, sobremesas e mercadinho), ofertas e busca paginada;
- Favoritos por morador e condomínio;
- Cadastro de lojas, produtos, fotos de origem de até 10 MB, preço, estoque e horário orientativo;
- Carrinho de uma loja por vez, observações e preferências de entrega;
- Registro de pedidos antes do link WhatsApp, com confirmação manual
  do vendedor, conclusão e cancelamento;
- Dashboard administrativo de moradores, lojas e categorias.

Não há gateway de pagamento, disparo automático de WhatsApp, notificações
push ou rastreamento de entrega. Abrir o WhatsApp não comprova pagamento,
envio da mensagem ou confirmação de venda.

## Categorias de alimentação e limite das imagens

As categorias antigas fora de alimentação são desativadas na migração `010_food_only_categories.sql` sem excluir produtos ou históricos de pedidos. Elas não aparecem na vitrine e não podem ser selecionadas em produtos novos. Se já houver produtos vinculados a categorias desativadas, os vendedores poderão movê-los para categorias alimentícias. O administrador pode criar novas categorias de alimentação.

Imagens JPG/PNG/WebP de até 10 MiB são aceitas na seleção. No navegador, fontes acima de 4 MB são reduzidas a WebP antes de atravessar a API (para respeitar o limite de 4,5 MB das Vercel Functions). No servidor, há validação independente de formato/tamanho e conversão para WebP otimizado com até 960 px. No Supabase, mantenha o bucket `condovery-media` privado e confirme os limites global e por bucket.

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
delivery, com componentes e identidade própria do Elevadoor.


## Lojas compartilháveis e avaliações

As lojas podem ser compartilhadas pelo link privado `/?loja=UUID`, que exige
acesso ao condomínio. Compradores de pedidos concluídos podem avaliar de
1 a 5 estrelas com comentário de até 200 caracteres. O vendedor modera
antes da publicação. Consulte [docs/SHOP_REVIEWS.md](docs/SHOP_REVIEWS.md).

## Ativação de loja, fotos e disponibilidade

Um único login permite comprar e vender. A loja exige WhatsApp válido e aceitação das regras de convivência, mas não aprovação administrativa. Produtos têm os estados disponível, indisponível (visível em cinza) e oculto (somente vendedor). A nova gestão inclui fotos de perfil pessoal e da loja. O pedido fica registrado antes do WhatsApp, com opção de reabrir a conversa. Veja [docs/SELLER_ONBOARDING.md](docs/SELLER_ONBOARDING.md).

## Compartilhamento, exclusão de produtos e torres

O botão **Compartilhar loja** abre o compartilhamento nativo em navegadores compatíveis quando a página está em HTTPS (ou localhost no próprio dispositivo). Em acesso por IP da rede local sem HTTPS, o navegador não permite abrir o painel do sistema operacional; nesse caso o Elevadoor oferece um painel alternativo com WhatsApp e cópia do link. Links locais só funcionam dentro da mesma rede: configure um domínio HTTPS para compartilhar com outros moradores.

O dono da loja pode **Excluir produto** pelo editor ou pela lista, com confirmação. A exclusão é lógica: o produto some do catálogo e dos controles do vendedor, não poderá ser comprado novamente e as referências e valores dos pedidos antigos são preservados.

Em **Administração do condomínio → Torres do condomínio**, é possível selecionar **Letras** (A até AD) ou **Números** (1 até 30) e definir de 1 a 30 torres. Os moradores são remapeados pela posição da torre ao trocar os formatos (ex.: Torre 1 → Torre A). Reduções que eliminariam uma torre ocupada são bloqueadas. O script de inicialização usa 30 torres alfabéticas por padrão em condomínios novos e pode ser configurado por `BOOTSTRAP_TOWER_FORMAT` e `BOOTSTRAP_TOWER_COUNT`. Condomínios existentes só mudam ao salvar a configuração no painel administrativo.

**Para instalações atualizadas:** execute `npm run db:migrate` depois do merge para adicionar o campo de exclusão lógica. Não execute `db:bootstrap` para alterar as torres existentes.

## Cadastro imediato e regras

Não há aprovação prévia para moradores ou lojas. Com código do condomínio e autenticação Supabase, moradores podem entrar e vender imediatamente. Lojas aceitam regras de convivência e podem ser denunciadas, ocultadas ou suspensas pela administração. Detalhes em [docs/INSTANT_ACCESS.md](docs/INSTANT_ACCESS.md). Não há detecção automática de imagens inadequadas nesta versão.

## Exclusão da conta

Moradores podem usar **Minha conta → Excluir minha conta** para encerrar o perfil e loja sem perder a integridade do histórico anonimizado de pedidos. Consulte [docs/ACCOUNT_DELETION.md](docs/ACCOUNT_DELETION.md) para operação e limpeza do Supabase Auth.


## Mudança de marca
O nome exibido ao público é **Elevadoor**. Para não invalidar sessões, dados e aplicativos
já instalados, alguns identificadores internos legados continuam usando `condovery`:
cookies, chaves persistidas, bucket privado `condovery-media`, identificadores de aplicativo
e o callback `condovery://auth/callback`. Não renomeie esses identificadores
sem migração e atualização das configurações do Supabase/Expo.
