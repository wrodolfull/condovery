# Publicação de Termos de Uso e Política de Privacidade — Elevadoor

## URLs públicas
- /politica-de-privacidade — descrição das categorias de dados, bases legais,
  papéis, compartilhamentos, retenção, segurança, cookies e direitos.
- /termos-de-uso — regras de conduta, uso do marketplace, vendedores,
  compras, anúncios, feiras, avaliações, propriedade intelectual e encerramento.
- Links acessíveis sem autenticação no footer de /conheca e no perfil do
  morador/administrador; o cadastro também fornece links para consulta.

## Dados jurídicos OBRIGATÓRIOS antes da divulgação
Não estão no código informações verificadas sobre a pessoa física ou empresa
que atua como controladora. **Não foram inventados CNPJ, CPF ou e-mail.**

Configure no ambiente de produção, usando dados verdadeiros e públicos:
- LEGAL_CONTROLLER_NAME — razão social ou identificação do responsável.
- LEGAL_CONTROLLER_REGISTRATION — CNPJ, CPF ou registro aplicável, com avaliação
  da necessidade de divulgar o número completo se o responsável for pessoa física.
- LEGAL_CONTROLLER_ADDRESS — endereço de correspondência institucional apropriado.
- LEGAL_PRIVACY_EMAIL — endereço monitorado para solicitações de titulares.

Os documentos são renderizados pelo servidor com dados de ambiente. Na
ausência de nome/e-mail, apresentam aviso explícito de documentação incompleta.
**Configure as variáveis e confirme as duas páginas antes do lançamento.**
Não use e-mail inventado, não exponha segredos no campo e não confunda o
formulário comercial da landing com um canal de solicitações de privacidade.

## Revisão operacional e jurídica necessária
1. Identificar formalmente controlador(es), operador(es), administradores de
   condomínios, vendedores independentes e responsabilidades contratuais.
2. Confirmar bases legais reais para cada operação, inclusive divulgação de
   telefones/contatos e envio de mensagens comerciais.
3. Confirmar contratos, localização/região dos dados e mecanismos de eventual
   transferência internacional envolvendo Supabase, Google e hospedagem.
4. Auditar permissões reais (RLS/grants), MFA dos administradores e integridade
   do acesso entre condomínios.
5. Revisar avisos e retenção efetiva de logs, marketing_leads, pedidos,
   imagens, backups e cookies. Rotinas de limpeza só operam se agendadas.
6. Estabelecer processo documentado para responder pedidos LGPD e incidentes
   de segurança, com verificação da identidade do solicitante.
7. Checar a moderação de avaliações e conteúdos e o enquadramento do serviço
   conforme CDC e normas aplicáveis ao comércio entre moradores.
8. Se houver mudança significativa na coleta, no compartilhamento ou na
   finalidade, revisar documentos, versão, data e comunicação de alterações.
9. Realizar revisão com profissional jurídico habilitado antes de afirmar que
   o produto está plenamente adequado à LGPD.

## Importante
Os documentos descrevem a implementação atual consultada em outubro de 2026.
Eles não alteram sozinhos permissões de banco, políticas de cookies,
processos de exclusão, configurações de backup ou garantias de segurança.
A conformidade requer também controles e rotinas técnicas e organizacionais.

Referências:
- LGPD (Lei 13.709/2018): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Direitos dos titulares, ANPD: https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares
- Identificação do controlador, ANPD: https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados
