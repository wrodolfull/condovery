import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight, BarChart3, Building2, CheckCircle2, ChevronRight,
  Heart, Leaf, Menu, MessageCircle, PlayCircle, ShieldCheck,
  ShoppingCart, Store, Tag, UsersRound, X,
} from 'lucide-react';
import styles from './landing.module.css';

export const metadata: Metadata = {
  title: 'Condovery — Tudo de bom mora aqui',
  description:
    'O marketplace exclusivo do seu condomínio. Descubra ofertas, compre dos vizinhos e divulgue sua loja em uma comunidade mais conectada.',
  openGraph: {
    title: 'Condovery — Tudo de bom mora aqui',
    description: 'Compre, venda e descubra o que tem pertinho. O marketplace exclusivo do seu condomínio.',
    type: 'website',
  },
};

// Configure uma destas variáveis no ambiente de produção para habilitar contato comercial.
const whatsappNumber = (process.env.NEXT_PUBLIC_CONDOVERY_SALES_WHATSAPP ?? '').replace(/\D/g, '');
const contactEmail = (process.env.NEXT_PUBLIC_CONDOVERY_SALES_EMAIL ?? '').trim();
const salesHref = whatsappNumber
  ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('Olá! Gostaria de levar o Condovery para o meu condomínio.')}`
  : contactEmail
    ? `mailto:${contactEmail}?subject=${encodeURIComponent('Condovery no meu condomínio')}`
    : '/';

function Logo() {
  return (
    <Link href="/landing" aria-label="Condovery - início da apresentação" className={styles.logo}>
      <svg viewBox="0 0 38 42" aria-hidden="true" className={styles.logoMark}>
        <path d="M2 16.2 18.9 3 36 16v20.5h-8V20.7l-9-7.1-9 7V37H2Z" fill="#FFCF25" />
        <path d="M10 20.7 19 13.6 28 20.7V37h-9V25.5l-9 6.7Z" fill="#FF7857" />
        <path d="M19 25.5 28 20.7V37h-9Z" fill="#FFB36B" />
      </svg>
      <span>Condovery</span>
    </Link>
  );
}

const benefits = [
  { title: 'Compre de vizinhos', description: 'Produtos incríveis sem sair do condomínio. Apoie quem empreende aqui pertinho.', icon: ShoppingCart, tone: 'yellow' },
  { title: 'Venda com facilidade', description: 'Divulgue seus produtos e serviços para os seus vizinhos, sem complicação.', icon: Tag, tone: 'coral' },
  { title: 'Pedidos via WhatsApp', description: 'Escolheu o que quer? Fale diretamente com o vendedor pelo WhatsApp.', icon: MessageCircle, tone: 'green' },
  { title: 'Comunidade mais conectada', description: 'Mais do que um marketplace: uma forma de fortalecer os laços do condomínio.', icon: UsersRound, tone: 'peach' },
] as const;

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Logo />
          <nav className={styles.nav} aria-label="Navegação institucional">
            <a href="#como-funciona">Como funciona</a>
            <a href="#moradores">Para moradores</a>
            <a href="#vendedores">Para vendedores</a>
            <a href="#contato">Contato</a>
          </nav>
          <a className={`${styles.btn} ${styles.btnYellow} ${styles.headerCta}`} href="#contato">
            Quero no meu condomínio <ArrowRight size={17} aria-hidden="true" />
          </a>
          <details className={styles.mobileMenu}>
            <summary aria-label="Abrir menu"><Menu size={25} aria-hidden="true" /></summary>
            <nav aria-label="Menu mobile">
              <a href="#como-funciona">Como funciona</a>
              <a href="#moradores">Para moradores</a>
              <a href="#vendedores">Para vendedores</a>
              <a href="#contato">Contato</a>
              <Link href="/">Acessar marketplace</Link>
            </nav>
          </details>
        </div>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <p className={`${styles.eyebrow} ${styles.green}`}>VIZINHOS. PRODUTOS. BOAS CONEXÕES.</p>
            <h1 id="hero-title">Tudo de bom <span className={styles.highlight}>mora aqui.</span></h1>
            <p className={styles.heroDescription}>O marketplace exclusivo do seu condomínio para comprar, vender e descobrir o que tem pertinho.</p>
            <div className={styles.heroButtons}>
              <Link href="/" className={`${styles.btn} ${styles.btnCoral}`}>Quero conhecer <ArrowRight size={18} aria-hidden="true" /></Link>
              <a href="#como-funciona" className={`${styles.btn} ${styles.btnOutline}`}><PlayCircle size={19} aria-hidden="true" /> Ver como funciona</a>
            </div>
            <div className={styles.heroTrust}>
              <span className={styles.trustAvatars} aria-hidden="true"><span>J</span><span>M</span><span>P</span><span>A</span></span>
              <span>Feito para conectar<br />quem mora pertinho</span>
              <span className={styles.trustDivider} />
              <Building2 color="#168257" size={29} aria-hidden="true" />
              <strong>Exclusivo<br />para condomínios</strong>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <img src="/landing/hero-phones.svg" alt="Prévia ilustrativa do Condovery com lojas, ofertas e tela de pedido pelo WhatsApp" width="390" height="384" fetchPriority="high" />
          </div>
        </section>

        <section id="moradores" className={styles.benefits} aria-label="Benefícios do Condovery">
          {benefits.map(({ title, description, icon: Icon, tone }) => (
            <article className={styles.benefitCard} key={title}>
              <span className={`${styles.iconCircle} ${styles[tone]}`}><Icon size={29} strokeWidth={2} aria-hidden="true" /></span>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <section id="como-funciona" className={styles.how} aria-labelledby="how-title">
          <div className={styles.howHeading}>
            <div>
              <p className={styles.eyebrow}>É SIMPLES, RÁPIDO E FEITO PARA O SEU CONDOMÍNIO.</p>
              <h2 id="how-title">Como funciona</h2>
            </div>
            <p>Em poucos passos, você encontra produtos incríveis, fala com o vendedor e apoia talentos do seu condomínio.</p>
          </div>
          <div className={styles.steps}>
            <article className={styles.step}>
              <div className={styles.stepImage}><span className={styles.stepNumber}>1</span><img src="/landing/step-explore.svg" alt="Exemplo da vitrine do Condovery" loading="lazy" width="163" height="170" /></div>
              <div className={styles.stepCopy}><h3>Explore lojas e ofertas</h3><p>Navegue pelos produtos, serviços e promoções dos seus vizinhos.</p></div>
            </article>
            <article className={styles.step}>
              <div className={styles.stepImage}><span className={styles.stepNumber}>2</span><img src="/landing/step-product.svg" alt="Exemplo de produto e botão adicionar ao pedido" loading="lazy" width="127" height="175" /></div>
              <div className={styles.stepCopy}><h3>Monte seu pedido</h3><p>Escolha o que quer, personalize e envie o pedido.</p></div>
            </article>
            <article className={styles.step}>
              <div className={styles.stepImage}><span className={styles.stepNumber}>3</span><img src="/landing/step-whatsapp.svg" alt="Ilustração da conversa entre comprador e vendedor" loading="lazy" width="155" height="181" /></div>
              <div className={styles.stepCopy}><h3>Fale com o vendedor pelo WhatsApp</h3><p>Combine os detalhes diretamente com o vendedor, de forma rápida e prática.</p></div>
            </article>
          </div>
        </section>

        <section id="vendedores" className={`${styles.featureSection} ${styles.sellerSection}`} aria-labelledby="seller-title">
          <div className={styles.featureCopy}>
            <p className={`${styles.eyebrow} ${styles.coralText}`}>PARA VENDEDORES</p>
            <h2 id="seller-title">Seu talento merece vitrine.</h2>
            <p>Se você empreende no seu condomínio, o Condovery é o seu espaço para divulgar seus produtos e serviços para quem está ao seu redor.</p>
            <Link href="/" className={`${styles.btn} ${styles.btnCoral}`}>Quero criar minha loja <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          <div className={styles.featurePhoto}>
            <img src="/landing/seller-neighbor.svg" alt="Empreendedora do condomínio segurando um bolo caseiro" loading="lazy" width="244" height="212" />
          </div>
          <ul className={styles.featureList}>
            <li><Store size={23} aria-hidden="true" /> Cadastro simples</li>
            <li><Tag size={23} aria-hidden="true" /> Divulgue seus produtos</li>
            <li><UsersRound size={23} aria-hidden="true" /> Conecte-se com vizinhos</li>
            <li><BarChart3 size={23} aria-hidden="true" /> Amplie suas oportunidades</li>
          </ul>
        </section>

        <section className={`${styles.featureSection} ${styles.adminSection}`} aria-labelledby="admin-title">
          <div className={styles.featureCopy}>
            <p className={`${styles.eyebrow} ${styles.green}`}>PARA CONDOMÍNIOS E ADMINISTRADORAS</p>
            <h2 id="admin-title">Mais conveniência para o condomínio.</h2>
            <p>O Condovery gera valor para toda a comunidade, incentiva o empreendedorismo local e traz praticidade para o dia a dia dos moradores.</p>
            <a href="#contato" className={`${styles.btn} ${styles.btnGreen}`}>Quero no meu condomínio <ArrowRight size={18} aria-hidden="true" /></a>
          </div>
          <div className={styles.featurePhoto}>
            <img src="/landing/condo-building.svg" alt="Entrada ajardinada de condomínio residencial" loading="lazy" width="245" height="207" />
          </div>
          <ul className={`${styles.featureList} ${styles.adminList}`}>
            <li><UsersRound size={23} aria-hidden="true" /> Mais engajamento entre moradores</li>
            <li><Leaf size={23} aria-hidden="true" /> Incentivo ao empreendedorismo local</li>
            <li><ShieldCheck size={23} aria-hidden="true" /> Ambiente organizado e com acesso restrito</li>
            <li><Heart size={23} aria-hidden="true" /> Uma comunidade mais unida</li>
          </ul>
        </section>

        <section id="contato" className={styles.finalCta} aria-labelledby="final-title">
          <div className={styles.finalCopy}>
            <h2 id="final-title">Leve o Condovery para o seu condomínio.</h2>
            <p>Mais do que um marketplace, é uma comunidade mais forte, conectada e cheia de boas oportunidades.</p>
          </div>
          <div className={styles.buildingArt} aria-hidden="true"><Building2 size={140} strokeWidth={1.2} /><span /></div>
          <div className={styles.finalAction}>
            <a href={salesHref} className={`${styles.btn} ${styles.btnWhite}`}>
              {salesHref === '/' ? 'Conhecer o Condovery' : 'Falar com a equipe'} <ArrowRight size={18} aria-hidden="true" />
            </a>
            <p>{salesHref === '/' ? 'Acesse o marketplace e descubra a experiência Condovery.' : 'Vamos conversar e mostrar como o Condovery pode fazer a diferença no seu condomínio.'}</p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}><Logo /><span>Tudo de bom mora aqui.</span></div>
          <nav aria-label="Navegação do rodapé"><a href="#como-funciona">Como funciona</a><a href="#moradores">Para moradores</a><a href="#vendedores">Para vendedores</a><a href="#contato">Contato</a></nav>
        </div>
        <div className={styles.footerBottom}><span>© {new Date().getFullYear()} Condovery. Todos os direitos reservados.</span><span>Um marketplace para a sua comunidade.</span></div>
      </footer>
    </div>
  );
}
