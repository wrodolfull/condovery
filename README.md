# Condovery

Marketplace privado e **mobile-first** para moradores. A experiência combina vitrine híbrida (categorias, produtos, ofertas e lojas), pedido com instruções de entrega e envio manual por WhatsApp.

## Stack
Next.js 15 / React 19 / TypeScript / PostgreSQL (todas as consultas passam pelo backend) / autenticação por cookie de sessão HttpOnly e bcrypt / PWA.

## Inicialização
1. npm install
2. Crie uma base PostgreSQL 15+ e copie .env.example para .env.local; preencha DATABASE_URL.
3. Execute psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/schema.sql
4. Exporte as variáveis BOOTSTRAP_* do .env.example no terminal e execute npm run db:bootstrap. O comando inicializa condomínio, 23 torres e administrador. Não exponha o convite publicamente.
5. npm run dev e abra http://localhost:3000

Importante: o script de bootstrap não altera a senha de um administrador já existente. Modifique as torres pelo banco para corresponder à numeração real antes de abrir o cadastro.

## O que está implementado
- Cadastro com convite e aprovação administrativa; login; sessão segura; recuperação de acesso deve ser feita pelo administrador nesta versão (não há fluxo de e-mail).
- Isolamento de dados por condominium_id, inclusive em endpoints de administração e imagens.
- Marketplace privado, categorias, pesquisa, lojas e catálogo com preços e promoções.
- Solicitação de loja e aprovação; CRUD de produtos com upload de foto (limite de 1,5 MB por arquivo), horários/prazo orientativos e estoque opcional.
- Carrinho de uma loja por vez; endereço torre/apartamento do usuário; retirada ou entrega; preferências e observações.
- Criação de pedido no backend antes de abrir WhatsApp; status aguardando confirmação, confirmado, concluído, cancelado. **Abrir WhatsApp não comprova envio nem venda realizada.**
- Controle manual de confirmação e estoque no painel do vendedor; painel administrativo para moradores e lojas.
- PWA instalável com layout responsivo e navegação inferior no celular.

## Segurança e limites
- Senhas com bcrypt, autenticação via sessões opacas HttpOnly SameSite Lax, validação de entradas, rate-limit persistido para login, ações autorizadas no servidor.
- A aprovação de moradores e o convite são obrigatórios. O identificador do condomínio vem da sessão autenticada, não do payload do cliente.
- Sem gateway de pagamento, integração com API oficial WhatsApp, confirmação automática de envio, rastreamento de pagamento, disparo push ou e-mails transacionais nesta versão.
- Imagens são armazenadas em PostgreSQL para facilitar o piloto; migrar para object storage antes da expansão.
- Executar atrás de HTTPS em produção e configurar as políticas do condomínio/LGPD, retenção e backups. O convite só permite solicitar acesso, não aprova o morador.
- Não exibir torres/apartamentos em listagens públicas. Os dados são visíveis apenas aos participantes autorizados do pedido.
- Cadastros pendentes não podem navegar no marketplace.

## Validação
npm run typecheck
npm run test
npm run build

## Referência de UX
Inspiração conceitual no 99Food: campo de busca em destaque, categorias, ofertas e navegação inferior. Identidade, componentes, textos e código próprios do Condovery.
