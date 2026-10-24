# Condovery: compartilhamento e avaliações de lojas

## Compartilhar loja

No perfil da loja ou no painel do vendedor, o botão **Compartilhar loja**
usa a Web Share API nos navegadores compatíveis. Caso não esteja disponível,
copia para a área de transferência (ou apresenta o link para copiar).

Os links têm formato \`https://SEU-DOMINIO/?loja=UUID\` e abrem a mesma
experiência web, sem criar um novo canal público de dados. O visitante precisa
estar cadastrado, autenticado e aprovado **no mesmo condomínio**. Caso ainda
precise acessar ou criar a conta, o link será retomado após o login e aprovação.
O acesso de outro condomínio não revela o conteúdo da loja.

Esta primeira versão não oferece uma página de loja indexável sem login.

## Avaliações verificadas

1. Morador faz o pedido normalmente, combinando envio e pagamento diretamente
   com o vendedor pelo WhatsApp.
2. A loja confirma e depois **marca como concluído** no Condovery.
3. Somente o **comprador desse pedido** pode enviar a avaliação: nota inteira
   de 1 a 5 estrelas arredondadas e comentário obrigatório até 200 caracteres.
4. A avaliação fica \`pending\`, não pública; o comprador acompanha seu status
   no histórico de pedidos.
5. A loja modera na aba **Avaliações** do painel do vendedor, escolhendo
   **Aprovar e publicar** ou **Não publicar**.
6. Apenas avaliações \`approved\` aparecem no perfil da loja e integram a
   média. A loja vê o número do pedido, nota e comentário; compradores veem
   comentários aprovados sem endereço, apartamento, telefone ou nome.
7. Cada pedido pode receber **uma avaliação**, inclusive se rejeitada; uma
   avaliação não poderá ser reaberta ou publicada novamente após moderação.

A média é arredondada a uma casa decimal para exibição em pt-BR:
\`4,4 de 5\`, acompanhada da quantidade de avaliações. Sem avaliações
aprovadas, a interface mostra **Sem avaliação**. O perfil mostra no máximo
30 comentários recentes publicados; os totais são calculados sobre todas
as avaliações aprovadas.

## Segurança e operação

- Todas as ações consultam o Supabase PostgreSQL **pelo backend**.
- Banco: migração \`db/004_shop_reviews.sql\`, com \`UNIQUE(order_id)\`,
  \`CHECK\` de 1–5/200 caracteres/status e trigger que reforça o vínculo
  com pedido concluído, comprador e condomínio correto.
- \`POST /api/orders/:order_id/review\`: exige login aprovado, pedido concluído
  do comprador, loja aprovada e comprador diferente do dono da loja.
- \`GET /api/shops/:id/reviews\`: somente avaliações aprovadas, acessíveis
  a moradores aprovados do mesmo condomínio.
- \`GET /api/shops/mine/reviews\` e
  \`PATCH /api/shops/mine/reviews/:id\`: somente o titular de uma loja
  aprovada. Apenas moderação de \`pending\` para \`approved\` ou \`rejected\`.
- \`GET /api/orders\` também devolve \`review_status\` do pedido, quando houver.
- Pagamento não é processado nem verificado no Condovery: “compra verificada”
  significa **pedido concluído no sistema**, marcado pelo vendedor, não uma
  transação financeira auditada.
- A moderação pertence ao vendedor por decisão do MVP. Isso permite que
  vendedores não publiquem críticas legítimas; antes de expandir a plataforma,
  é recomendável considerar recurso/contestação ou política de moderação
  independente para preservar a credibilidade das médias.

## Testes

O GitHub Actions aplica a migração duas vezes, testa endpoints reais com
PostgreSQL e percorre o compartilhamento e os principais layouts no Chromium.
Validar manualmente **Web Share API** em Android/iPhone, clipboard, login
através de link compartilhado e apresentação das estrelas em aparelhos reais.
