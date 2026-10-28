import type {Metadata} from 'next';
import Link from 'next/link';
import {LegalPage,ControllerIdentity} from '@/components/LegalPage';

export const dynamic='force-dynamic';
export const metadata:Metadata={
  title:'Política de Privacidade | Condovery',
  description:'Saiba quais dados o Condovery utiliza, para quais finalidades, com quem compartilha e como exercer seus direitos previstos na LGPD.'
};

export default function PrivacyPolicy(){
  return <LegalPage kind="privacy" title="Política de Privacidade"
    description="Entenda como seus dados são usados para viabilizar o marketplace do condomínio, conectar moradores e vendedores e proteger a comunidade.">
    <section>
      <h2>1. Abrangência e responsável pelo tratamento</h2>
      <p>Esta Política se aplica ao site institucional, ao marketplace Condovery, ao acesso pelo navegador ou PWA, às contas de moradores, vendedores e administradores e às funcionalidades de anúncios, avaliações, feiras, desapegos e contato comercial.</p>
      <p>O responsável pela operação do Condovery decide sobre os tratamentos necessários à plataforma. Administradores de condomínios e vendedores podem tratar informações para finalidades próprias no exercício de suas atividades, conforme as responsabilidades que efetivamente assumirem. Essa distinção deve ser avaliada em cada relação contratual.</p>
      <ControllerIdentity/>
    </section>
    <section>
      <h2>2. Dados pessoais tratados</h2>
      <p>Conforme a funcionalidade utilizada, podemos tratar:</p>
      <ul>
        <li><strong>Cadastro e residência:</strong> nome, e-mail, número de WhatsApp/telefone, condomínio, torre, apartamento, identificadores de conta, foto de perfil e situação do cadastro. O código de convite é utilizado para vincular a conta ao condomínio, mas não constitui comprovação independente de residência.</li>
        <li><strong>Autenticação e proteção:</strong> identificadores do Supabase Auth, confirmação de e-mail, métodos de login (incluindo Google, quando escolhido), tokens e cookies de sessão, registros técnicos de tentativas, hashes e eventos antifraude. O Condovery não precisa armazenar senhas legíveis para autenticar usuários.</li>
        <li><strong>Lojas e ofertas:</strong> nome e descrição da loja, contato comercial/WhatsApp, imagens, produtos, preços, disponibilidade, categorias, preferências de entrega/retirada e publicações em feiras digitais.</li>
        <li><strong>Pedidos:</strong> identificação do comprador e da loja, produtos, quantidades, valores, preferências de data e entrega, instruções, observações, status e histórico do pedido. Observações livres podem conter dados adicionais que o próprio usuário informar.</li>
        <li><strong>Conteúdo comunitário:</strong> anúncios de desapego, imagens, avaliações e comentários, denúncias e seus motivos, registros de moderação e interações associadas a feiras.</li>
        <li><strong>Publicidade e relatórios:</strong> campanhas exibidas, impressões e cliques únicos aproximados por sessão/dia, indicadores de pedidos e desempenho das lojas. Os indicadores são agregados; há registros técnicos pseudonimizados para deduplicação de eventos.</li>
        <li><strong>Contato institucional:</strong> nome, condomínio informado, canal de contato, perfil de interesse e identificador técnico derivado do IP enviado no formulário da landing page.</li>
        <li><strong>Operação e segurança:</strong> dados técnicos estritamente necessários à entrega do serviço, diagnóstico de falhas, prevenção a abusos e cumprimento de obrigações legais, conforme configuração da infraestrutura.</li>
      </ul>
      <p>Não solicitamos dados pessoais sensíveis como requisito de cadastro. Evite inseri-los em descrições, mensagens, imagens e observações de pedidos.</p>
    </section>
    <section>
      <h2>3. Finalidades e bases legais</h2>
      <p>Utilizamos dados para criar e autenticar contas, permitir acesso ao condomínio, manter perfis, lojas e catálogos, registrar pedidos, disponibilizar atendimento e contato entre moradores, gerir a comunidade, prevenir fraudes e manter a segurança.</p>
      <p>De acordo com cada operação, o tratamento pode se fundamentar na <strong>execução de contrato ou medidas pré-contratuais</strong>, no <strong>cumprimento de obrigação legal ou regulatória</strong>, no <strong>exercício regular de direitos</strong>, em <strong>interesses legítimos</strong> avaliados com respeito aos direitos dos titulares e, quando necessário, no <strong>consentimento</strong> específico. O uso do serviço não representa consentimento irrestrito para qualquer finalidade.</p>
      <p>O contato enviado pela landing page é usado para responder ao interesse demonstrado, avaliar a implantação e dar seguimento à solicitação, sem pressupor autorização para mensagens promocionais indiscriminadas.</p>
    </section>
    <section>
      <h2>4. Visibilidade, compartilhamento e WhatsApp</h2>
      <p>Dados são acessíveis de acordo com o papel e o condomínio associado à conta. Vendedores recebem os dados necessários para atender pedidos, organizar entrega/retirada e entrar em contato com o comprador. Moradores veem anúncios, informações comerciais, produtos e avaliações disponibilizados dentro da comunidade. Administradores podem acessar dados e denúncias necessários para gestão, segurança e moderação, dentro das permissões previstas na plataforma.</p>
      <p>Ao escolher <strong>Enviar pedido</strong> ou abrir um contato no WhatsApp, você pode ser direcionado a um aplicativo de terceiros. Os dados incluídos na conversa ou na mensagem compartilhada passarão também a estar sujeitos às práticas de privacidade do WhatsApp e do destinatário. O Condovery não controla mensagens trocadas fora da plataforma.</p>
      <p>Podemos compartilhar dados necessários com prestadores de hospedagem, banco de dados, autenticação, armazenamento de imagens, entrega de e-mails e infraestrutura técnica, incluindo o <strong>Supabase</strong> e, quando utilizado pelo usuário, o <strong>Google</strong>. Esses fornecedores processam informações na medida dos serviços empregados e conforme suas próprias condições e instrumentos aplicáveis.</p>
      <p>Dados podem ser compartilhados quando exigido por lei, ordem válida de autoridade ou para proteção de direitos. <strong>Não comercializamos cadastros de moradores como listas de contatos para anunciantes.</strong> Anunciantes e vendedores não recebem identificação individual de quem apenas visualizou um anúncio.</p>
    </section>
    <section>
      <h2>5. Cookies, sessões e métricas</h2>
      <p>Utilizamos cookies essenciais e mecanismos equivalentes para manter a autenticação, recuperar fluxos de acesso e proteger sessões. Alguns fluxos de autenticação e recuperação podem estabelecer cookies temporários; seu funcionamento não depende de publicidade comportamental de terceiros.</p>
      <p>O sistema pode registrar eventos técnicos de desempenho e segurança das APIs sem incluir o conteúdo das requisições nos indicadores estruturados. Na publicidade, as impressões e os cliques são estimados com deduplicação por sessão e dia; a base técnica usada para essa deduplicação tem rotina de eliminação após 30 dias, cuja execução depende da operação correta do serviço.</p>
      <p>O painel básico de inteligência do vendedor utiliza pedidos e seus status, sem disponibilizar um histórico individual de navegação dos moradores.</p>
    </section>
    <section>
      <h2>6. Armazenamento, segurança e transferências</h2>
      <p>O Condovery utiliza conexões autenticadas, controles de acesso, sessões protegidas, validação de operações e restrições por condomínio. Imagens podem ser armazenadas em bucket privado do serviço de armazenamento. Nenhuma tecnologia elimina integralmente o risco de incidentes.</p>
      <p>Alguns dados cadastrais e transacionais necessários à operação podem permanecer em colunas comuns do banco de dados. Proteção de transporte, acesso e infraestrutura <strong>não deve ser confundida com criptografia de ponta a ponta de todos os campos pessoais</strong>.</p>
      <p>Conforme a localização e a configuração dos serviços contratados, dados podem ser armazenados ou processados fora do Brasil. Quando houver transferência internacional de dados pessoais, devem ser observados os requisitos e mecanismos previstos na LGPD e na regulamentação aplicável.</p>
    </section>
    <section>
      <h2>7. Guarda, exclusão e anonimização</h2>
      <p>Mantemos dados pelo período necessário ao funcionamento da conta e das atividades solicitadas, à prevenção de abusos, à preservação de registros pertinentes e ao cumprimento de obrigações legais. O prazo varia conforme a categoria, finalidade e exigências aplicáveis; não há um prazo único para todos os dados.</p>
      <p>Moradores podem solicitar a exclusão da conta pelo próprio perfil, após concluir ou cancelar pedidos em andamento. A exclusão desativa o acesso, remove dados do perfil e conteúdos associados quando aplicável e desencadeia a limpeza da autenticação e das imagens. Algumas etapas externas podem depender de processamento posterior e monitoramento operacional.</p>
      <p>Registros históricos de pedidos poderão permanecer <strong>anonimizados</strong> ou, quando legalmente justificado, ser retidos pelo período necessário à obrigação ou à defesa de direitos. Cópias de segurança e registros técnicos seguem ciclos de retenção e descarte da infraestrutura. Itens marcados como doados podem ser expurgados por rotina de manutenção, quando ativa.</p>
    </section>
    <section>
      <h2>8. Direitos dos titulares</h2>
      <p>Nos limites e condições da LGPD, você pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade, portabilidade quando aplicável, informações sobre compartilhamento, revogação de consentimento, oposição em hipóteses previstas em lei e revisão de decisões unicamente automatizadas quando pertinentes.</p>
      <p>Para solicitar o exercício de direitos, utilize o <strong>contato de privacidade identificado na seção 1</strong>. Poderemos solicitar informações proporcionais para confirmar a titularidade da conta e impedir divulgação indevida a terceiros. Alguns pedidos poderão exigir preservação de informações por obrigação legal ou outra hipótese autorizada, com justificativa.</p>
      <p>Você também pode consultar as orientações da <a href="https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares" target="_blank" rel="noopener noreferrer">Autoridade Nacional de Proteção de Dados (ANPD)</a>.</p>
    </section>
    <section>
      <h2>9. Crianças e adolescentes</h2>
      <p>O Condovery não foi concebido como ambiente direcionado a crianças. O tratamento de dados de crianças e adolescentes, caso ocorra, deve observar seu melhor interesse, as regras de capacidade e representação aplicáveis e as exigências da legislação. Responsáveis devem acompanhar o uso da plataforma por menores.</p>
    </section>
    <section>
      <h2>10. Alterações e comunicação</h2>
      <p>Esta Política poderá ser atualizada por necessidade operacional, jurídica ou tecnológica. A versão vigente e sua data de atualização serão disponibilizadas nesta página. Alterações relevantes que afetem o tratamento ou os direitos das pessoas deverão ser comunicadas de maneira adequada.</p>
      <p>Para regras de funcionamento, responsabilidades de compradores e vendedores e limites do serviço, consulte os <Link href="/termos-de-uso">Termos de Uso</Link>.</p>
    </section>
  </LegalPage>;
}
