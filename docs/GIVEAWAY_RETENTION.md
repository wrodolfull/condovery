# Retenção automática de Desapegos

Ao marcar um item como **Doado**, gravamos `donated_at`. Após 48 horas o item,
o registro e a imagem enviada são removidos pelo job de limpeza.

## VPS com cron

Execute uma vez a migração: `npm run db:migrate`.

No usuário do sistema que executa o Elevadoor, configure `crontab -e`:

```cron
0 * * * * cd /var/www/condovery && /usr/bin/npm run cleanup:giveaways >> /var/log/condovery-giveaways-cleanup.log 2>&1
```

Esse cron executa a cada hora; portanto a exclusão ocorrerá após 48 horas,
normalmente dentro da hora seguinte. Ele exige `.env.local`, `DATABASE_URL`,
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e permissão de escrita no log.
Se `npm` estiver em outro caminho, use o retornado por `command -v npm`.

Sem o agendamento ativo, o sistema marca os itens como Doado e registra a
data, mas **não executa automaticamente** a limpeza.
