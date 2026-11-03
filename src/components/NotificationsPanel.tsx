'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import {Bell,Check,ChevronRight} from 'lucide-react';

export type InboxNotice={
  id:string;kind:string;title:string;body:string;
  target_id:string|null;read_at:string|null;created_at:string;
};
type Api=<T>(path:string,options?:RequestInit)=>Promise<T>;
type InboxResult={notifications:InboxNotice[];hasMore:boolean};
type PreferencesResult={preferences:{
  condominium:boolean;orders:boolean;seller_orders:boolean;discovery:boolean;
};is_seller:boolean};

export function NotificationsPanel({api,scope,onUnreadChange,onOpen,onPreferences}:{
  api:Api;scope:string;onUnreadChange:()=>void;
  onOpen:(notice:InboxNotice)=>void;onPreferences:()=>void;
}) {
  const [items,setItems]=useState<InboxNotice[]>([]);
  const [page,setPage]=useState(0);
  const [hasMore,setHasMore]=useState(false);
  const [loading,setLoading]=useState(true);
  const [clearing,setClearing]=useState(false);
  const [error,setError]=useState('');
  const revision=useRef(0);
  const load=useCallback(async(nextPage:number)=>{
    const version=++revision.current;
    setLoading(true);setError('');
    try {
      const result=await api<InboxResult>('push/inbox?limit=10&page='+nextPage);
      if(version!==revision.current)return;
      setItems(previous=>{
        if(nextPage===0)return result.notifications;
        const seen=new Set(previous.map(n=>n.id));
        return [...previous,...result.notifications.filter(n=>!seen.has(n.id))];
      });
      setPage(nextPage);setHasMore(result.hasMore);
    }catch(e){
      if(version===revision.current)
        setError(e instanceof Error?e.message:'Não foi possível carregar os avisos.');
    }finally{if(version===revision.current)setLoading(false);}
  },[api]);
  useEffect(()=>{
    void load(0);
    return()=>{revision.current++;};
  },[load,scope]);
  const read=async(notice:InboxNotice)=>{
    try {
      if(!notice.read_at){
        await api('push/inbox/'+encodeURIComponent(notice.id),{method:'PATCH'});
        setItems(previous=>previous.map(n=>n.id===notice.id?{...n,read_at:new Date().toISOString()}:n));
        onUnreadChange();
      }
      onOpen(notice);
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível abrir o aviso.');}
  };
  const clearAll=async()=>{
    if(clearing||!items.length||!window.confirm(
      'Apagar todas as notificações desta conta, inclusive as não lidas? Esta ação não pode ser desfeita.'
    ))return;
    // Ignore a previous page response arriving after the deletion.
    revision.current++;
    setClearing(true);setError('');
    try {
      await api('push/inbox',{method:'DELETE'});
      setItems([]);setPage(0);setHasMore(false);onUnreadChange();
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível limpar os avisos.');}
    finally{setClearing(false);}
  };
  return <section className="notification-page">
    <div className="notification-page-title">
      <h1>Notificações</h1>
      {items.length>0&&<button type="button" className="notification-clear" disabled={clearing}
        onClick={()=>void clearAll()}>{clearing?'Limpando...':'Limpar tudo'}</button>}
    </div>
    {error&&<div className="global-alert" role="alert">{error}
      <button className="quiet-link" type="button" onClick={()=>void load(page)}>Tentar novamente</button>
    </div>}
    <div className="notification-list">
      {items.map(notice=><button type="button" key={notice.id}
        className={'notification-card'+(!notice.read_at?' is-unread':'')}
        onClick={()=>void read(notice)}>
        <strong>{notice.title}</strong>
        <span>{notice.body}</span>
        <small>{new Date(notice.created_at).toLocaleString('pt-BR')}</small>
      </button>)}
      {!loading&&!items.length&&!error&&
        <div className="white-panel notification-empty"><Bell size={25}/>
          <strong>Tudo em dia por aqui</strong>
          <span>Os avisos do condomínio e as atualizações de pedidos aparecerão aqui.</span>
        </div>}
    </div>
    {loading&&<p className="muted" role="status">Carregando notificações...</p>}
    {hasMore&&<button type="button" className="outline-button notification-more"
      disabled={loading||clearing} onClick={()=>void load(page+1)}>Mostrar mais</button>}
    <button type="button" className="outline-button notification-preferences-link" onClick={onPreferences}>
      Preferências de notificações <ChevronRight size={17}/>
    </button>
  </section>;
}

export function NotificationPreferencesPanel({api,scope}:{
  api:Api;scope:string;
}) {
  const [data,setData]=useState<PreferencesResult|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    void api<PreferencesResult>('push/preferences')
      .then(result=>{if(active)setData(result);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível carregar as preferências.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[api,scope]);
  const change=async(key:keyof PreferencesResult['preferences'])=>{
    if(!data||saving)return;
    setSaving(true);setError('');
    const preferences={...data.preferences,[key]:!data.preferences[key]};
    try {
      await api('push/preferences',{method:'PATCH',body:JSON.stringify(preferences)});
      setData(previous=>previous?{...previous,preferences}:previous);
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar.');}
    finally{setSaving(false);}
  };
  const options:{key:keyof PreferencesResult['preferences'];label:string}[]=[
    {key:'condominium',label:'Avisos do condomínio'},
    {key:'orders',label:'Atualizações dos meus pedidos'},
    {key:'seller_orders',label:'Pedidos, avaliações e pendências da minha loja'},
    {key:'discovery',label:'Novidades e descobertas da vizinhança (opcional)'},
  ];
  return <section className="notification-page">
    <h1>Fique por dentro da vizinhança</h1>
    <p className="muted">Escolha os avisos que deseja receber. No aplicativo, você também pode ativar ou desativar as notificações do aparelho.</p>
    {error&&<div role="alert" className="alert">{error}</div>}
    {loading&&<p role="status">Carregando preferências...</p>}
    {data&&<div className="notification-preference-list">
      {options.filter(o=>o.key!=='seller_orders'||data.is_seller).map(option=>
        <button key={option.key} type="button" className="notification-preference"
          role="switch" aria-checked={data.preferences[option.key]??false}
          aria-label={option.label} disabled={saving}
          onClick={()=>void change(option.key)}>
          <span>{option.label}</span>
          <span className={'notification-switch'+(data.preferences[option.key]?' is-on':'')} aria-hidden="true">
            {data.preferences[option.key]&&<Check size={13}/>}
          </span>
        </button>
      )}
    </div>}
  </section>;
}
