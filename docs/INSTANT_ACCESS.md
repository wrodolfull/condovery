# Cadastro imediato e regras de convivência

## Acesso ao condomínio
- Morador informa código fixo, torre, apartamento e WhatsApp.
- Supabase Auth continua validando login Google ou e-mail confirmado.
- Cadastro fica ativo sem aprovação manual; a suspensão continua disponível.
- Mudança de torre ou apartamento não bloqueia a conta.

## Código do condomínio
- Código inicial é escolhido em BOOTSTRAP_INVITE_CODE, não gerado aleatoriamente.
- Administrador pode escolher outro pelo painel: 10–40 caracteres alfanuméricos e hífen, com letras e números.
- Hash SHA-256 armazenado no banco; índice único impede uso do mesmo código em condomínios distintos.
- O código anterior deixa de funcionar quando um novo é salvo. Não é possível recuperar a versão em texto de seu hash.
- Conhecer o convite NÃO comprova residência. Compartilhe apenas internamente e altere caso vaze.

## Loja sem aprovação
- Uma conta pode comprar e criar sua loja com o mesmo login.
- Nome, WhatsApp e aceite das regras de convivência são obrigatórios.
- Após criar a loja, o vendedor já pode cadastrar produtos e receber pedidos.
- Administração não aprova previamente, mas pode suspender ou reativar.

## Regras de uso e denúncias
- Não usar ofensas, palavrões, discriminação, conteúdo sexual explícito ou imagens impróprias.
- Somente oferecer produtos e serviços permitidos por lei, com informações verdadeiras.
- O backend utiliza filtro conservador de termos no nome/descrição de lojas e produtos.
- As imagens NÃO passam por análise automática de conteúdo; não há garantia de detecção na publicação.
- Moradores podem denunciar lojas/produtos. A administração decide dispensar, ocultar produto ou suspender loja.
- As denúncias são privadas à administração. Rate limit: até 10 registros por pessoa a cada 24h, um por alvo.

## Migração
- Migration 007 altera o padrão de status para approved e migra apenas pending para approved.
- Usuários e lojas suspensos permanecem suspensos.
- Backup e testes no Supabase real antes do deploy.
- Os testes CI verificam login, criação da loja, regras, denúncias, moderação e código personalizado.
