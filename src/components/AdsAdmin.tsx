'use client';
import {prepareMarketplaceImage} from '@/lib/prepare-marketplace-image';
import {ImageCropper} from '@/components/ImageCropper';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
type Campaign={id:string;condominium_id:string;merchant_name:string;headline:string;description:string;location:string;image_url:string;destination_url:string;starts_at:string;expires_at:string;enabled:boolean;contract_amount_cents:number;billing_status:'pending'|'invoiced'|'paid';commercial_partner:string;impressions:number;clicks:number};
type AdsReport={condominiums:{condominium_id:string;condominium_name:string;campaigns:number;contracted_cents:string;received_cents:string;impressions:string;clicks:string}[];partners:{commercial_partner:string;campaigns:number;contracted_cents:string;received_cents:string}[];totals:{campaigns:number;contracted_cents:string;received_cents:string}};
const brl=(n:number|string)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n||0)/100);
type Tenant={id:string;name:string};
const initial={condominium_id:'',merchant_name:'',headline:'',description:'',location:'Valinhos, SP',image_url:'',destination_url:'',starts_at:'',expires_at:'',enabled:true,contract_amount_cents:0,billing_status:'pending' as 'pending'|'invoiced'|'paid',commercial_partner:''};
async function request(path:string,init?:RequestInit){
  const response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...init,headers:{'Content-Type':'application/json',...init?.headers}});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||'Não foi possível concluir a operação.');
  return data;
}
const localDateTime=(value:string)=>{const d=new Date(value);const n=new Date(d.getTime()-d.getTimezoneOffset()*60000);return n.toISOString().slice(0,16);};
const dateLabel=(value:string)=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
export function AdsAdmin({tenants}:{tenants:Tenant[]}){
  const [tab,setTab]=useState<'campaigns'|'new'|'reports'>('campaigns');
  const [enabled,setEnabled]=useState(false);
  const [campaigns,setCampaigns]=useState<Campaign[]>([]);
  const [report,setReport]=useState<AdsReport|null>(null);
  const [tenantFilter,setTenantFilter]=useState('all');
  const [billingFilter,setBillingFilter]=useState('all');
  const [statusFilter,setStatusFilter]=useState('all');
  const [page,setPage]=useState(0);
  const [totalPages,setTotalPages]=useState(1);
  const [total,setTotal]=useState(0);
  const [form,setForm]=useState(initial);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [cropFile,setCropFile]=useState<File|null>(null);
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const reload=useCallback(async()=>{
    const params=new URLSearchParams({page:String(page),condominium:tenantFilter,billing:billingFilter,status:statusFilter});
    const data=await request('platform/ads?'+params);
    setEnabled(data.enabled);setCampaigns(data.campaigns);setTotalPages(data.totalPages);setTotal(data.total);
  },[page,tenantFilter,billingFilter,statusFilter]);
  useEffect(()=>{if(tab==='campaigns')reload().catch(e=>setError(e.message));},[reload,tab]);
  useEffect(()=>{if(tab==='reports'&&!report)request('platform/ads/reports').then(setReport).catch(e=>setError(e.message));},[tab,report]);
  async function perform(action:()=>Promise<unknown>){
    setBusy(true);setError('');setMessage('');
    try{await action();await reload();setReport(null);setMessage('Alterações salvas.');}
    catch(e){setError(e instanceof Error?e.message:'Erro ao salvar.');}
    finally{setBusy(false);}
  }
  function editCampaign(c:Campaign){
    setEditingId(c.id);setError('');setMessage('');
    setForm({condominium_id:c.condominium_id,merchant_name:c.merchant_name,headline:c.headline,description:c.description,location:c.location,image_url:c.image_url,destination_url:c.destination_url,starts_at:localDateTime(c.starts_at),expires_at:localDateTime(c.expires_at),enabled:c.enabled,contract_amount_cents:c.contract_amount_cents,billing_status:c.billing_status,commercial_partner:c.commercial_partner});
    setTab('new');
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
      const data={...form,starts_at:new Date(form.starts_at).toISOString(),expires_at:new Date(form.expires_at).toISOString()};
      const payload:Record<string,unknown>={...data};
      // Existing legacy HTTPS image URLs may remain unchanged, but new uploads must be private media.
      if(editingId&&form.image_url.startsWith('https://'))delete payload.image_url;
      await request(editingId?'platform/ads/'+editingId:'platform/ads',{method:editingId?'PATCH':'POST',body:JSON.stringify(payload)});
      setEditingId(null);setForm({...initial,condominium_id:form.condominium_id});setTab('campaigns');
    });
  }
  const filtered=campaigns;
  return <section className="admin-section white-panel management-ads">
    <h2>Condovery Ads</h2>
    <p className="muted">Ative a publicidade para substituir “Achadinhos da vizinhança” somente quando existirem anúncios habilitados e dentro do período de publicação.</p>
    <label style={{display:'flex',gap:9,alignItems:'center',margin:'15px 0'}}>
      <input type="checkbox" checked={enabled} disabled={busy} onChange={e=>perform(()=>request('platform/ads/settings',{method:'PATCH',body:JSON.stringify({enabled:e.target.checked})}))}/>
      <strong>Habilitar Condovery Ads</strong>
    </label>
    {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
    {message&&<p role="status">{message}</p>}
    <nav className="management-tabs" aria-label="Seções ADS">{([['campaigns','Campanhas'],['new',editingId?'Editar campanha':'Nova campanha'],['reports','Relatórios']] as const).map(([key,label])=><button type="button" key={key} className={tab===key?'selected':''} onClick={()=>setTab(key)}>{label}</button>)}</nav>
    {tab==='reports'&&report&&<div style={{margin:'12px 0',padding:12,border:'1px solid #e4e4e4',borderRadius:12}}>
      <h3>Resumo comercial</h3>
      <p>{report.totals.campaigns} campanhas · Contratado: <strong>{brl(report.totals.contracted_cents)}</strong> · Marcado como recebido: <strong>{brl(report.totals.received_cents)}</strong></p>
      <h4 style={{marginTop:16}}>Por condomínio</h4>
      {report.condominiums.map(row=><p key={row.condominium_id} style={{margin:'7px 0'}}><strong>{row.condominium_name}</strong> · {row.campaigns} anúncios · {Number(row.impressions)} impressões únicas/dia somadas · {Number(row.clicks)} cliques únicos/dia somados · {brl(row.contracted_cents)} contratado · {brl(row.received_cents)} recebido</p>)}
      {report.partners.length>0&&<><h4 style={{marginTop:16}}>Por parceiro comercial (informativo)</h4>
        {report.partners.map(row=><p key={row.commercial_partner} style={{margin:'7px 0'}}><strong>{row.commercial_partner}</strong> · {row.campaigns} anúncios · {brl(row.contracted_cents)} contratado · {brl(row.received_cents)} recebido</p>)}</>}
      <small className="muted">Valores e pagamentos são preenchidos manualmente; não há cobrança integrada. Métricas deduplicadas por sessão e dia UTC.</small>
    </div>}
    {tab==='new'&&<><h3 style={{marginTop:14}}>{editingId?'Editar anúncio':'Novo anúncio'}</h3>
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
      <div className="field-grid">
        <label>Valor contratado (R$)
          <input type="number" min={0} step="0.01" value={form.contract_amount_cents/100}
            onChange={e=>setForm(v=>({...v,contract_amount_cents:Math.max(0,Math.round(Number(e.target.value)*100))}))}/>
        </label>
        <label>Situação do faturamento<select value={form.billing_status} onChange={e=>setForm(v=>({...v,billing_status:e.target.value as typeof v.billing_status}))}>
          <option value="pending">Pendente</option><option value="invoiced">Faturado</option><option value="paid">Pago</option>
        </select></label>
      </div>
      <label>Parceiro comercial (opcional)<input maxLength={120} value={form.commercial_partner} placeholder="Revendedor / parceiro de indicação"
        onChange={e=>setForm(v=>({...v,commercial_partner:e.target.value}))}/></label>
      <small className="muted">O campo de parceiro é somente referência comercial. Não libera acesso de revendedor.</small>
      <label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={form.enabled} onChange={e=>setForm(v=>({...v,enabled:e.target.checked}))}/> Anúncio habilitado</label>
      <div className="inline-actions"><button className="primary-button" type="submit" disabled={busy||uploading||!form.image_url}>{editingId?'Salvar alterações':'Cadastrar anúncio'}</button>{editingId&&<button type="button" className="outline-button" disabled={busy||uploading} onClick={cancelEditing}>Cancelar edição</button>}</div>
    </form>
    </>}
    {tab==='campaigns'&&<><h3 style={{marginTop:14}}>Campanhas cadastradas</h3>
    <div className="field-grid" style={{margin:'14px 0'}}>
      <label>Filtrar condomínio<select value={tenantFilter} onChange={e=>{setTenantFilter(e.target.value);setPage(0);}}>
        <option value="all">Todos</option>{tenants.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
      </select></label>
      <label>Filtrar faturamento<select value={billingFilter} onChange={e=>{setBillingFilter(e.target.value);setPage(0);}}>
        <option value="all">Todos</option><option value="pending">Pendente</option>
        <option value="invoiced">Faturado</option><option value="paid">Pago</option>
      </select></label>
    </div>
    <label>Situação<select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(0);}}><option value="all">Todas</option><option value="active">Em andamento</option><option value="scheduled">Programadas</option><option value="paused">Pausadas</option><option value="expired">Expiradas</option></select></label>
    <p className="muted">{total} campanhas encontradas · página {page+1} de {totalPages}</p>
    {filtered.length===0?<p className="muted">Nenhum anúncio encontrado.</p>:filtered.map(c=><div key={c.id} className="admin-row">
      <div><strong>{c.merchant_name} — {c.headline}</strong>
        <p>{tenants.find(t=>t.id===c.condominium_id)?.name||'Condomínio'} · {dateLabel(c.starts_at)} até {dateLabel(c.expires_at)}</p>
        <small>{c.enabled?'Habilitado':'Pausado'} · {new Date(c.expires_at)<=new Date()?'Expirado':new Date(c.starts_at)>new Date()?'Agendado':'Período vigente'} · {c.billing_status==='paid'?'Pago':c.billing_status==='invoiced'?'Faturado':'Pagamento pendente'}</small>
        <p>Contrato: {brl(c.contract_amount_cents)} · Impressões únicas/dia somadas: {c.impressions} · Cliques únicos/dia somados: {c.clicks} · CTR aproximado: {c.impressions?(100*c.clicks/c.impressions).toFixed(1):'0,0'}%</p>
      </div>
      <div className="inline-actions">
        <button disabled={busy} type="button" onClick={()=>editCampaign(c)}>Editar</button>
        <button disabled={busy} type="button" onClick={()=>perform(()=>request('platform/ads/'+c.id,{method:'PATCH',body:JSON.stringify({enabled:!c.enabled})}))}>{c.enabled?'Pausar':'Ativar'}</button>
        <button className="danger-text" disabled={busy} type="button" onClick={()=>{if(window.confirm('Excluir este anúncio?'))perform(()=>request('platform/ads/'+c.id,{method:'DELETE'}));}}>Excluir</button>
      </div>
    </div>)}
    {totalPages>1&&<div className="inline-actions"><button type="button" className="outline-button" disabled={busy||page===0} onClick={()=>setPage(v=>v-1)}>Anterior</button><span>Página {page+1} / {totalPages}</span><button type="button" className="outline-button" disabled={busy||page>=totalPages-1} onClick={()=>setPage(v=>v+1)}>Próxima</button></div>}
    </>}
    {cropFile&&<ImageCropper file={cropFile} kind="ad" onCancel={()=>setCropFile(null)} onApply={file=>{setCropFile(null);void uploadImage(file);}}/>}
  </section>;
}
