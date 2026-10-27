# Monitoramento de latência das APIs

A rota `/api/[...path]` emite linhas JSON estruturadas para requests selecionadas:

- **error:** todas as respostas HTTP 5xx;
- **slow:** respostas cuja duração no backend supera o limite configurado;
- **sample:** amostra de respostas rápidas, inclusive 4xx, para estimar latência sem gravar cada acesso.

Os eventos incluem somente método, **rota normalizada** (IDs e slugs são substituídos), status e duração em ms. Não registram nomes, e-mails, IP, headers, cookies, corpo, parâmetros de URL nem IDs de condomínio. Logs existentes de Nginx/PM2 podem ter políticas próprias de retenção e devem ser tratados separadamente.

As medições começam ao entrar no handler Next.js e terminam após a resposta ser construída. **Não** incluem a transmissão ao cliente nem a latência de rede externa.

## Configuração em `.env.local`

```ini
API_METRICS_ENABLED=true
API_SLOW_REQUEST_MS=1000
API_METRICS_SAMPLE_RATE=0.02
```

`API_METRICS_SAMPLE_RATE` pode ir de `0` a `1`. Mesmo com zero, erros 5xx e requests lentas continuam registradas. Para suspender tudo, defina `API_METRICS_ENABLED=false`. Valores inválidos usam os padrões. Reinicie o processo PM2 após editar o ambiente.

## Consultar na VPS

```bash
pm2 logs condovery --lines 150
# Para procurar eventos salvos pelo PM2 no diretório padrão:
grep 'condovery_api_request' ~/.pm2/logs/condovery-*.log | tail -30
```

Campos: `event`, `kind`, `method`, `route`, `status`, `duration_ms`. Analise especialmente rotas com muitas respostas 5xx, latências maiores que 1000ms e aumento sustentado de duração em amostras normais.

**Limites:** não é benchmark, não calcula percentis automaticamente e não persiste métricas em banco. Não use estes logs como prova de capacidade sob alta concorrência; execute testes de carga isolados e `EXPLAIN (ANALYZE, BUFFERS)` nas consultas críticas depois de identificar gargalos. Configure rotação e retenção de logs no host para evitar crescimento ilimitado.
