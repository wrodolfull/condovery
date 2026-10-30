'use client';
import {useState,type FormEvent} from 'react';
import {ArrowRight,ArrowUpRight,Building2,Check,ChevronDown,Gift,HeartHandshake,Menu,ShoppingBag,Store,UtensilsCrossed,X} from 'lucide-react';
import './landing.css';

const benefits=[
 {icon:UtensilsCrossed,title:'Compre de quem está perto',text:'Encontre refeições, doces, lanches, produtos e ofertas da sua comunidade.'},
 {icon:Store,title:'Venda para seus vizinhos',text:'Monte sua loja, organize os produtos e receba pedidos dos moradores.'},
 {icon:Gift,title:'Compartilhe o que não usa mais',text:'Doe itens e dê novas oportunidades ao que já não precisa.'},
 {icon:HeartHandshake,title:'Descubra talentos e serviços',text:'Conheça serviços e oportunidades anunciados na sua comunidade.'}
];
const questions=[
 ['O que é o Elevadoor?','Uma plataforma para moradores comprarem, venderem e compartilharem oportunidades dentro do próprio condomínio.'],
 ['É preciso morar em um condomínio participante?','Sim. O marketplace de cada condomínio é exclusivo para seus moradores, que entram com um código de acesso.'],
 ['Como funcionam pedidos e pagamentos?','O pedido é registrado no Elevadoor e enviado pelo WhatsApp. Pagamento, entrega ou retirada são combinados diretamente com o vendedor.'],
 ['Meu condomínio já precisa estar cadastrado?','Para usar o marketplace, sim. Caso ainda não participe, você pode enviar seu interesse pelo formulário desta página.'],
 ['Todos os recursos estão disponíveis?','Algumas categorias, como serviços, moda e desapego, dependem de habilitação pela administração do condomínio.']
];
export default function ConhecaPage(){
 const [menu,setMenu]=useState(false);
 const [form,setForm]=useState({name:'',condominium:'',contact:'',role:'sindico',website:''});
 const [sending,setSending]=useState(false);
 const [message,setMessage]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setSending(true);setMessage('');
  try{
   const response=await fetch('/api/interest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||'Não foi possível enviar. Tente novamente.');
   setMessage('Interesse registrado! Entraremos em contato pelo canal informado.');
   setForm({name:'',condominium:'',contact:'',role:'sindico',website:''});
  }catch(error){setMessage(error instanceof Error?error.message:'Falha ao enviar. Tente novamente.');}
  finally{setSending(false);}
 }
 return <div className="lp">
  <header className="lp-header"><div className="lp-shell lp-nav">
    <a className="lp-brand" href="#inicio" aria-label="Elevadoor, início">elevadoor<span>.</span></a>
    <nav className={menu?'lp-links is-open':'lp-links'} aria-label="Menu principal">
     <a onClick={()=>setMenu(false)} href="#sobre">O Elevadoor</a><a onClick={()=>setMenu(false)} href="#possibilidades">Possibilidades</a><a onClick={()=>setMenu(false)} href="#como-funciona">Como funciona</a><a onClick={()=>setMenu(false)} href="#condominios">Para condomínios</a>
     <a className="lp-mobile-access" href="/">Entrar no Elevadoor <ArrowUpRight size={16}/></a>
    </nav>
    <a className="lp-login" href="/">Entrar <ArrowUpRight size={16}/></a>
    <button type="button" className="lp-menu" aria-label={menu?'Fechar menu':'Abrir menu'} aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button>
   </div></header>
  <main>
   <section id="inicio" className="lp-hero"><div className="lp-shell lp-hero-grid">
    <div className="lp-hero-copy"><span className="lp-kicker"><span className="lp-dot"/> O MELHOR DA VIZINHANÇA EM UM SÓ LUGAR</span>
     <h1>Seu condomínio tem de tudo. <em>Agora tem onde encontrar.</em></h1>
     <p>Descubra uma nova maneira de comprar, vender e compartilhar dentro do seu condomínio. Tudo em um só lugar, com pessoas que já fazem parte da sua comunidade.</p>
     <div className="lp-actions"><a className="lp-button lp-dark" href="#sobre">Conhecer o Elevadoor <ArrowRight size={19}/></a><a className="lp-button lp-outline" href="#contato">Levar para meu condomínio <ArrowUpRight size={17}/></a></div>
     <div className="lp-hero-note"><Check size={17}/> Exclusivo para moradores de condomínios participantes</div>
    </div>
    <div className="lp-visual" aria-label="Ilustração conceitual de ofertas, lojas e oportunidades da comunidade" role="img">
     <div className="lp-orbit lp-orbit-one"/><div className="lp-orbit lp-orbit-two"/>
     <div className="lp-float lp-float-top"><span className="lp-float-icon">✦</span><div><strong>Feito por vizinhos</strong><small>Mais perto de você</small></div></div>
     <div className="lp-phone"><div className="lp-phone-top"><span className="lp-phone-brand">elevadoor<span>.</span></span><span className="lp-avatar">EL</span></div>
      <div className="lp-phone-greeting">Bom dia, vizinho! <span>✳</span></div><div className="lp-phone-title">Tudo de bom mora aqui.</div><div className="lp-phone-search">⌕ &nbsp; O que você procura hoje?</div>
      <div className="lp-phone-banner"><span>OFERTAS DA SEMANA</span><strong>Tem coisa boa pertinho!</strong><small>Descubra as novidades</small></div>
      <div className="lp-phone-section">Destaques da vizinhança <span>Ver tudo →</span></div>
      <div className="lp-mock-products"><div><span className="lp-emoji">🍰</span><strong>Bolo caseiro</strong><small>Da vizinhança</small></div><div><span className="lp-emoji">🥖</span><strong>Pães fresquinhos</strong><small>Da vizinhança</small></div></div>
      <div className="lp-phone-bottom"><span>⌂</span><span>◇</span><span>♡</span><span>☻</span></div>
     </div>
     <div className="lp-float lp-float-bottom"><span className="lp-float-icon warm"><ShoppingBag size={22}/></span><div><strong>Novas oportunidades</strong><small>Na sua comunidade</small></div></div>
    </div>
   </div></section>
   <section id="sobre" className="lp-section lp-intro"><div className="lp-shell lp-centered"><span className="lp-eyebrow">MAIS PERTO, MAIS CONECTADO</span><h2>Boas oportunidades podem estar <span>logo ao lado.</span></h2><p>Sabe aquele vizinho que prepara bolos incríveis? Ou alguém que oferece um serviço que você estava procurando? Em muitos condomínios, essas oportunidades já existem. O que faltava era um espaço para reunir tudo.</p><p className="lp-intro-strong">O Elevadoor aproxima pessoas, valoriza talentos e facilita o dia a dia de quem vive na mesma comunidade.</p></div></section>
   <section id="possibilidades" className="lp-section lp-features"><div className="lp-shell"><div className="lp-section-heading"><div><span className="lp-eyebrow">TUDO EM UM SÓ LUGAR</span><h2>Um condomínio cheio <span>de possibilidades.</span></h2></div><p>A vida acontece entre um apartamento e outro. O Elevadoor coloca essas descobertas ao alcance de todos.</p></div><div className="lp-feature-grid">{benefits.map((b,i)=><article className="lp-feature" key={b.title}><div className={'lp-feature-icon lp-feature-icon-'+i}><b.icon size={27} strokeWidth={1.8}/></div><h3>{b.title}</h3><p>{b.text}</p></article>)}</div><p className="lp-disclaimer">Algumas categorias podem depender de ativação pela administração do condomínio.</p></div></section>
   <section id="como-funciona" className="lp-section lp-story">
    <div className="lp-shell lp-story-layout">
     <div className="lp-story-heading"><span className="lp-eyebrow">UM DIA COM O ELEVADOOR</span>
      <h2>O melhor do condomínio não está só <span>nas áreas comuns.</span></h2>
      <p>Está nas pessoas. Na receita que virou negócio, na indicação que resolveu um problema e naquela oportunidade que você nem sabia que existia.</p>
      <a className="lp-story-link" href="#contato">Quero isso no meu condomínio <ArrowUpRight size={18}/></a>
     </div>
     <div className="lp-scenes">
      <article className="lp-scene lp-scene-first"><div className="lp-scene-top"><span className="lp-scene-pin"><UtensilsCrossed size={16}/> PERTINHO DE CASA</span><span className="lp-scene-sun">✳</span></div><div className="lp-scene-picture" aria-hidden="true">☕<span>🥐</span></div><div className="lp-scene-bottom"><span>CAFÉ DA MANHÃ</span><h3>O pão quentinho pode vir do bloco ao lado.</h3><p>Abra o Elevadoor, encontre quem faz e combine seu pedido.</p></div></article>
      <article className="lp-scene lp-scene-second"><div className="lp-scene-top"><span className="lp-scene-pin"><Store size={16}/> NEGÓCIO DE VIZINHO</span><span className="lp-scene-sun">↗</span></div><div className="lp-scene-picture" aria-hidden="true">🧁<span>🛍️</span></div><div className="lp-scene-bottom"><span>RENDA EXTRA</span><h3>Seu talento merece sair do grupo de mensagens.</h3><p>Crie sua loja, mostre o que faz e receba pedidos de quem já mora perto.</p></div></article>
      <article className="lp-scene lp-scene-third"><div className="lp-scene-top"><span className="lp-scene-pin"><Gift size={16}/> CIRCULE COISAS BOAS</span><span className="lp-scene-sun">♡</span></div><div className="lp-scene-picture" aria-hidden="true">🪴<span>📚</span></div><div className="lp-scene-bottom"><span>BOA VIZINHANÇA</span><h3>O que não serve mais para você pode fazer o dia de alguém.</h3><p>Compartilhe itens e descubra novas oportunidades entre moradores.</p></div></article>
     </div>
    </div>
   </section>
   <section id="condominios" className="lp-section lp-condos"><div className="lp-shell lp-condo-panel"><div><span className="lp-eyebrow">PARA SÍNDICOS E ADMINISTRADORAS</span><h2>Uma comunidade mais conectada começa por <span>pequenas oportunidades.</span></h2><p>Ofereça aos moradores um espaço digital exclusivo para valorizar empreendedores, facilitar o comércio interno e incentivar uma comunidade mais colaborativa.</p><a className="lp-button lp-dark" href="#contato">Quero o Elevadoor no meu condomínio <ArrowRight size={18}/></a></div><div className="lp-condo-benefits">{[['Um espaço exclusivo','Cada condomínio tem seu próprio ambiente, acessível aos moradores cadastrados.'],['Gestão simplificada','Ferramentas para administrar lojas, categorias e participantes.'],['Mais valor para a comunidade','Um benefício digital que incentiva a colaboração e a economia local.']].map(([title,body])=><div key={title}><span><Check size={19}/></span><section><h3>{title}</h3><p>{body}</p></section></div>)}</div></div></section>
   <section id="contato" className="lp-section lp-contact"><div className="lp-shell lp-contact-grid"><div><span className="lp-eyebrow">FAÇA PARTE</span><h2>Seu condomínio pode ser <span>o próximo.</span></h2><p>Mais proximidade, novas oportunidades e uma maneira diferente de viver em comunidade. Conte para a gente onde você quer levar o Elevadoor.</p><div className="lp-contact-mark"><Building2 size={22}/> Seu condomínio. Sua comunidade.</div></div>
    <form className="lp-form" onSubmit={submit}><h3>Quero conhecer o Elevadoor</h3><p>Preencha os dados para registrar seu interesse.</p><label>Seu nome<input name="name" required minLength={2} maxLength={90} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Nome completo"/></label><label>Nome do condomínio<input name="condominium" required maxLength={140} value={form.condominium} onChange={e=>setForm({...form,condominium:e.target.value})} placeholder="Nome do condomínio"/></label><label>E-mail ou WhatsApp<input name="contact" required maxLength={180} value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} placeholder="Seu contato"/></label><label>Você é...<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="sindico">Síndico(a)</option><option value="administradora">Administradora</option><option value="morador">Morador(a)</option><option value="outro">Outro</option></select></label><div className="lp-honeypot" aria-hidden="true"><label>Website<input name="website" autoComplete="off" tabIndex={-1} value={form.website} onChange={e=>setForm({...form,website:e.target.value})}/></label></div><button className="lp-button lp-dark lp-submit" disabled={sending} type="submit">{sending?'Enviando...':'Quero levar o Elevadoor'} <ArrowRight size={18}/></button><p className="lp-privacy">Seus dados serão usados para responder à solicitação de contato. Saiba mais na <a href="/politica-de-privacidade">Política de Privacidade</a>.</p>{message&&<p className="lp-feedback" role="status">{message}</p>}</form>
   </div></section>
   <section className="lp-section lp-faq"><div className="lp-shell lp-faq-grid"><div><span className="lp-eyebrow">PERGUNTAS FREQUENTES</span><h2>Ainda tem <span>alguma dúvida?</span></h2></div><div>{questions.map(([q,a])=><details key={q}><summary>{q}<ChevronDown size={19}/></summary><p>{a}</p></details>)}</div></div></section>
  </main>
  <footer className="lp-footer"><div className="lp-shell"><div><a className="lp-brand" href="#inicio">elevadoor<span>.</span></a><p>O melhor da vizinhança em um só lugar.</p></div><div className="lp-footer-links"><a href="#sobre">O Elevadoor</a><a href="#condominios">Para condomínios</a><a href="#contato">Contato</a><a href="/">Entrar</a><a href="/politica-de-privacidade">Política de Privacidade</a><a href="/termos-de-uso">Termos de Uso</a></div><small>© {new Date().getFullYear()} Elevadoor. Todos os direitos reservados.</small></div></footer>
 </div>;
}
