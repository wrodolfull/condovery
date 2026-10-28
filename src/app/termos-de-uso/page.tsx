import type {Metadata} from 'next';
import Link from 'next/link';
import {LegalPage,ControllerIdentity} from '@/components/LegalPage';

export const dynamic='force-dynamic';
export const metadata:Metadata={
  title:'Termos de Uso | Condovery',
  description:'Conheça as regras de acesso, compra, venda, anúncios e convivência no marketplace Condovery.'
};

export default function TermsOfUse(){
  return <LegalPage kind="terms" title="Termos de Uso"
    description="As condições para participar do marketplace, comprar ou vender dentro do condomínio e utilizar as ferramentas da comunidade.">
    <section>
      <h2>1. Quem oferece o serviço e aceitação</h2>
      <p>O Condovery é uma plataforma digital que facilita a divulgação de produtos e serviços, pedidos, avaliações, ofertas, desapegos e oportunidades comerciais entre pessoas vinculadas a condomínios participantes.</p>
      <p>O uso do serviço está sujeito a estes Termos e à <Link href="/politica-de-privacidade">Política de Privacidade</Link>. Ao criar e utilizar uma conta, o usuário deve conhecer e observar estas regras. Se não concordar, deve deixar de utilizar a plataforma e poderá solicitar encerramento de sua conta conforme as opções disponíveis.</p>
      <ControllerIdentity/>
    </section>
    <section>
      <h2>2. Natureza da plataforma</h2>
      <p>O Condovery funciona como um <strong>marketplace de aproximação entre moradores, vendedores e prestadores de serviços</strong>. Em regra, não é o fabricante, vendedor, entregador ou prestador dos itens anunciados por terceiros.</p>
      <p>Os pedidos são registrados no sistema, mas a confirmação, o pagamento e os detalhes de entrega ou retirada são combinados diretamente entre as partes, normalmente por WhatsApp. O Condovery <strong>não processa automaticamente pagamentos dos pedidos entre moradores</strong> e não deve ser apresentado como comprovante de transferência ou recebimento financeiro.</p>
      <p>Esta distribuição de responsabilidades não afasta direitos previstos na legislação brasileira, inclusive no Código de Defesa do Consumidor, quando aplicável, nem exclui responsabilidades legais próprias da plataforma.</p>
    </section>
    <section>
      <h2>3. Conta e acesso ao condomínio</h2>
      <p>Para utilizar as áreas restritas, o usuário deve criar uma conta, informar dados verdadeiros, manter seu cadastro atualizado e utilizar o código do condomínio fornecido de forma legítima. O cadastro exige confirmação de identidade digital por e-mail ou autenticação disponível; o código, por si só, não comprova residência.</p>
      <p>A conta é pessoal. O usuário deve proteger credenciais e dispositivos, não compartilhar sessões e comunicar suspeitas de acesso indevido pelo canal disponibilizado. É proibido usar dados de terceiros, tentar ingressar em outro condomínio ou contornar mecanismos de autenticação e autorização.</p>
      <p>O acesso ao ambiente de cada condomínio é restrito aos perfis autorizados. A administração pode suspender contas e lojas por violação destas regras, denúncias fundamentadas, risco de segurança ou outras hipóteses legítimas, observados critérios proporcionais e possibilidades de contestação quando cabíveis.</p>
    </section>
    <section>
      <h2>4. Regras para vendedores e prestadores</h2>
      <p>Quem anuncia é responsável pela legitimidade da oferta, veracidade das descrições, preços, disponibilidade, estoque, informações de preparo, condições de entrega/retirada, tributos e licenças eventualmente exigidos para a atividade. Não é permitido oferecer produtos ou serviços ilícitos, falsificados, perigosos ou que violem direitos de terceiros.</p>
      <p>O vendedor deve atender pedidos de boa-fé, confirmar ou recusar solicitações com clareza e solucionar diretamente questões relacionadas ao item fornecido. Ao anunciar alimentos, medicamentos, serviços profissionais ou outros itens regulados, deve observar as regras sanitárias, fiscais e profissionais aplicáveis.</p>
      <p>O status de pedido concluído no Condovery é um registro operacional, não uma certificação independente de entrega, qualidade ou pagamento recebido.</p>
    </section>
    <section>
      <h2>5. Pedidos, pagamentos, entregas e cancelamentos</h2>
      <p>Ao solicitar um produto, o comprador deve conferir descrição, quantidades, preço, instruções e informações para entrega ou retirada. Uma solicitação registrada pode depender da confirmação do vendedor. Datas e horários escolhidos no checkout representam preferências, salvo confirmação expressa do vendedor.</p>
      <p>As condições efetivas de pagamento e entrega, a solução de divergências e os direitos a troca, devolução, reembolso ou arrependimento devem respeitar a legislação aplicável e a natureza da relação entre as partes. O usuário não deve considerar uma conversa externa, um pedido ou um status de tela como prova isolada de pagamento.</p>
      <p>Para sua proteção, procure conferir a identificação do destinatário antes de fazer Pix ou outros pagamentos e evite compartilhar informações financeiras sensíveis fora dos canais apropriados.</p>
    </section>
    <section>
      <h2>6. Comunidade, avaliações, desapegos e feiras</h2>
      <p>Publicações, comentários, fotos, anúncios de desapego e avaliações devem ser verdadeiros, respeitosos e lícitos. São proibidos assédio, discriminação, ameaças, fraude, conteúdo sexual explícito, violação de direitos autorais e divulgação de dados pessoais de terceiros sem fundamento legítimo.</p>
      <p>Os desapegos envolvem combinações diretamente entre moradores, sem garantia de disponibilidade ou entrega pela plataforma. Feiras digitais são vitrines temporárias: os produtos seguem pertencendo às lojas participantes e os pedidos utilizam o checkout habitual.</p>
      <p>Avaliações somente podem ser feitas conforme os critérios técnicos do produto, e sua publicação pode depender de moderação. A plataforma pode receber denúncias, ocultar conteúdos e suspender funcionalidades quando necessário, sem assegurar detecção prévia de toda infração. A remoção de conteúdo poderá ser revista nos canais de atendimento disponíveis.</p>
    </section>
    <section>
      <h2>7. Publicidade e conteúdo patrocinado</h2>
      <p>O Condovery pode apresentar anúncios de lojas, campanhas e ofertas patrocinadas identificadas como publicidade, conforme as funcionalidades disponibilizadas. Informações publicitárias fornecidas por anunciantes devem ser verdadeiras e não enganosas.</p>
      <p>A exibição de anúncios ou produtos na plataforma não constitui garantia de qualidade, disponibilidade, entrega ou aprovação técnica do anunciante. Indicadores de visualização e cliques podem ser aproximados e não representam vendas comprovadas.</p>
    </section>
    <section>
      <h2>8. Segurança, disponibilidade e uso proibido</h2>
      <p>É proibido automatizar acessos abusivos, tentar explorar vulnerabilidades, coletar dados em massa sem autorização, burlar limites de utilização, transmitir código malicioso, utilizar indevidamente contas de terceiros ou comprometer o funcionamento da plataforma.</p>
      <p>O serviço pode passar por manutenção, interrupções ou mudanças técnicas. Serão adotadas medidas razoáveis para sua continuidade e segurança, mas não se promete disponibilidade ininterrupta ou ausência absoluta de falhas.</p>
    </section>
    <section>
      <h2>9. Propriedade intelectual e materiais enviados</h2>
      <p>Marcas, interface, software, design e demais elementos próprios do Condovery são protegidos pela legislação aplicável. O usuário mantém os direitos que possuir sobre seus textos, imagens e anúncios, declarando ter autorização para publicá-los.</p>
      <p>Ao enviar conteúdo, o usuário concede autorização não exclusiva, limitada ao necessário para hospedá-lo, reproduzi-lo, ajustá-lo tecnicamente, exibi-lo aos usuários permitidos e viabilizar os recursos contratados enquanto o conteúdo permanecer autorizado na plataforma, ressalvados prazos de retenção legalmente necessários.</p>
    </section>
    <section>
      <h2>10. Dados pessoais e comunicações externas</h2>
      <p>O tratamento de dados pessoais segue a <Link href="/politica-de-privacidade">Política de Privacidade</Link>. Informações necessárias à execução de pedidos poderão ser disponibilizadas às partes envolvidas. Ao sair da plataforma para o WhatsApp, Google ou outro serviço, o usuário também se sujeita aos termos e políticas desse serviço.</p>
    </section>
    <section>
      <h2>11. Encerramento de conta e retenção</h2>
      <p>Moradores podem solicitar a exclusão da conta pelo perfil. Pedidos ainda em andamento deverão ser concluídos ou cancelados antes da exclusão, quando exigido pelo fluxo. Conteúdos e dados pessoais são removidos ou anonimizados conforme o funcionamento técnico e as obrigações legais descritas na Política de Privacidade.</p>
      <p>Contas com responsabilidades administrativas podem exigir transferência prévia de gestão. As medidas de moderação ou encerramento não afastam o dever de apurar e resolver obrigações ainda pendentes entre as partes.</p>
    </section>
    <section>
      <h2>12. Alterações, solução de conflitos e legislação</h2>
      <p>Estes Termos podem ser atualizados por razões técnicas, operacionais ou jurídicas. A versão vigente e a data serão exibidas nesta página; alterações relevantes serão comunicadas de maneira adequada.</p>
      <p>As relações são regidas pela legislação brasileira aplicável, inclusive LGPD e normas de defesa do consumidor quando pertinentes. Eventuais conflitos devem ser resolvidos preferencialmente por contato e composição, sem prejuízo do acesso aos órgãos competentes e ao foro legalmente assegurado ao consumidor.</p>
      <p>Dúvidas sobre o serviço e solicitações formais podem ser encaminhadas ao responsável identificado na seção 1. Os canais de privacidade e identificação jurídica precisam estar preenchidos antes da divulgação oficial destes documentos.</p>
    </section>
  </LegalPage>;
}
