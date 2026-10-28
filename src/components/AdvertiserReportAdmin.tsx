'use client';
import {useCallback,useEffect,useState} from 'react';
import {ArrowLeft,Copy,Link2,ShieldCheck,Trash2} from 'lucide-react';
import {AdvertiserReportView} from './AdvertiserReportView';

type Share={id:string;created_at:string;expires_at:string;revoked_at:string|null};
const labelDate=(s:string)=>new Date(s).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
export function AdvertiserReportAdmin({campaignId,onBack}:{campaignId:string;onBack:()=>void}){
  const [shares,setShares]=useState<Share[]>([]);
  const [days,setDays]=useState<7|30|90>(30);
  const [newUrl,setNewUrl]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const base='/api/platform/ads/'+campaignId+'/report/shares';
  const reload=useCallback(async()=>{
    const res=await fetch(base,{credentials:'same-origin',cache:'no-store'});
    const data=await res.json();
    if(!res.ok)throw Error(data.error||'Não foi possível carregar links.');
    setShares(data.shares);
  },[base]);
  useEffect(()=>{setNewUrl('');setError('');reload().catch(e=>setError(e.message));},[reload]);
  async function create(){
    setBusy(true);setError('');setMessage('');
    try{
      const res=await fetch(base,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({days})});
      const data=await res.json();
      if(!res.ok)throw Error(data.error||'Falha ao criar link.');
      const url=new URL('/relatorio/ads/'+data.token,window.location.origin).toString();
      setNewUrl(url);setMessage('Link criado. Copie-o e compartilhe com o anunciante.');
      await reload();
    }catch(e){setError(e instanceof Error?e.message:'Falha ao criar link.');}
    finally{setBusy(false);}
  }
  async function revoke(id:string){
    if(!window.confirm('Revogar este link? O anunciante perderá o acesso imediatamente.'))return;
    setBusy(true);setError('');setMessage('');
    try{
      const res=await fetch(base+'/'+id,{method:'DELETE',credentials:'same-origin'});
      const data=await res.json();
      if(!res.ok)throw Error(data.error||'Não foi possível revogar o link.');
      setNewUrl('');setMessage('Acesso ao relatório revogado.');await reload();
    }catch(e){setError(e instanceof Error?e.message:'Falha ao revogar.');}
    finally{setBusy(false);}
  }
  async function copy(){
    try{await navigator.clipboard.writeText(newUrl);setMessage('Link copiado.');}
    catch{window.prompt('Copie o link do relatório:',newUrl);}
  }
  return <div className="adreport-admin">
    <button type="button" className="back-link" onClick={onBack}><ArrowLeft size={17}/> Voltar às campanhas</button>
    <AdvertiserReportView campaignId={campaignId}/>
    <section className="adreport-share-box">
      <h3><ShieldCheck size={19}/> Compartilhar com o anunciante</h3>
      <p>O link permite consultar somente os resultados desta campanha, sem login e sem acesso aos dados comerciais. Você poderá revogá-lo a qualquer momento.</p>
      <div className="adreport-share-form">
        <label>Validade<select value={days} onChange={e=>setDays(Number(e.target.value) as 7|30|90)}>
          <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
        </select></label>
        <button type="button" className="primary-button" disabled={busy} onClick={()=>void create()}><Link2 size={16}/> Criar link seguro</button>
      </div>
      {error&&<p role="alert" className="adreport-error">{error}</p>}
      {message&&<p role="status" className="muted">{message}</p>}
      {newUrl&&<div className="adreport-created"><label>Link para o anunciante
        <input type="text" readOnly value={newUrl} onFocus={e=>e.target.select()}/>
        </label><button className="outline-button" type="button" onClick={()=>void copy()}><Copy size={15}/> Copiar link</button>
        <small>Por segurança, o endereço completo aparece apenas agora. Links antigos podem ser revogados abaixo.</small>
      </div>}
      <h4>Links gerados</h4>
      {shares.length===0?<p className="muted">Nenhum link compartilhado.</p>:shares.map(share=>{
        const expired=new Date(share.expires_at)<=new Date();
        const active=!expired&&!share.revoked_at;
        return <div className="adreport-share-row" key={share.id}><div><strong>{active?'Ativo':share.revoked_at?'Revogado':'Expirado'}</strong>
          <small>Criado em {labelDate(share.created_at)} · Válido até {labelDate(share.expires_at)}</small></div>
          {active&&<button className="danger-text" type="button" disabled={busy} onClick={()=>void revoke(share.id)}><Trash2 size={15}/> Revogar</button>}
        </div>;
      })}
    </section>
  </div>;
}
