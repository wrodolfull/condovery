# Exclusão de conta (Condovery)

## Morador
Em **Minha conta → Excluir minha conta**, a pessoa digita `EXCLUIR`.
Contas com senha precisam informar a senha atual; contas Google sem senha
precisam ter feito login nos últimos 15 minutos. A requisição ocorre em
`DELETE /api/me`, sempre na sessão HttpOnly do próprio usuário.

- Não permite exclusão da conta administradora: é necessário transferir
  a gestão antes, operação ainda não implementada.
- Rejeita exclusão se a pessoa tiver compras ou vendas aguardando
  confirmação ou confirmadas; pedidos precisam ser concluídos ou cancelados.
- Desativa o acesso de forma irreversível e revoga todas as sessões.
- Remove nome, e-mail, telefone, torre/apartamento, fotos pessoais,
  texto livre de pedidos, avaliações e denúncias ligadas à conta.
- Se o morador for vendedor, desativa definitivamente a loja, oculta
  produtos e remove o conteúdo do catálogo, preservando IDs necessários
  às referências históricas.
- Mantém apenas os registros de pedidos e valores financeiros, com
  identidade do comprador anonimizada, para histórico de transações.

A identidade externa é removida via **Supabase Auth Admin** e as fotos
são excluídas do bucket privado **condovery-media**. Por serem serviços
externos ao PostgreSQL, estas etapas não são atômicas: o banco grava
um job técnico sem dados pessoais explícitos para concluir a exclusão
caso o serviço esteja indisponível. A resposta HTTP 202 informa que
a limpeza externa ainda está pendente.

## Operação
Depois de aplicar `db/009_account_deletion.sql`, configure uma execução
periódica de `node --env-file=.env.local scripts/cleanup-deleted-accounts.mjs`
no servidor (por exemplo, a cada 15 minutos). Monitorar jobs com
`finished_at IS NULL` e `last_error`; o script imprime contagens.

**Esta PR não instala o agendamento no servidor nem executa a migração
em produção.** É necessário validar os provedores reais, backups,
retentividade/legalidade dos registros fiscais e o processo de retries.

## Testes
CI simula Supabase Auth, verifica senha, frase, pedidos em andamento,
anonimização, sessão revogada, bloqueio de novo login e loja arquivada.
Também executar teste manual completo em Android/iOS e web antes de
liberar a função para usuários reais.
