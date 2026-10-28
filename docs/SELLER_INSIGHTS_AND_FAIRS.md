# Inteligência básica do vendedor e Feira digital

## Inteligência para vendedores
No Painel do vendedor, abrir a aba **Resultados** e selecionar 7, 30 ou 90 dias.
Somente o vendedor autenticado com loja aprovada pode consultar
`GET /api/seller/insights?days=30`.

O resultado contém totais de pedidos recebidos, aguardando, confirmados,
concluídos e cancelados, valor e ticket médio dos pedidos atualmente concluídos,
cinco produtos mais pedidos (pelos itens históricos) e série por dia.

Os números são baseados **na data de criação do pedido** e no **status atual**;
um pedido antigo concluído depois não aparece em outro período sem relação.
Valores incluem taxas de entrega quando aplicáveis. **Não representam
pagamentos comprovados, faturamento fiscal ou saldo efetivamente recebido.**
Nenhum dado individual de compradores é exposto na análise.

## Feira digital do condomínio
Na Administração, abrir **Feira digital** para criar, editar, publicar ou retirar
uma feira de circulação. Campos: título, descrição, capa opcional 16:9, início,
encerramento e situação de publicação. Capa exige upload através da API
`/api/media/fair`, disponível exclusivamente ao administrador local.

Uma feira **publicada** aceita inscrições de vendedores enquanto não estiver
expirada, inclusive antes da data de início. No Painel do vendedor, aba
**Feiras**, o vendedor escolhe produtos disponíveis e solicita a inscrição.
A administração pode aprovar ou rejeitar cada produto. O vendedor pode retirar
sua inscrição, inclusive se aprovada; para tentar novamente, deve inscrevê-lo
de novo.

Na Home, o morador vê feiras vigentes. Em **Feiras** encontra sua vitrine.
Um produto só aparece se sua inscrição estiver aprovada, a feira estiver
publicada e dentro do período, a categoria estiver ativa, o produto disponível,
com estoque positivo quando controlado e sem bloqueio de moderação, e a loja
estiver aprovada e aberta. O produto abre seu fluxo original de compra.
A feira **não cria outro checkout, pedido, pagamento, estoque ou tarifa**.

## Proteções
- Todas as operações usam o condomínio ativo da sessão, verificado no backend.
- Os vínculos produto/feira são garantidos por FKs compostas de condomínio.
- A migração `db/033_community_fairs.sql` usa RLS e revogação de grants
  de Data API para `anon`, `authenticated` e `service_role`.
- Cadastros e alterações de feiras e moderação exigem administrador do condomínio.
- Vendedores só inscrevem/retiram produtos de suas próprias lojas.
- As APIs de dados do vendedor não expõem identificação de compradores.

## Implantação e verificação
Antes do merge: verificar o CI do GitHub. Após backup e deploy, executar
`npm run db:migrate` no ambiente da instalação e confirmar credenciais do
PostgreSQL e o bucket privado `condovery-media`. A migração é reaplicável.
Validar manualmente em dois condomínios: uma feira não deve aparecer nem
ser alterável em outro condomínio, e um produto pausado deve desaparecer da
vitrine sem perder seu vínculo de inscrição. Verificar também a apresentação
da Home, a capa, o recorte e a abertura do produto no mobile.
