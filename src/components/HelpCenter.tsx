'use client';

import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,BookOpen,ChevronDown,CircleHelp,Search,ShieldCheck,ShoppingBag,Store,X} from 'lucide-react';
import {helpArticles,type HelpArea,type HelpArticle} from '@/lib/help-content';

type Access='loading'|'guest'|'resident'|'admin'|'unavailable';
const areas:{id:HelpArea;title:string;subtitle:string;icon:typeof ShoppingBag}[]=[
  {id:'resident',title:'Moradores',subtitle:'Conta, compras, pedidos e comunidade',icon:ShoppingBag},
  {id:'seller',title:'Minha loja',subtitle:'Produtos, vendas e participação nas feiras',icon:Store},
  {id:'admin',title:'Administração',subtitle:'Gestão e moderação do condomínio',icon:ShieldCheck}
];
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();

function Question({article}:{article:HelpArticle}){
  return <details className="help-question">
    <summary><span className="help-question-title">{article.title}</span><ChevronDown size={18} aria-hidden="true"/></summary>
    <div className="help-answer">
      <ol>{article.steps.map((step,index)=><li key={index}>{step}</li>)}</ol>
      {article.note&&<p className="help-answer-note">{article.note}</p>}
    </div>
  </details>;
}

export function HelpCenter(){
  const [access,setAccess]=useState<Access>('loading');
  const [area,setArea]=useState<HelpArea>('resident');
  const [topic,setTopic]=useState('Todos');
  const [search,setSearch]=useState('');
  useEffect(()=>{
    let active=true;
    fetch('/api/me',{credentials:'same-origin',cache:'no-store'})
      .then(async response=>{if(!response.ok)throw new Error('Falha na consulta da sessão.');return response.json();})
      .then((data:{viewer?:{role:string;status:string;is_superadmin?:boolean}|null})=>{
        if(!active)return;
        const viewer=data.viewer;
        setAccess(!viewer?'guest':viewer.status!=='approved'?'unavailable':viewer.role==='admin'?'admin':'resident');
      }).catch(()=>{if(active)setAccess('unavailable');});
    return()=>{active=false;};
  },[]);
  const allowed=useMemo(()=>access==='admin'?areas:areas.filter(a=>a.id!=='admin'),[access]);
  const allowedArticles=useMemo(()=>helpArticles.filter(article=>allowed.some(a=>a.id===article.area)),[allowed]);
  const topics=useMemo(()=>['Todos',...new Set(allowedArticles.filter(article=>article.area===area).map(article=>article.topic))],[allowedArticles,area]);
  const searching=search.trim().length>0;
  const articles=useMemo(()=>{
    const term=normalize(search.trim());
    return allowedArticles.filter(article=>{
      if(term)return normalize([article.title,article.topic,...article.steps,article.note||''].join(' ')).includes(term);
      return article.area===area&&(topic==='Todos'||article.topic===topic);
    });
  },[allowedArticles,area,topic,search]);
  const groups=useMemo(()=>{
    const names=[...new Set(articles.map(article=>searching?areas.find(a=>a.id===article.area)?.title||article.topic:article.topic))];
    return names.map(name=>({name,items:articles.filter(article=>(searching?areas.find(a=>a.id===article.area)?.title:article.topic)===name)}));
  },[articles,searching]);
  function chooseArea(next:HelpArea){setArea(next);setTopic('Todos');setSearch('');}

  return <div className="help-page">
    <header className="help-header"><div className="help-header-inner">
      <a href="/" className="help-brand" aria-label="Voltar ao Elevadoor">elevadoor<span>.</span></a>
      <a href="/" className="help-return"><ArrowLeft size={16}/> Voltar ao Elevadoor</a>
    </div></header>
    <main className="help-main">
      <div className="help-intro">
        <span className="help-eyebrow"><BookOpen size={15}/> CENTRAL DE AJUDA</span>
        <h1>Como podemos ajudar?</h1>
        <p>Encontre respostas objetivas para aproveitar o Elevadoor. Escolha um assunto e siga o passo a passo.</p>
        {access!=='guest'&&access!=='unavailable'&&<label className="help-search"><Search size={20} aria-hidden="true"/>
          <input type="search" aria-label="Buscar dúvidas" placeholder="Busque por pedido, produto, feira..." value={search} onChange={event=>setSearch(event.target.value)}/>
          {search&&<button type="button" aria-label="Limpar busca" onClick={()=>setSearch('')}><X size={17}/></button>}
        </label>}
      </div>
      {access==='loading'?<div className="help-state" role="status">Carregando sua central de ajuda...</div>:
       access==='guest'?<div className="help-state"><CircleHelp size={30}/><h2>Entre para consultar a ajuda</h2><p>A central acompanha seu perfil de morador ou administrador.</p><a className="help-main-action" href="/">Entrar no Elevadoor</a></div>:
       access==='unavailable'?<div className="help-state" role="alert"><h2>Não foi possível confirmar seu acesso</h2><p>Entre na sua conta e tente novamente.</p><a className="help-main-action" href="/">Voltar ao Elevadoor</a></div>:
       <>
         {!searching&&<section className="help-areas" aria-label="Áreas de ajuda">
           {allowed.map(item=>{const Icon=item.icon;return <button type="button" key={item.id}
             className={'help-area'+(area===item.id?' active':'')} aria-pressed={area===item.id} onClick={()=>chooseArea(item.id)}>
             <span className="help-area-icon"><Icon size={20}/></span>
             <span><strong>{item.title}</strong><small>{item.subtitle}</small></span>
           </button>;})}
         </section>}
         {!searching&&<div className="help-topic-selector"><label htmlFor="help-topic">Assunto</label>
           <select id="help-topic" value={topic} onChange={event=>setTopic(event.target.value)}>
             {topics.map(value=><option key={value} value={value}>{value}</option>)}
           </select>
         </div>}
         <section className="help-results" aria-live="polite">
           <div className="help-results-heading"><div><h2>{searching?'Resultados da busca':areas.find(item=>item.id===area)?.title}</h2>
             <p>{articles.length} {articles.length===1?'dúvida encontrada':'dúvidas encontradas'}</p></div>
             {searching&&<button type="button" className="help-clear" onClick={()=>setSearch('')}>Limpar busca</button>}
           </div>
           {articles.length===0?<div className="help-empty"><CircleHelp size={26}/><h3>Nenhuma dúvida encontrada</h3>
             <p>Tente outro termo ou escolha um assunto diferente.</p></div>:
           groups.map(group=><div key={group.name} className="help-group">
             <h3>{group.name}</h3>
             <div className="help-list">{group.items.map(article=><Question key={article.id} article={article}/>)}</div>
           </div>)}
         </section>
         <aside className="help-footer-note"><CircleHelp size={19}/><span>Não encontrou o que procura? Consulte a administração do seu condomínio para orientações específicas.</span></aside>
       </>}
    </main>
  </div>;
}
