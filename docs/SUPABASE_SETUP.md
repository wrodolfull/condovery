# Condovery — autenticação centralizada no Supabase Auth

## Arquitetura
Supabase Auth é a única fonte de identidade para cadastro com e-mail e senha,
confirmação de e-mail, login, recuperação de senha e Google. O navegador só
chama a API Next.js do Condovery. O backend valida a identidade via Supabase,
emite uma sessão opaca HttpOnly e aplica regras de condomínio e aprovação.
Nenhuma senha é validada no PostgreSQL da aplicação.

Dados de negócio residem em Supabase PostgreSQL. Fotos passam pelo backend
e são guardadas em bucket privado do Supabase Storage.

## Configuração obrigatória no painel Supabase
1. Ative Authentication > Providers > Email e **Confirm email**.
   Não desative a verificação de e-mail.
2. Ative Authentication > Providers > Google e informe Client ID e Secret
   gerados no Google Cloud. Configure a callback do Google para:
   https://SEU-PROJETO.supabase.co/auth/v1/callback
3. Em Authentication > URL Configuration, configure a URL do site e permita:
   https://SEU-DOMINIO/
   https://SEU-DOMINIO/?email_confirmed=1
   https://SEU-DOMINIO/api/auth/google/callback
   https://SEU-DOMINIO/api/auth/recovery/verify
   Acrescente equivalentes localhost:3000 apenas para desenvolvimento.
4. Mantenha o template de confirmação de cadastro do Supabase
   com {{ .ConfirmationURL }}. O Supabase valida o endereço de e-mail.
5. **Personalize o link no template Authentication > Email Templates >
   Reset Password** para:
   https://SEU-DOMINIO/api/auth/recovery/verify?token_hash={{ .TokenHash }}&type=recovery

   Essa configuração é obrigatória para que o backend consiga validar o
   token de recuperação por verifyOtp; o link padrão do fluxo implícito
   pode enviar tokens em um fragmento que não chega ao servidor.
6. Configure envio de e-mail (SMTP) no **próprio Supabase Auth** para
   produção. Não é necessário Resend ou um emissor próprio de e-mail.
7. Crie bucket PRIVADO do Storage chamado condovery-media.
8. No servidor, configure DATABASE_URL, DATABASE_SSL, DATABASE_POOL_MAX,
   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY e APP_URL.
   Nunca exponha as chaves ou a senha do banco ao navegador.
9. Execute npm run db:migrate e npm run db:bootstrap. O bootstrap cria ou
   encontra o usuário administrador em Supabase Auth e o associa ao
   cadastro condominial do Condovery sem armazenar a senha no PostgreSQL.

## Fluxos de acesso
- Cadastro de morador: convite e torre/apartamento são validados pelo
  backend. Supabase Auth realiza signUp e envia confirmação. O morador
  permanece pendente da administração.
- Login: signInWithPassword valida e-mail/senha no Supabase. O backend
  também exige e-mail confirmado e vínculo válido com condomínio.
  Moradores aprovados entram na vitrine; pendentes aguardam aprovação.
- Google: autorização PKCE gerenciada pelo Supabase Auth no servidor.
  Um novo usuário Google também precisa fornecer convite, telefone e
  apartamento e passar pela aprovação administrativa.
- Recuperação: resetPasswordForEmail envia o e-mail do Supabase;
  verifyOtp valida o hash de recuperação; o backend emite um ticket
  temporário HttpOnly de uso único (15 minutos). admin.updateUserById
  grava a nova senha no Supabase, e sessões Condovery anteriores são
  invalidadas.

## Migração de usuários da versão anterior
A versão anterior usava senha local em bcrypt. O hash legado NÃO é
importado automaticamente no Supabase Auth. A migração SQL preserva
perfis, lojas e pedidos, mas usuários antigos devem ter identidades
Supabase criadas/associadas com verificação de e-mail e migração segura
de senha antes do lançamento. Faça backup antes da transição.
Após a migração completa, hashes antigos poderão ser apagados.

## Testes
O CI usa PostgreSQL e um stub isolado do Supabase Auth para os testes
automatizados (cadastro, confirmação, login, recuperação, aprovação,
pedidos e favoritos). A integração REAL com o painel Supabase, envio de
e-mails e OAuth Google exige configurar credenciais e validar no domínio
de produção antes do lançamento.
