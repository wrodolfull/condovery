import type {ReactNode} from 'react';
import Link from 'next/link';
import {getLegalIdentity} from '@/lib/legal-identity';
import styles from './LegalPage.module.css';

export function LegalPage({kind,title,description,children}:{kind:'privacy'|'terms';title:string;description:string;children:ReactNode}){
  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.inner}>
      <nav className={styles.nav} aria-label="Navegação institucional">
        <Link className={styles.logo} href="/conheca">condovery<span>.</span></Link>
        <Link className={styles.return} href="/conheca">Voltar ao Condovery</Link>
      </nav>
    </div></header>
    <main className={styles.main}><div className={styles.inner}>
      <div className={styles.lead}>
        <span className={styles.eyebrow}>Transparência e confiança</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        <p className={styles.date}>Versão 1.0 · Atualizada em 28 de outubro de 2026</p>
      </div>
      <div className={styles.grid}>
        <article className={styles.article}>{children}</article>
        <aside className={styles.aside} aria-label="Documentos relacionados">
          <strong>Informações legais</strong>
          <Link href="/politica-de-privacidade" aria-current={kind==='privacy'?'page':undefined}>Política de Privacidade</Link>
          <Link href="/termos-de-uso" aria-current={kind==='terms'?'page':undefined}>Termos de Uso</Link>
          <Link href="/conheca#contato">Conheça o Condovery</Link>
        </aside>
      </div>
    </div></main>
    <footer className={styles.footer}><div className={[styles.inner,styles.footerContent].join(' ')}>
      <small>© {new Date().getFullYear()} Condovery. Todos os direitos reservados.</small>
      <div className={styles.footerLinks}><Link href="/politica-de-privacidade">Privacidade</Link><Link href="/termos-de-uso">Termos de Uso</Link><Link href="/conheca">Institucional</Link></div>
    </div></footer>
  </div>;
}

export function ControllerIdentity(){
  const identity=getLegalIdentity();
  return <div className={styles.identity}>
    <p><strong>Responsável pela operação do Condovery:</strong> {identity.name||'Identificação jurídica ainda não informada'}</p>
    <p><strong>CPF/CNPJ ou outro registro aplicável:</strong> {identity.registration||'Não informado'}</p>
    <p><strong>Endereço de contato:</strong> {identity.address||'Não informado'}</p>
    <p><strong>Contato de privacidade e exercício de direitos:</strong> {identity.email?
      <a href={'mailto:'+identity.email}>{identity.email}</a>:'Canal ainda não informado'}</p>
    {!identity.ready&&<p className={styles.pending} role="note">
      Dados de identificação e contato pendentes de configuração pelo responsável pela plataforma.
      Este documento deve ser completado antes da divulgação oficial.
    </p>}
  </div>;
}
