'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
type Campaign={id:string;condominium_id:string;merchant_name:string;headline:string;starts_at:string;expires_at:string;enabled:boolean};
type Tenant={id:string;name:string};
const initial={condominium_id:'',merchant_name:'',headline:'',description:'',location:'Valinhos, SP',image_url:'',destination_url:'',starts_at:'',expires_at:'',enabled:true};
async function request(path:string,init?:RequestInit){
  const response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...init,headers:{'Content-Type':'application/json',...init?.headers}});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Não foi possível concluir a operação.');
  return data;
}
const dateLabel=(value:string)=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
export function AdsAdmin({tenants}:{tenants:Tenant[]}){
  const [enabled,setEnabled]=useState(false);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [form,setForm]=useState(initial);
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const reload=useCallback(async()=>{
    const data=await request('platform/ads');
    setEnabled(data.enabled);setCampaigns(data.campaigns);
  },[]);
  useEffect(()=>{reload().catch(e=>setError(e.message));},[reload]);
  async function perform(action:()=>Promise<unknown>){
    setBusy(true);setError('');setMessage('');
    try{await action();await reload();setMessage('Alterações salvas.');}
    catch(e){setError(e instanceof Error?e.message:'Erro ao salvar.');}
    finally{setBusy(false);}
  }
  async function uploadImage(file:File|undefined){
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){setError('Selecione JPG, PNG ou WebP de até 10 MB.');return;}
    setUploading(true);setError('');
    try{
      const data=new FormData();data.append('file',file);
      const res=await fetch('/api/media/ad',{method:'POST',body:data});
      const result=await res.json();
      if(!res.ok)throw new Error(result.error||'Erro no upload.');
      setForm(v=>({...v,image_url:result.url}));
    }catch(e){setError(e instanceof Error?e.message:'Erro no upload.');}finally{setUploading(false);}
  }
  async function submit(e:FormEvent){
    e.preventDefault();
    if(new Date(form.expires_at)<=new Date(form.starts_at)){setError('A expiração deve ser posterior ao início.');return;}
    await perform(async()=>{
      await request('platform/ads',{method:'POST',body:JSON.stringify({...form,starts_at:new Date(form.starts_at).toISOString(),expires_at:new Date(form.expires_at).toISOString()})});
      setForm({...initial,condominium_id:form.condominium_id});
    });
  }
  return <section className="admin-section white-panel" style={{marginTop:24}}>
    <h2>Condovery Ads</h2>
    <p className="muted">Ative a publicidade para substituir “Achadinhos da vizinhança” somente quando existirem anúncios habilitados e dentro do período de publicação.</p>
    <label style={{display:'flex',gap:9,alignItems:'center',margin:'15px 0'}}>
      <input type="checkbox" checked={enabled} disabled={busy} onChange={e=>perform(()=>request('platform/ads/settings',{method:'PATCH',body:JSON.stringify({enabled:e.target.checked})}))}/>
      <strong>Habilitar Condovery Ads</strong>
    </label>
    {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
    {message&&<p role="status">{message}</p>}
    <h3 style={{marginTop:22}}>Novo anúncio</h3>
    <form className="form-stack" onSubmit={submit}>
      <label>Condomínio<select required value={form.condominium_id} onChange={e=>setForm(v=>({...v,condominium_id:e.target.value}))}>
        <option value="">Selecione</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select></label>
      <label>Nome do comércio<input required maxLength={100} value={form.merchant_name} onChange={e=>setForm(v=>({...v,merchant_name:e.target.value}))}/></label>
      <label>Título da oferta<input required maxLength={140} placeholder="Pizza grande com 20% OFF" value={form.headline} onChange={e=>setForm(v=>({...v,headline:e.target.value}))}/></label>
      <label>Descrição curta<textarea required rows={2} maxLength={400} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>
      <label>Localização<input required maxLength={120} value={form.location} onChange={e=>setForm(v=>({...v,location:e.target.value}))}/></label>
      <label>Imagem da publicidade (upload JPG, PNG ou WebP; até 10 MB)
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading||busy} onChange={e=>uploadImage(e.target.files?.[0])}/>
        <small>Recomendado: 1200 × 675 pixels (16:9), ideal para o card horizontal. A imagem será otimizada para WebP, com tamanho máximo de 960 px.</small>
        {uploading&&<small>Enviando imagem...</small>}
        {form.image_url&&<img src={form.image_url} alt="Prévia do anúncio" style={{width:'100%',maxWidth:440,aspectRatio:'16/9',objectFit:'cover',borderRadius:12,marginTop:10}}/>}
      </label>
      <label>Link da oferta / WhatsApp (URL HTTPS)<input required type="url" placeholder="https://wa.me/5519..." value={form.destination_url} onChange={e=>setForm(v=>({...v,destination_url:e.target.value}))}/></label>
      <div className="field-grid">
        <label>Início da publicação<input required type="datetime-local" value={form.starts_at} onChange={e=>setForm(v=>({...v,starts_at:e.target.value}))}/></label>
        <label>Expiração<input required type="datetime-local" value={form.expires_at} onChange={e=>setForm(v=>({...v,expires_at:e.target.value}))}/></label>
      </div>
      <label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={form.enabled} onChange={e=>setForm(v=>({...v,enabled:e.target.checked}))}/> Anúncio habilitado</label>
      <button className="primary-button" type="submit" disabled={busy||uploading||!form.image_url}>Cadastrar anúncio</button>
    </form>
    <h3 style={{marginTop:24}}>Campanhas cadastradas</h3>
    {campaigns.length===0?<p className="muted">Nenhum anúncio cadastrado.</p>:campaigns.map(c=><div key={c.id} className="admin-row">
      <div><strong>{c.merchant_name} — {c.headline}</strong>
        <p>{tenants.find(t=>t.id===c.condominium_id)?.name||'Condomínio'} · {dateLabel(c.starts_at)} até {dateLabel(c.expires_at)}</p>
        <small>{c.enabled?'Habilitado':'Pausado'} · {new Date(c.expires_at)<=new Date()?'Expirado':new Date(c.starts_at)>new Date()?'Agendado':'Período vigente'}</small>
      </div>
      <div className="inline-actions">
        <button disabled={busy} type="button" onClick={()=>perform(()=>request('platform/ads/'+c.id,{method:'PATCH',body:JSON.stringify({enabled:!c.enabled})}))}>{c.enabled?'Pausar':'Ativar'}</button>
        <button className="danger-text" disabled={busy} type="button" onClick={()=>{if(window.confirm('Excluir este anúncio?'))perform(()=>request('platform/ads/'+c.id,{method:'DELETE'}));}}>Excluir</button>
      </div>
    </div>)}
  </section>;
}
