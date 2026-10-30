# Aplicativo nativo e notificações push

O cliente Expo mora no repositório separado `wrodolfull/condovery_app`. Este backend continua sendo a única autoridade sobre identidade, condomínio, catálogo, estoque, pedidos e permissões.

## Aplicação da atualização

1. Faça o backup e integre a alteração seguindo o processo do projeto.
2. Configure as variáveis abaixo no servidor.
3. Execute `npm run db:migrate` **antes** de reiniciar o código novo. A migração `038` adiciona a audiência das sessões, fluxos Google móveis e tabelas privadas de notificações.
4. Reinicie o backend e valide o login web antes de testar o app.

```dotenv
MOBILE_AUTH_REDIRECT_URI=condovery://auth/callback
EXPO_PROJECT_ID=ID_UUID_DO_PROJETO_EAS
PUSH_ENABLED=false
EXPO_ACCESS_TOKEN=TOKEN_PRIVADO_EXPO_SOMENTE_NO_SERVIDOR
```

O `EXPO_PROJECT_ID` precisa ser igual ao `EXPO_PUBLIC_EAS_PROJECT_ID` utilizado pela build. Ative `PUSH_ENABLED=true` somente após configurar FCM/APNs e a segurança adicional de push no projeto Expo. `APP_URL` deve ser o endereço HTTPS real do backend. Preserve `AUTH_RATE_LIMIT_SECRET`, as configurações Supabase e as regras existentes do proxy.

### Entrar e cadastrar com Google no app

O app Elevadoor tem as ações **Entrar com Google** (tela de login) e **Cadastrar com Google** (tela de cadastro). A mesma identidade Google existente no site web é reutilizada via Supabase Auth: contas já vinculadas recebem uma sessão mobile; novos usuários devem informar **código do condomínio, WhatsApp, torre e apartamento** antes que a conta seja criada, sem cadastrar senha separada.

Autorize no **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs** o endereço HTTPS **exato do backend**, por exemplo: `https://SEU_DOMINIO/api/mobile/auth/google/callback`. Preserve os callbacks web existentes. O provedor Google também precisa estar habilitado em **Authentication → Providers → Google**, com as credenciais corretas.

O browser de autenticação recebe um cookie HttpOnly de fluxo no endpoint `/api/mobile/auth/google/open`; a sessão final é entregue ao app por um código curto de uso único vinculado ao desafio PKCE do aparelho. O app retorna em `condovery://auth/callback` (identificador técnico preservado), destino fixo autorizado pelo servidor.

