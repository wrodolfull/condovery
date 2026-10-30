# Limpeza segura de imagens órfãs

O Elevadoor armazena a imagem privada no bucket `condovery-media` do Supabase e registra o arquivo em `media_assets`. Uploads abandonados deixam metadados sem referência a nenhum conteúdo publicado.

## Proteções

- Apenas arquivos registrados em `media_assets` e enviados **há pelo menos 30 dias** são candidatos. Não percorre nem exclui objetos sem metadados no bucket.
- Verifica as referências de **todos os condomínios** em perfis, lojas (logo/capa), produtos, Desapego, campanhas de publicidade e feiras. Registros ocultos, suspensos, arquivados e não publicados também protegem seus arquivos.
- A execução padrão é uma **simulação de leitura**, sem exclusões.
- Mesmo com `--apply`, limita a execução a no máximo 100 arquivos e faz uma **segunda verificação dentro de transação com bloqueio do metadado** antes de remover cada objeto.
- Se o Supabase falhar, a entrada no banco permanece, permitindo nova tentativa. O processo retorna erro se alguma exclusão falhar.
- Arquivos antigos armazenados diretamente em `media_assets.bytes` também podem ser removidos, desde que não tenham referências; não há objeto externo nesse caso.
- Nenhuma rota pública foi criada. O comando requer acesso administrativo ao servidor e credenciais de banco/Supabase; **não é acionado automaticamente**.

## Operação

No servidor, depois do deploy:

```bash
npm run cleanup:orphan-media
npm run cleanup:orphan-media -- --days=90 --limit=25
```

Verifique a lista de IDs e a quantidade de candidatos. Para autorizar a exclusão irreversível, execute:

```bash
npm run cleanup:orphan-media -- --apply --days=90 --limit=25
```

O prazo padrão é 30 dias; recomenda-se **90 dias** para o primeiro processamento em produção. O máximo é 100 arquivos por execução. É possível repetir o comando após revisão. Defina `DATABASE_URL` e, para `--apply`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` (e `DATABASE_SSL=true` quando necessário).

## Limitações e pontos de atenção

Uma imagem ainda não publicada e guardada **apenas em um formulário local de um celular/navegador** não aparece nas tabelas de referência. Por isso há retenção mínima e a operação é deliberadamente manual. Para períodos longos de edição offline, aumente `--days` ou mantenha a rotina apenas em simulação. A segunda verificação não torna uma exclusão do Supabase e uma gravação concorrente no PostgreSQL uma única transação distribuída; programe a execução em período de baixa utilização.

A rotina **não** vasculha arquivos remotos sem linha correspondente no banco. Os processos existentes de exclusão de conta, loja e itens doados continuam responsáveis por seus próprios registros e filas de limpeza.
