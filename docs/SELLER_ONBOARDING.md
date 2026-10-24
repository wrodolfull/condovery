# Condovery — Abertura de loja, perfil, produtos e WhatsApp

## Um único login

Todo morador ativo pode comprar. Em **Minha conta > Quero vender**,
cadastra uma loja vinculada à sua conta e informa obrigatoriamente
seu WhatsApp para receber os pedidos. Não há cadastro/login separado
para vendedor; o morador pode continuar comprando em outras lojas.

### Ativação simples
- **Cadastro enviado!** — formulário concluído e loja em análise.
- **Loja ativa imediatamente.** — o vendedor já pode adicionar produtos e foto.
- **Minha loja** — cadastre os produtos e comece a receber pedidos, sem aprovação.
- **Loja suspensa** — não pode vender; contatar administração.

O vendedor pode testar manualmente seu número pelo botão
**Testar WhatsApp**, que abre o link \`wa.me\`. Isso **não garante** que
o número tenha conta WhatsApp ativa; a conferência real depende do
vendedor.

## Fotos

- \`users.avatar_image\`: foto pessoal, só visível ao próprio morador
  no perfil, carregada por \`POST /api/media/profile\`.
- \`shops.logo_image\`: foto/ícone da loja, exibida na vitrine, junto
  da capa já existente. O vendedor envia pelo formulário da loja.
- Os arquivos são convertidos a WebP e armazenados no bucket privado
  Supabase, sem comunicação direta do navegador com o banco/storage.
- As fotos pessoais têm acesso restrito ao respectivo morador; fotos
  de lojas podem ser consultadas por moradores do mesmo condomínio.

## Três estados para produtos

| Status | Loja e Explorar | Compra | Painel do vendedor |
|---|---|---|---|
| Disponível | Visível normalmente | Sim, com estoque | Sim |
| Indisponível | Visível, em cinza, com identificação | Não | Sim |
| Oculto | Não aparece aos compradores | Não | Sim |

O vendedor altera esses estados a qualquer momento no painel Produtos.
A autorização de compra é repetida no **backend** mesmo se uma página
ou carrinho estiver desatualizado.

Produtos legados com \`is_available=false\` são inicialmente
classificados como **ocultos**, pois anteriormente não apareciam ao
comprador. Nenhum item previamente oculto é publicado involuntariamente.

## Pedidos e WhatsApp

1. O comprador escolhe os itens e as condições de entrega/retirada.
2. O backend valida loja, disponibilidade, estoque e preços e
   **registra o pedido aguardando confirmação**.
3. O cliente é direcionado ao WhatsApp com mensagem pronta, mas precisa
   tocar em **Enviar** no WhatsApp.
4. Se fechar a conversa sem enviar, o pedido já existe e pode abrir
   novamente pelo botão **Abrir WhatsApp** no histórico.
5. Apenas o vendedor confirma, conclui ou cancela o pedido pelo sistema.

\`client_order_key\` evita duplicar pedidos caso a aplicação repita uma
mesma tentativa por instabilidade de rede; o backend reconstrói a mensagem
a partir dos itens registrados, sem criar outro pedido.

**Limite técnico:** WhatsApp comum via link \`wa.me\` não oferece comprovante
de entrega/envio da mensagem à aplicação. Sem WhatsApp Business API não
é possível saber automaticamente se o comprador clicou em Enviar.
Pedidos pendentes devem ser conferidos pelo vendedor. Não atribuir
automaticamente o status confirmado pelo redirecionamento.

## Validação antes do piloto

- Configurar DB/Storage reais, aplicar \`db/005_seller_profile_product_visibility.sql\`.
- Fazer cadastro de loja e teste do número WhatsApp real, sem aprovação prévia.
- Adicionar foto do perfil e da loja com Supabase Storage.
- Criar produto nos três estados e tentar comprar indisponível via API.
- Criar pedido, fechar WhatsApp sem enviar, reabri-lo pelo histórico,
  concluir como vendedor.
- Testar perda de resposta/repetição do checkout: mesmo pedido, mesmo ID.
- Validar rolagem e fotos em Android e iPhone.