`MOBILE_AUTH_REDIRECT_URI` é opcional se estiver ausente: o servidor usa o callback nativo legado acima por padrão. Se informada, deve ser exatamente `condovery://auth/callback`; valores divergentes são rejeitados. `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `APP_URL` continuam obrigatórios. O login Google real **exige uma build nativa de desenvolvimento ou distribuição**, não o Expo Go. As telas podem ser verificadas na prévia web, mas o redirect autenticado deve ser validado num dispositivo Android/iOS.

## Sessões e autorização

`sessions.client_kind` distingue `web` e `mobile`. As sessões antigas mantêm o valor `web`. Cookie web não autentica uma sessão móvel e `Authorization: Bearer` não transforma uma sessão web em credencial nativa.

O app usa `POST /api/mobile/auth/login`, que verifica a mesma identidade Supabase, e-mail confirmado, vínculo condominial, suspensão, condomínio ativo e controle de tentativas. A sessão opaca expira em 14 dias e somente seu SHA-256 fica na tabela de sessões. O logout apaga a sessão e os dispositivos vinculados a ela.

As credenciais nativas ficam restritas à lista de operações de comprador em `src/lib/mobile-policy.ts`. Administração, plataforma, gestão da loja, alteração de produtos, operação de feiras e `orders?scope=seller` são negados antes de executar seus handlers. Uma conta administrativa pode comprar, mas sua sessão nativa não troca o condomínio ativo nem concede acesso ao painel. A exclusão de uma identidade administrativa continua bloqueada pela regra original.

O frontend não deve trocar autenticação por acesso direto ao Supabase Data API. Os filtros de condomínio e autorização continuam na API. As tabelas novas têm RLS habilitado e grants de clientes revogados; o proprietário do banco no servidor executa as operações.

## Tipos de notificação

| Evento | Destinatários | Entrada de publicação |
| --- | --- | --- |
| Aviso do condomínio | Moradores ativos do condomínio; push respeita preferência e permissão | Administração web → Configurações |
| Novo pedido | Proprietário da loja, se tiver o app autorizado | Evento transacional ao criar pedido |
| Mudança de status | Comprador do pedido | Evento transacional ao confirmar, concluir ou cancelar |

O vendedor recebe notificações automáticas sobre novos pedidos no aplicativo. **Não existe envio de avisos personalizados por lojas.** O envio institucional continua reservado à administração do condomínio na web, com idempotência e limite de cinco publicações por administrador por hora. O retorno `recipients` representa registros no histórico e não confirma entrega no aparelho.

## Fila e worker

Os eventos de pedido são inseridos na mesma transação de banco que registra o pedido ou sua mudança de status. A combinação destinatário/evento é única. A repetição idempotente de um pedido ou aviso institucional não cria novas entregas daquele evento.

O worker entrega lotes de até 100 mensagens ao Expo, consulta os recibos e desabilita tokens com `DeviceNotRegistered`. Retentativas têm espera exponencial e limite de tentativas. Falha de consulta de recibo preserva o ticket e não reenvia a mensagem. Trabalhadores concorrentes usam leases e `SKIP LOCKED` ao reivindicar envios.

Configure uma execução a cada minuto, com o diretório de trabalho correto e acesso ao `.env.local` do servidor:

```cron
* * * * * cd /var/www/condovery && npm run push:dispatch >> /var/log/condovery-push.log 2>&1
```

Também é possível usar o agendador da hospedagem, executando o mesmo comando. Uma execução não deve ficar permanentemente em background dentro de uma API Route. Se o worker não estiver agendado, os avisos ficam no histórico, mas os pushes não serão processados.

Antes do envio, o worker revalida conta, condomínio, expiração da sessão, preferência e vínculo do dispositivo. Avisos de lojas em fila são marcados como não elegíveis e não são entregues. Uma entrega antiga não acompanha o token quando ele é associado a outra conta/sessão. Entregas antigas/inaptas são encerradas. O histórico tem retenção de 90 dias; a limpeza acontece nas execuções habilitadas do worker. Configure a limpeza de fluxos de autenticação expirados também pelo comando de manutenção abaixo se push permanecer desativado.

Push/Expo/FCM/APNs não garantem entrega exatamente uma vez nem recibo de leitura. Uma falha de rede após aceite pelo provedor pode resultar em repetição. O histórico e a API são a fonte de verdade. Mensagens de pedidos usam texto genérico, sem nome, apartamento, telefone, itens ou valores na tela bloqueada. Avisos institucionais escritos pelo administrador são conteúdo da publicação e devem evitar dados privados de moradores.

## Contratos de push

| Método/rota | Requisito |
| --- | --- |
| `POST /api/push/devices` | Sessão nativa; instalação, token Expo, plataforma e projeto esperado |
| `DELETE /api/push/devices` | Remove dispositivos vinculados à sessão atual |
| `GET/PATCH /api/push/preferences` | Preferências próprias do usuário |
| `GET/PUT/DELETE /api/push/shops/:id` | Rota desativada: retorna 410 para clientes antigos |
| `GET /api/push/inbox?page=0` | Histórico próprio, 30 avisos por página |
| `GET/PATCH /api/push/inbox/:id` | Aviso próprio e marcação de leitura |
| `POST /api/admin/push/announcements` | Administrador web, condomínio ativo da sessão |
| `POST /api/shops/mine/push` | Rota desativada: retorna 410 para clientes antigos |

Dispositivos, tokens de provedor e listas privadas de destinatários não são devolvidos ao remetente nem ao aplicativo. O app só recebe o identificador do aviso no payload de navegação e consulta a API autenticada para abri-lo.

## Testes

- `npm run typecheck`, `npm test`, `npm run build`.
- CI mantém a integração web em PostgreSQL e executa `node --import tsx scripts/smoke-mobile.mjs` com o stub Supabase isolado.
- O teste móvel verifica confirmação de e-mail, audiência da sessão, bloqueio de avisos de loja (web e mobile), supressão de avisos históricos em fila, publicação administrativa, pedidos idempotentes, eventos, concessão Google de uso único, logout e remoção de dispositivos.
- O transporte de push é substituído por respostas locais nesse teste: fila, recibos, opt-out, vínculo de dispositivo e `DeviceNotRegistered` são exercitados sem enviar mensagens reais.
- Validar Google real, e-mails, upload/Storage, navegação por alerta, APNs/FCM e recebimento em development builds físicas Android/iOS antes de liberar a versão.

## Manutenção dos fluxos móveis

O comando `npm run cleanup:auth-security` também limpa desafios, códigos de acesso e cadastros Google móveis expirados após a migração 038. Mantenha a rotina diária existente mesmo quando `PUSH_ENABLED=false`.
