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

## Entrega e retirada
- O vendedor configura **Entrega**, **Retirada** ou ambas nas Configurações.
- Se escolher Entrega, pode definir taxa fixa opcional por pedido de R$ 0,00 a R$ 10.000,00.
- O checkout só apresenta formas de recebimento habilitadas; o servidor também valida essas permissões.
- A taxa aparece somente na modalidade Entrega e entra na totalização **uma vez por pedido**, não por produto.
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
