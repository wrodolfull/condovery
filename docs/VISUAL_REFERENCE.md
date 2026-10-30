# Elevadoor — Guia de fidelidade visual (mobile-first)

Referência: storyboard compartilhado e aprovado na conversa de 24/10/2026.
A referência é CONCEITUAL, não uma captura do sistema ou autorização para
exibir funcionalidades inexistentes.

## Identidade
- Nome sempre grafado: **elevadoor.** (minúsculas; ponto coral).
- Assinatura: **Tudo de bom mora aqui.**
- Paleta: coral/laranja #FC6741, amarelo #FFCF25, grafite #251F18,
  creme #F7F5EE e cartões brancos.
- Tipografia com hierarquia forte (Outfit nos títulos, DM Sans no corpo).
- Navegação primeiro em largura móvel: Início, Explorar, Salvos, Pedidos, Conta;
  botões cápsula, áreas de toque generosas e respeito à safe area.
- Fotos reais de vendedores/produtos, com placeholders próprios onde não há foto.
  Não simular ratings, prazo de entrega, desconto ou localização.

## Frases por jornada
### Boas-vindas / autenticação
- **Seu condomínio mais perto de você!**
- **Compre dos seus vizinhos. Apoie comércios locais. Receba no seu condomínio.**
- **Bem-vindo(a)!**
- **Acesse sua conta para continuar.**
- **Continuar com Google** e **Entrar com e-mail**
- Cadastro: **Cadastrar conta**, **Informações do morador**, **Enviar para aprovação**
- Status: **Cadastro enviado!** / **Agora é só aguardar a aprovação da administração do condomínio.**
- Recuperação: **Recuperar senha** / **Informe seu e-mail para receber o link de recuperação.**

### Morador / marketplace
- Início: **Seu condomínio mais perto de você!**
- Banner: **Tudo de bom mora aqui.**
- Ação principal: **Começar a explorar**
- Seções: **Descubra o que tem por aqui**, **Ofertas da semana**,
  **Feito pelos seus vizinhos**, **Lojas em destaque**
- **Explorar**: produtos e lojas do condomínio.
- **Meus favoritos**, **Meus pedidos**, **Meu perfil**.

### Loja / produto / pedido
- Loja: capa, nome, descrição, formas de entrega/retirada e produtos.
- Produto: imagem, preço, descrição, observações, quantidade, adicionar ao carrinho.
- Carrinho: endereço do morador, instruções, período desejado e WhatsApp.
- Sucesso: **Seu pedido foi registrado!** Não afirmar que a mensagem foi enviada,
  o pagamento ocorreu ou que o vendedor já aceitou.
- Timeline real: **Pedido criado**, **Confirmado**, **Concluído**; ou **Cancelado**.
  Não inventar entregador, ETA ou rastreamento de localização.

### Vendedor e administração
- **Painel do vendedor** e **Minha loja**.
- **Seus produtos**, **Pedidos**, **Configurações**.
- **Administração do condomínio**, **Moradores pendentes e cadastrados**, **Lojas**.
- Não criar login independente para vendedor: mesma conta de morador.

## Critérios de QA
- Revisar em telas móveis de 360px, 390px e 430px; desktop 1280px.
- Garantir rolagem vertical sem overflow horizontal, imagens responsivas,
  botões de formulário acessíveis e barra inferior que não encobre o carrinho.
- Testar fluxos de confirmação de e-mail, Google, pedido e status de aprovação.
- Não alterar backend, contratos de API ou modelo financeiro para reproduzir
  controles fictícios desenhados no mockup.
- Manter este guia como referência ao alterar copy e design futuramente.
