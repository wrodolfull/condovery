'use client';
import {prepareMarketplaceImage} from '@/lib/prepare-marketplace-image';
import {ImageCropper} from '@/components/ImageCropper';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
type Campaign={id:string;condominium_id:string;merchant_name:string;headline:string;description:string;location:string;image_url:string;destination_url:string;starts_at:string;expires_at:string;enabled:boolean};
type Tenant={id:string;name:string};
const initial={condominium_id:'',merchant_name:'',headline:'',description:'',location:'Valinhos, SP',image_url:'',destination_url:'',starts_at:'',expires_at:'',enabled:true};
async function request(path:string,init?:RequestInit){
  const response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...init,headers:{'Content-Type':'application/json',...init?.headers}});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Não foi possível concluir a operação.');
  return data;
}
const localDateTime=(value:string)=>{const d=new Date(value);const n=new Date(d.getTime()-d.getTimezoneOffset()*60000);return n.toISOString().slice(0,16);};
const dateLabel=(value:string)=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
export function AdsAdmin({tenants}:{tenants:Tenant[]}){
  const [enabled,setEnabled]=useState(false);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [form,setForm]=useState(initial);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [cropFile,setCropFile]=useState<File|null>(null);
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
  function editCampaign(c:Campaign){
    setEditingId(c.id);setError('');setMessage('');
    setForm({condominium_id:c.condominium_id,merchant_name:c.merchant_name,headline:c.headline,description:c.description,location:c.location,image_url:c.image_url,destination_url:c.destination_url,starts_at:localDateTime(c.starts_at),expires_at:localDateTime(c.expires_at),enabled:c.enabled});
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function cancelEditing(){setEditingId(null);setCropFile(null);setForm(initial);setError('');}
  async function uploadImage(file:File|undefined){
    if(!file)return;
    if(!form.condominium_id){setError('Selecione o condomínio antes de enviar a imagem.');return;}
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){setError('Selecione JPG, PNG ou WebP de até 10 MB.');return;}
    setUploading(true);setError('');
    try{
      const optimized=await prepareMarketplaceImage(file,10);const data=new FormData();data.append('file',optimized);data.append('condominium_id',form.condominium_id);
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
      await request(editingId?'platform/ads/'+editingId:'platform/ads',{method:editingId?'PATCH':'POST',body:JSON.stringify({...form,starts_at:new Date(form.starts_at).toISOString(),expires_at:new Date(form.expires_at).toISOString()})});
      setEditingId(null);setForm({...initial,condominium_id:form.condominium_id});
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
    <h3 style={{marginTop:22}}>{editingId?'Editar anúncio':'Novo anúncio'}</h3>
    <form className="form-stack" onSubmit={submit}>
      <label>Condomínio<select required value={form.condominium_id} onChange={e=>setForm(v=>({...v,condominium_id:e.target.value}))}>
        <option value="">Selecione</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select></label>
      <label>Nome do comércio<input required maxLength={100} value={form.merchant_name} onChange={e=>setForm(v=>({...v,merchant_name:e.target.value}))}/></label>
      <label>Título da oferta<input required maxLength={140} placeholder="Pizza grande com 20% OFF" value={form.headline} onChange={e=>setForm(v=>({...v,headline:e.target.value}))}/></label>
      <label>Descrição curta<textarea required rows={2} maxLength={400} value={form.description} onChange={e=>setForm(v=>({...v,description:e.target.value}))}/></label>
      <label>Localização<input required maxLength={120} value={form.location} onChange={e=>setForm(v=>({...v,location:e.target.value}))}/></label>
      <label>Imagem da publicidade (upload JPG, PNG ou WebP; até 10 MB)
        <input type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading||busy} onChange={e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>10*1024*1024){setError('Selecione JPG, PNG ou WebP de até 10 MB.');return;}setCropFile(f);}}/>
        <small>Formato 16:9 (1200 × 675 recomendado). Ajuste o enquadramento, arraste e use zoom antes do upload. Resultado WebP de até 960 px.</small>
        {uploading&&<small>Enviando imagem...</small>}
        {form.image_url&&<img src={form.image_url} alt="Prévia do anúncio" style={{width:'100%',maxWidth:440,aspectRatio:'16/9',objectFit:'cover',borderRadius:12,marginTop:10}}/>}
      </label>
      <label>Link da oferta / WhatsApp (URL HTTPS)<input required type="url" placeholder="https://wa.me/5519..." value={form.destination_url} onChange={e=>setForm(v=>({...v,destination_url:e.target.value}))}/></label>
      <div className="field-grid">
        <label>Início da publicação<input required type="datetime-local" value={form.starts_at} onChange={e=>setForm(v=>({...v,starts_at:e.target.value}))}/></label>
        <label>Expiração<input required type="datetime-local" value={form.expires_at} onChange={e=>setForm(v=>({...v,expires_at:e.target.value}))}/></label>
      </div>
      <label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={form.enabled} onChange={e=>setForm(v=>({...v,enabled:e.target.checked}))}/> Anúncio habilitado</label>
      <div className="inline-actions"><button className="primary-button" type="submit" disabled={busy||uploading||!form.image_url}>{editingId?'Salvar alterações':'Cadastrar anúncio'}</button>{editingId&&<button type="button" className="outline-button" disabled={busy||uploading} onClick={cancelEditing}>Cancelar edição</button>}</div>
    </form>
    <h3 style={{marginTop:24}}>Campanhas cadastradas</h3>
    {campaigns.length===0?<p className="muted">Nenhum anúncio cadastrado.</p>:campaigns.map(c=><div key={c.id} className="admin-row">
      <div><strong>{c.merchant_name} — {c.headline}</strong>
        <p>{tenants.find(t=>t.id===c.condominium_id)?.name||'Condomínio'} · {dateLabel(c.starts_at)} até {dateLabel(c.expires_at)}</p>
        <small>{c.enabled?'Habilitado':'Pausado'} · {new Date(c.expires_at)<=new Date()?'Expirado':new Date(c.starts_at)>new Date()?'Agendado':'Período vigente'}</small>
      </div>
      <div className="inline-actions">
        <button disabled={busy} type="button" onClick={()=>editCampaign(c)}>Editar</button>
        <button disabled={busy} type="button" onClick={()=>perform(()=>request('platform/ads/'+c.id,{method:'PATCH',body:JSON.stringify({enabled:!c.enabled})}))}>{c.enabled?'Pausar':'Ativar'}</button>
        <button className="danger-text" disabled={busy} type="button" onClick={()=>{if(window.confirm('Excluir este anúncio?'))perform(()=>request('platform/ads/'+c.id,{method:'DELETE'}));}}>Excluir</button>
      </div>
    </div>)}
    {cropFile&&<ImageCropper file={cropFile} kind="ad" onCancel={()=>setCropFile(null)} onApply={file=>{setCropFile(null);void uploadImage(file);}}/>}
  </section>;
}
