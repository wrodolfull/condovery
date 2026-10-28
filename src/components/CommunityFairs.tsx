'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {ArrowRight,CalendarDays,Check,Gift,ImagePlus,Plus,Store,X} from 'lucide-react';
import {prepareMarketplaceImage} from '@/lib/prepare-marketplace-image';
import {ImageCropper} from '@/components/ImageCropper';

type Fair={id:string;title:string;description:string;cover_image_url:string|null;starts_at:string;ends_at:string;published?:boolean};
type FairProduct={id:string;shop_id:string;shop_name:string;category_id:string;name:string;description:string;price_cents:number;promo_price_cents:number|null;image_url:string|null;stock:number|null;visibility:'available'|'unavailable'|'hidden';lead_time?:string;is_featured?:boolean;is_open?:boolean};
type Application={fair_id:string;product_id:string;status:'pending'|'approved'|'rejected';product_name?:string;shop_name?:string;submitted_at?:string};
type SellerProduct={id:string;name:string};
const dateLabel=(value:string)=>new Date(value).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const localDateTime=(value:string)=>{const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
async function api<T>(path:string,init?:RequestInit):Promise<T>{
 const r=await fetch('/api/'+path,{cache:'no-store',credentials:'same-origin',...init,headers:{'Content-Type':'application/json',...init?.headers}});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.error||'Não foi possível concluir a operação.');
 return data as T;
}
function FairArt({fair}:{fair:Fair}){
 return fair.cover_image_url?<img src={fair.cover_image_url} alt={'Capa de '+fair.title} style={{width:'100%',aspectRatio:'16/7',objectFit:'cover',borderRadius:12}}/>:
   <div style={{borderRadius:12,background:'#282726',color:'white',display:'flex',alignItems:'center',gap:12,padding:24,minHeight:100}}><Gift size={28}/><strong>{fair.title}</strong></div>;
}
export function FairHomeTeaser({condominiumId,onOpen}:{condominiumId:string;onOpen:()=>void}){
 const [fairs,setFairs]=useState<Fair[]>([]);
 useEffect(()=>{let mounted=true;api<{fairs:Fair[]}>('fairs').then(x=>{if(mounted)setFairs(x.fairs);}).catch(()=>{});return()=>{mounted=false;};},[condominiumId]);
 if(!fairs.length)return null;
 return <section className="admin-section" aria-label="Feiras do condomínio" style={{margin:'20px 0'}}>
   <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,marginBottom:12}}>
     <h2>Feiras da vizinhança</h2><button type="button" className="outline-button" onClick={onOpen}>Ver feiras <ArrowRight size={16}/></button>
   </div>
   <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,220px),1fr))',gap:12}}>
     {fairs.slice(0,3).map(f=><button type="button" key={f.id} className="white-panel" style={{textAlign:'left',border:'1px solid #eee',padding:12,borderRadius:14}} onClick={onOpen}>
       <FairArt fair={f}/><strong style={{display:'block',marginTop:9}}>{f.title}</strong><small>Até {dateLabel(f.ends_at)}</small>
     </button>)}
   </div>
 </section>;
}
export function FairMarketplace({condominiumId,onOpenProduct}:{condominiumId:string;onOpenProduct:(p:FairProduct)=>void}){
 const [fairs,setFairs]=useState<Fair[]>([]),[selected,setSelected]=useState<string|null>(null);
 const [detail,setDetail]=useState<{fair:Fair;products:FairProduct[]}|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let mounted=true;setSelected(null);setLoading(true);
   api<{fairs:Fair[]}>('fairs').then(x=>{if(mounted)setFairs(x.fairs);})
     .catch(e=>{if(mounted)setError(e.message);}).finally(()=>{if(mounted)setLoading(false);});
   return()=>{mounted=false;};},[condominiumId]);
 useEffect(()=>{if(!selected){setDetail(null);return;}let active=true;setLoading(true);setDetail(null);
   api<{fair:Fair;products:FairProduct[]}>('fairs/'+selected).then(x=>{if(active)setDetail(x);})
     .catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
   return()=>{active=false;};},[selected,condominiumId]);
 return <section className="admin-section">
   <h1>Feiras do condomínio</h1>
   <p className="muted">Produtos escolhidos pela comunidade, vendidos diretamente pelas lojas participantes.</p>
   {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
   {loading&&<p className="muted">Carregando feiras...</p>}
   {detail?<div style={{marginTop:20}}>
     <button type="button" className="back-link" onClick={()=>setSelected(null)}>Ver todas as feiras</button>
     <FairArt fair={detail.fair}/>
     <h2 style={{marginTop:16}}>{detail.fair.title}</h2><p>{detail.fair.description}</p>
     <p className="muted"><CalendarDays size={15}/> {dateLabel(detail.fair.starts_at)} até {dateLabel(detail.fair.ends_at)}</p>
     {detail.products.length?<div className="product-grid" style={{marginTop:18}}>
       {detail.products.map(p=><article key={p.id} className="white-panel" style={{padding:12,borderRadius:14}}>
         {p.image_url&&<img src={p.image_url} alt={p.name} style={{width:'100%',aspectRatio:'5/4',objectFit:'cover',borderRadius:10}}/>}
         <small>{p.shop_name}</small><strong style={{display:'block'}}>{p.name}</strong>
         <p>{money(p.promo_price_cents??p.price_cents)}</p>
         <button type="button" className="primary-button" onClick={()=>onOpenProduct(p)}>Ver produto <ArrowRight size={15}/></button>
       </article>)}
     </div>:<p className="muted">Ainda não há produtos disponíveis nesta feira.</p>}
   </div>:!loading&&(fairs.length?<div style={{display:'grid',gap:15,marginTop:18}}>
     {fairs.map(f=><article className="white-panel" key={f.id} style={{padding:16,borderRadius:16}}>
       <FairArt fair={f}/><h2 style={{marginTop:14}}>{f.title}</h2>
       <p>{f.description}</p><p className="muted">Até {dateLabel(f.ends_at)}</p>
       <button type="button" className="primary-button" onClick={()=>setSelected(f.id)}>Explorar feira <ArrowRight size={16}/></button>
     </article>)}
   </div>:<p className="muted">Nenhuma feira acontecendo no momento.</p>)}
 </section>;
}
export function SellerFairs({condominiumId}:{condominiumId:string}){
 const [data,setData]=useState<{fairs:Fair[];products:SellerProduct[];applications:Application[]}|null>(null);
 const [selection,setSelection]=useState<Record<string,string>>({});
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(()=>api<{fairs:Fair[];products:SellerProduct[];applications:Application[]}>('fairs/seller').then(setData),[]);
 useEffect(()=>{setData(null);load().catch(e=>setError(e.message));},[load,condominiumId]);
 async function action(path:string,method:'POST'|'DELETE',body?:unknown){
   setBusy(true);setError('');setNotice('');
   try{await api(path,{method,...(body?{body:JSON.stringify(body)}:{})});await load();setNotice('Participação atualizada.');}
   catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar.');}finally{setBusy(false);}
 }
 return <section className="admin-section white-panel">
   <h2>Participar de feiras</h2>
   <p className="muted">Inscreva produtos disponíveis da sua loja. A administração aprova a participação; o checkout continua sendo o da sua loja.</p>
   {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{notice&&<p role="status">{notice}</p>}
   {!data?<p className="muted">Carregando feiras...</p>:!data.fairs.length?<p className="muted">Nenhuma feira aberta para inscrição.</p>:
   data.fairs.map(f=><div key={f.id} style={{borderTop:'1px solid #e7e2dc',padding:'16px 0'}}>
     <strong>{f.title}</strong><p className="muted">Encerramento: {dateLabel(f.ends_at)}</p>
     {data.applications.filter(a=>a.fair_id===f.id).map(a=><div key={a.product_id} className="admin-row">
       <span>{data.products.find(p=>p.id===a.product_id)?.name??'Produto'} · {a.status==='pending'?'Em análise':a.status==='approved'?'Aprovado':'Não aprovado'}</span>
       <button type="button" disabled={busy} onClick={()=>action('fairs/'+f.id+'/applications/'+a.product_id,'DELETE')}><X size={14}/> Retirar</button>
     </div>)}
     {data.products.filter(p=>!data.applications.some(a=>a.fair_id===f.id&&a.product_id===p.id)).length>0&&<div className="field-grid" style={{marginTop:12}}>
       <label>Produto<select value={selection[f.id]||''} onChange={e=>setSelection(v=>({...v,[f.id]:e.target.value}))}>
         <option value="">Selecione um produto</option>
         {data.products.filter(p=>!data.applications.some(a=>a.fair_id===f.id&&a.product_id===p.id)).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
       </select></label>
       <button type="button" className="outline-button" disabled={busy||!selection[f.id]} onClick={()=>action('fairs/'+f.id+'/applications','POST',{product_id:selection[f.id]})}><Plus size={15}/> Inscrever produto</button>
     </div>}
   </div>)}
 </section>;
}
type AdminData={fairs:Fair[];applications:Application[]};
type Form={title:string;description:string;cover_image_url:string;starts_at:string;ends_at:string;published:boolean};
const empty:Form={title:'',description:'',cover_image_url:'',starts_at:'',ends_at:'',published:false};
export function AdminFairs({condominiumId}:{condominiumId:string}){
 const [data,setData]=useState<AdminData|null>(null),[editing,setEditing]=useState<string|null>(null),[form,setForm]=useState<Form>(empty);
 const [uploading,setUploading]=useState(false),[cropFile,setCropFile]=useState<File|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=useCallback(()=>api<AdminData>('fairs/manage').then(setData),[]);
 useEffect(()=>{setData(null);load().catch(e=>setError(e.message));},[load,condominiumId]);
 function updateForm<K extends keyof Form>(key:K,value:Form[K]){setForm(v=>({...v,[key]:value}));}
 function edit(f:Fair){setEditing(f.id);setForm({title:f.title,description:f.description,cover_image_url:f.cover_image_url||'',starts_at:localDateTime(f.starts_at),ends_at:localDateTime(f.ends_at),published:!!f.published});}
 function clear(){setEditing(null);setForm(empty);setCropFile(null);}
 async function action(callback:()=>Promise<unknown>){
   setBusy(true);setError('');setNotice('');
   try{await callback();await load();setNotice('Feira atualizada com sucesso.');}
   catch(e){setError(e instanceof Error?e.message:'Falha na alteração.');}
   finally{setBusy(false);}
 }
 async function save(event:FormEvent){event.preventDefault();
   if(!form.starts_at||!form.ends_at||new Date(form.ends_at)<=new Date(form.starts_at)){setError('Informe um período válido.');return;}
   await action(async()=>{
     await api(editing?'fairs/manage/'+editing:'fairs/manage',{method:editing?'PATCH':'POST',
       body:JSON.stringify({...form,starts_at:new Date(form.starts_at).toISOString(),ends_at:new Date(form.ends_at).toISOString()})});
     clear();
   });
 }
 async function upload(file:File){setUploading(true);setError('');
   try{const optimized=await prepareMarketplaceImage(file,10);const body=new FormData();body.append('file',optimized);
     const res=await fetch('/api/media/fair',{method:'POST',body,credentials:'same-origin'});
     const data=await res.json();if(!res.ok)throw Error(data.error||'Falha no envio da capa.');
     updateForm('cover_image_url',data.url);
   }catch(e){setError(e instanceof Error?e.message:'Falha no envio.');}finally{setUploading(false);}
 }
 return <section className="admin-section white-panel" style={{marginTop:18}}>
   <h2>Feira digital</h2><p className="muted">Crie vitrines temáticas com prazo de validade. Somente produtos inscritos e aprovados aparecem para os moradores.</p>
   {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{notice&&<p role="status">{notice}</p>}
   <h3 style={{margin:'18px 0'}}>{editing?'Editar feira':'Nova feira'}</h3>
   <form className="form-stack" onSubmit={save}>
     <label>Nome<input required minLength={3} maxLength={100} value={form.title} onChange={e=>updateForm('title',e.target.value)} placeholder="Ex.: Feira de Natal"/></label>
     <label>Descrição<textarea required={false} maxLength={600} rows={3} value={form.description} onChange={e=>updateForm('description',e.target.value)}/></label>
     <label>Capa da feira (opcional; 16:9)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading||busy}
       onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)setCropFile(file);}}/>
       {form.cover_image_url&&<img alt="Prévia da capa" src={form.cover_image_url} style={{width:'100%',maxWidth:420,aspectRatio:'16/9',objectFit:'cover',borderRadius:12,marginTop:10}}/>}
     </label>
     <div className="field-grid">
       <label>Início<input required type="datetime-local" value={form.starts_at} onChange={e=>updateForm('starts_at',e.target.value)}/></label>
       <label>Encerramento<input required type="datetime-local" value={form.ends_at} onChange={e=>updateForm('ends_at',e.target.value)}/></label>
     </div>
     <label style={{display:'flex',gap:8,alignItems:'center'}}><input type="checkbox" checked={form.published} onChange={e=>updateForm('published',e.target.checked)}/> Publicar e abrir inscrições dos vendedores</label>
     <div className="inline-actions"><button className="primary-button" disabled={busy||uploading} type="submit">{editing?'Salvar feira':'Criar feira'}</button>
       {editing&&<button type="button" className="outline-button" onClick={clear}>Cancelar edição</button>}
     </div>
   </form>
   <h3 style={{margin:'24px 0 14px'}}>Feiras cadastradas</h3>
   {!data?<p className="muted">Carregando...</p>:!data.fairs.length?<p className="muted">Nenhuma feira criada.</p>:
   data.fairs.map(f=><div key={f.id} className="admin-row">
     <div style={{flex:'1 1 240px'}}><strong>{f.title}</strong><p>{dateLabel(f.starts_at)} até {dateLabel(f.ends_at)} · {f.published?'Publicada':'Rascunho'}</p>
       {data.applications.filter(a=>a.fair_id===f.id).length>0&&<div style={{marginTop:12}}>
         <strong>Produtos inscritos</strong>
         {data.applications.filter(a=>a.fair_id===f.id).map(a=><div className="admin-row" key={a.product_id}>
           <div><span>{a.product_name} · {a.shop_name}</span><small style={{display:'block'}}>{a.status==='pending'?'Aguardando aprovação':a.status==='approved'?'Aprovado':'Rejeitado'}</small></div>
           <div className="inline-actions">
             {a.status!=='approved'&&<button disabled={busy} onClick={()=>action(()=>api('fairs/manage/'+f.id+'/applications/'+a.product_id,{method:'PATCH',body:JSON.stringify({status:'approved'})}))}><Check size={14}/> Aprovar</button>}
             {a.status!=='rejected'&&<button disabled={busy} onClick={()=>action(()=>api('fairs/manage/'+f.id+'/applications/'+a.product_id,{method:'PATCH',body:JSON.stringify({status:'rejected'})}))}>Rejeitar</button>}
           </div>
         </div>)}
       </div>}
     </div>
     <div className="inline-actions"><button type="button" onClick={()=>edit(f)}>Editar</button>
       <button type="button" disabled={busy} onClick={()=>action(()=>api('fairs/manage/'+f.id,{method:'PATCH',body:JSON.stringify({published:!f.published})}))}>{f.published?'Retirar do ar':'Publicar'}</button>
     </div>
   </div>)}
   {cropFile&&<ImageCropper file={cropFile} kind="ad" onCancel={()=>setCropFile(null)} onApply={file=>{setCropFile(null);void upload(file);}}/>}
 </section>;
}
