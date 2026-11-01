# Checkout, personalização e confirmação por WhatsApp

## Carrinho
- O morador seleciona produtos de **uma loja por pedido**. Se escolher produto de outra, o carrinho antigo pode ser substituído após confirmação.
- Cada produto permite quantidade (1–30 por linha) e observação (até 200 caracteres).
- Duas linhas do mesmo produto com observações e/ou opções diferentes são aceitas, sem perder detalhes.
- O servidor verifica o estoque pela **soma das quantidades** das linhas repetidas, mesmo quando as personalizações diferem.

## Opções do produto
O vendedor configura até oito grupos, como **Sabor**, **Tamanho**, **Cobertura** e **Adicionais**; cada grupo possui até 15 opções.
- Grupo obrigatório ou opcional;
- Escolha única ou várias escolhas;
- Cada escolha pode ter acréscimo de R$ 0,00 até R$ 10.000,00.
- O valor por unidade é o preço normal/promocional atual **mais a soma dos acréscimos escolhidos**.
- O servidor rejeita seleções ausentes em grupos obrigatórios, inválidas, duplicadas e opções removidas.
- O nome, preço e opções da compra ficam salvos como snapshots no pedido.

### Personalização avançada (web + app)

Os grupos existentes continuam compatíveis. Campos opcionais novos em `products.option_groups`:
- `min_select` e `max_select`: limites de unidades selecionadas no grupo (até 30), validados no backend na cotação e no pedido. Se ausentes, mantém o comportamento antigo: pelo menos uma escolha para grupo obrigatório; uma escolha para grupo único; até o número de opções em grupos múltiplos.
- `allow_quantity`: permite selecionar a mesma opção mais de uma vez apenas em grupos de múltiplas escolhas; cada unidade conta para o máximo e adiciona seu respectivo preço.
- `available` em cada opção: o vendedor pode ocultar a escolha do fluxo de compra sem excluir seu cadastro. O comprador a vê indisponível e o servidor impede sua seleção.

**Compatibilidade:** para preservar o payload atual de `orders/quote` e `orders`, a quantidade de cada escolha é enviada como IDs repetidos em `selections[group_id]`. IDs repetidos são rejeitados quando `allow_quantity` não estiver habilitado. O servidor salva no snapshot do pedido uma única opção com `quantity` (somente se maior que um), o preço unitário e o total de cada personalização, para histórico, painel do vendedor e mensagem do WhatsApp. O valor é sempre calculado no servidor.

**Exemplo:** produto "Milho 350 ml" a R$ 19,90 com "Recheios" (mínimo 2/máximo 2), "Acompanhamentos" (mínimo 4/máximo 4), "Temperos" opcionais e "Adicionais" com quantidades. Duas unidades extras de cheddar a R$ 3,00 cada totalizam R$ 25,90.

A disponibilidade é manual por opção; **estoque numérico por ingrediente e baixa automática desse estoque ainda não existem**. O estoque do produto principal continua sendo validado e reservado normalmente. Recomenda-se publicar primeiro o backend/web, depois atualizar o app e orientar vendedores a ativar limites mais rígidos apenas após a atualização do app.

## Entrega e retirada
- O vendedor configura **Entrega**, **Retirada** ou ambas nas Configurações.
- Se escolher Entrega, pode definir taxa fixa opcional por pedido de R$ 0,00 a R$ 10.000,00.
- O checkout só apresenta formas de recebimento habilitadas; o servidor também valida essas permissões.
- A taxa aparece somente na modalidade Entrega e entra na totalização **uma vez por pedido**, não por produto.
- Para entregas, o morador pode escolher **Bater na porta**, **Tocar a campainha** ou **Não tocar a campainha**, além de deixar na porta, entregar pessoalmente ou retirar na portaria. A tela evita combinar bater e tocar a campainha, ou tocar e não tocar. O backend também rejeita combinações contraditórias.
- As instruções escolhidas são salvas no pedido e enviadas na mensagem do WhatsApp do vendedor.
- Data/horário são preferências, não garantia de disponibilidade. Não há pagamento online.

## Revisão de valores
O cliente vê preços e taxa na vitrine e no carrinho. Ao finalizar, o frontend consulta `POST /api/orders/quote`; o servidor lê o banco atual e devolve preço unitário de cada linha, subtotal, frete e total.

Se qualquer preço/taxa tiver mudado, o checkout mostra o novo valor e exige clicar em **Confirmar novo valor e continuar** antes de registrar. Mesmo depois disso, `POST /api/orders` recusa uma alteração subsequente de total com HTTP 409. A cotação não cria pedido.

O número `client_order_key` permite repetir uma tentativa sem gerar dois pedidos; as informações monetárias são calculadas no backend e nunca aceitas do navegador sem validação.

## WhatsApp e gerenciamento
O pedido é registrado antes de abrir o `wa.me` do vendedor. A mensagem contém número, loja, comprador, itens separados com quantidade e valor, escolha de adicionais e observações individuais, subtotal, taxa, total, retirada ou entrega, torre/apartamento, data, horário e instruções.

**Abrir o WhatsApp não envia automaticamente a mensagem. O morador precisa tocar em Enviar.**
Pedidos pendentes e confirmados permitem reabrir a mesma conversa com os dados persistidos.

No painel do vendedor, cada item apresenta suas opções e observações, subtotal, taxa e total. Só o vendedor confirma/conclui/cancela o pedido. O estoque é abatido na confirmação e restaurado se um pedido confirmado for cancelado.

## Migração
A migração `db/008_checkout_options_and_fees.sql` acrescenta campos JSONB de opções, taxa da loja, subtotal/taxa persistidos e opções do pedido. Dados existentes são preservados e pedidos anteriores recebem subtotal igual ao total original.

A migration só deve ser aplicada em produção depois do merge, backup e validação da PR.
