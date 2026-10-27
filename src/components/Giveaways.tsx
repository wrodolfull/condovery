'use client';
import {prepareMarketplaceImage} from '@/lib/prepare-marketplace-image';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {Gift,Plus,X,MessageCircle} from 'lucide-react';
type Item={id:string;user_id:string;title:string;description:string;image_url:string|null;status:'available'|'reserved'|'donated';owner_name:string;contact_whatsapp:string|null;created_at:string};
async function request(path:string,init?:RequestInit){
 const response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...init,headers:{'Content-Type':'application/json',...init?.headers}});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Erro de comunicação.');return data;
}
export function Giveaways({viewerId}:{viewerId:string}){
 const [items,setItems]=useState<Item[]>([]);
 const [loading,setLoading]=useState(true);
 const [loaded,setLoaded]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const current=items.find(item=>item.id===selected);
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[image,setImage]=useState(''),[whatsapp,setWhatsapp]=useState('');
 const [uploading,setUploading]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[newItem,setNewItem]=useState(false);
 const load=useCallback(async()=>{
   const result=await request('giveaways');
   setItems(result.items);
   setLoaded(true);
 },[]);
 useEffect(()=>{
   let active=true;
   setLoading(true);
   request('giveaways').then(result=>{
     if(active){setItems(result.items);setLoaded(true);setError('');}
   }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Falha ao carregar desapegos.');})
     .finally(()=>{if(active)setLoading(false);});
   return ()=>{active=false;};
 },[]);
 async function act(action:()=>Promise<unknown>){
  setBusy(true);setError('');
  try{await action();await load();}catch(e){setError(e instanceof Error?e.message:'Erro ao atualizar.');}finally{setBusy(false);}
 }
 async function updateStatus(item:Item,status:Item['status']){
   if(status===item.status)return;
   if(status==='donated'&&!window.confirm('Confirmar doação? O anúncio e a foto serão excluídos automaticamente após 48 horas.'))return;
   await act(async()=>{
     await request('giveaways/'+item.id,{method:'PATCH',body:JSON.stringify({status})});
   });
 }
 async function deleteItem(item:Item){
   if(!window.confirm('Excluir este anúncio definitivamente?'))return;
   await act(async()=>{
     await request('giveaways/'+item.id,{method:'DELETE'});
     setSelected(null);
   });
 }
 async function uploadImage(file:File|undefined){
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('Use JPG, PNG ou WebP de até 5 MB.');return;}
  setUploading(true);setError('');
  try{const optimized=await prepareMarketplaceImage(file,5);const data=new FormData();data.append('file',optimized);
    const response=await fetch('/api/media/giveaway',{method:'POST',body:data});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Não foi possível enviar a foto.');
    setImage(result.url);
  }catch(e){setError(e instanceof Error?e.message:'Erro no upload.');}finally{setUploading(false);}
 }
 async function submit(e:FormEvent){
  e.preventDefault();
  await act(async()=>{await request('giveaways',{method:'POST',body:JSON.stringify({title,description,image_url:image,contact_whatsapp:whatsapp})});setTitle('');setDescription('');setImage('');setWhatsapp('');setNewItem(false);});
 }
 return <section style={{paddingBottom:30}}>
  <div className="section-heading"><h2>Desapego da vizinhança</h2><button className="mini-primary" onClick={()=>setNewItem(v=>!v)}><Plus size={16}/> Anunciar grátis</button></div>
  <p className="muted">Itens gratuitos oferecidos por moradores. Combine a retirada diretamente com quem anunciou.</p>
  {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
  {newItem&&<form className="white-panel form-stack" onSubmit={submit} style={{marginBottom:18}}>
    <h3>Publicar desapego</h3>
    <label>Nome do item<input minLength={3} maxLength={120} required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Livros infantis"/></label>
    <label>Descrição<textarea maxLength={600} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Estado do item e detalhes para retirada"/></label>
    <label>WhatsApp para contato (opcional)<input type="tel" value={whatsapp} onChange={e=>setWhatsapp(e.target.value)} placeholder="Ex.: 5519999999999" maxLength={20}/><small>Use código do país 55 e DDD. O contato fica disponível apenas para moradores logados na página de detalhes. Se não informar, não aparecerá botão de contato.</small></label>
    <label>Foto do item (opcional; JPG, PNG ou WebP; máximo 5 MB)
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||uploading} onChange={e=>uploadImage(e.target.files?.[0])}/>
      <small>Recomendação: imagem quadrada de 800 × 800 pixels; será otimizada automaticamente.</small>
      {uploading&&<small>Enviando foto...</small>}
      {image&&<img src={image} alt="Prévia do desapego" style={{height:160,width:160,objectFit:'cover',borderRadius:12}}/>}
    </label>
    <p className="muted">Após marcar o item como <strong>Doado</strong>, o anúncio, seus dados e sua foto serão excluídos automaticamente após 48 horas.</p>
    <button type="submit" disabled={busy||uploading} className="primary-button">Publicar gratuitamente</button>
  </form>}
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(min(100%,240px),1fr))',gap:15}}>
    {items.map(item=><article className="white-panel" key={item.id} role="button" tabIndex={0} onClick={()=>setSelected(item.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' ')setSelected(item.id);}} style={{overflow:'hidden',padding:0,cursor:'pointer'}}>
      {item.image_url?<img src={item.image_url} alt={item.title} style={{width:'100%',height:175,objectFit:'cover'}}/>:
        <div style={{height:150,display:'grid',placeItems:'center',background:'#f3f3f3'}}><Gift size={45} color="#777"/></div>}
      <div style={{padding:16}}>
        <strong style={{fontSize:17}}>{item.title}</strong>
        <div style={{margin:'8px 0',fontWeight:700,color:item.status==='available'?'#047857':'#666'}}>{item.status==='available'?'GRÁTIS':item.status==='reserved'?'Reservado':'Doado'}</div>
        <p style={{fontSize:14,whiteSpace:'pre-wrap'}}>{item.description.length>110?item.description.slice(0,110)+'…':item.description}</p>
        <small>Por {item.owner_name}</small>
        <span style={{display:'block',fontSize:12,marginTop:10,color:'#555'}}>Ver detalhes do item</span>
      </div>
    </article>)}
  </div>
  {loading&&<div className="white-panel" role="status" aria-live="polite" style={{padding:24,display:'grid',gap:14}}>
    <strong>Carregando desapegos...</strong>
    <div aria-hidden="true" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:14}}>
      {[0,1,2].map(i=><div key={i} style={{height:180,borderRadius:14,background:'#f2f2f2'}}/>)}
    </div>
  </div>}
  {!loading&&loaded&&items.length===0&&<div className="white-panel" style={{textAlign:'center',padding:24}}>Nenhum desapego disponível. Seja o primeiro a anunciar!</div>}
  {!loading&&!loaded&&error&&<button type="button" className="outline-button" onClick={()=>{
    setError('');setLoading(true);
    load().catch(e=>setError(e instanceof Error?e.message:'Falha ao carregar desapegos.')).finally(()=>setLoading(false));
  }}>Tentar carregar novamente</button>}
  {current&&<div role="presentation" onClick={()=>setSelected(null)} style={{position:'fixed',inset:0,zIndex:150,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'center',justifyContent:'center',padding:16}}>
    <section role="dialog" aria-modal="true" aria-label={'Detalhes do desapego: '+current.title} onClick={e=>e.stopPropagation()} style={{background:'#fff',color:'#111',borderRadius:20,width:'min(100%,540px)',maxHeight:'90vh',overflowY:'auto',position:'relative',padding:20}}>
      <button type="button" aria-label="Fechar detalhes" onClick={()=>setSelected(null)} style={{position:'absolute',right:15,top:15,zIndex:2,background:'#fff',border:'1px solid #ddd',borderRadius:20,padding:8}}><X size={20}/></button>
      {current.image_url?<img src={current.image_url} alt={current.title} style={{width:'100%',maxHeight:320,objectFit:'contain',background:'#f5f5f5',borderRadius:14}}/>:<div style={{height:180,background:'#f5f5f5',borderRadius:14,display:'grid',placeItems:'center'}}><Gift size={54}/></div>}
      <div style={{marginTop:18,color:'#047857',fontWeight:800}}>GRÁTIS · {current.status==='available'?'Disponível':current.status==='reserved'?'Reservado':'Doado'}</div>
      <h2 style={{margin:'8px 0'}}>{current.title}</h2>
      <p style={{whiteSpace:'pre-wrap',lineHeight:1.65,color:'#444'}}>{current.description||'Sem descrição adicional.'}</p>
      <p style={{fontSize:14,color:'#666'}}>Publicado por {current.owner_name}</p>
      {current.user_id===viewerId&&<div style={{borderTop:'1px solid #e9e9e9',paddingTop:18,marginTop:18,display:'grid',gap:12}}>
        <strong style={{fontSize:15}}>Gerenciar meu anúncio</strong>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {(['available','reserved','donated'] as const).map(status=><button key={status} type="button" disabled={busy||current.status===status}
            onClick={()=>updateStatus(current,status)}
            aria-pressed={current.status===status}
            style={{padding:'10px 13px',fontWeight:650,borderRadius:12,border:'1px solid '+(current.status===status?'#111':'#dedede'),color:current.status===status?'#fff':'#111',background:current.status===status?'#111':'#f7f7f7',cursor:busy?'wait':'pointer'}}>
            {status==='available'?'Disponível':status==='reserved'?'Reservado':'Marcar como doado'}
          </button>)}
        </div>
        <button type="button" disabled={busy} onClick={()=>deleteItem(current)}
          style={{padding:'12px',borderRadius:12,border:'1px solid #fecaca',color:'#b91c1c',background:'#fff',fontWeight:700}}>Excluir anúncio</button>
      </div>}
      {current.user_id!==viewerId&&current.status==='available'&&current.contact_whatsapp?
        <a target="_blank" rel="noopener noreferrer" href={'https://wa.me/'+current.contact_whatsapp.replace(/\D/g,'')+'?text='+encodeURIComponent('Olá! Vi seu desapego "'+current.title+'" no Condovery. Ainda está disponível?')}
          style={{display:'flex',gap:8,alignItems:'center',justifyContent:'center',padding:14,borderRadius:13,background:'#111',color:'#fff',textDecoration:'none',fontWeight:700}}><MessageCircle size={19}/>Tenho interesse</a>:
        <p style={{fontSize:13,color:'#666'}}>{current.user_id===viewerId?'Este é seu anúncio.':current.status!=='available'?'Este item não está disponível.':'O morador não informou contato para este item.'}</p>}
    </section>
  </div>}
 </section>;
}
