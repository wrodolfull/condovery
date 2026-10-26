'use client';
import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {Gift,MapPin,Plus} from 'lucide-react';
type Item={id:string;user_id:string;title:string;description:string;image_url:string|null;status:'available'|'reserved'|'donated';owner_name:string;owner_phone:string;created_at:string};
async function request(path:string,init?:RequestInit){
 const response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...init,headers:{'Content-Type':'application/json',...init?.headers}});
 const data=await response.json();if(!response.ok)throw new Error(data.error||'Erro de comunicação.');return data;
}
export function Giveaways({viewerId}:{viewerId:string}){
 const [items,setItems]=useState<Item[]>([]);
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[image,setImage]=useState('');
 const [uploading,setUploading]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[newItem,setNewItem]=useState(false);
 const load=useCallback(async()=>setItems((await request('giveaways')).items),[]);
 useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
 async function act(action:()=>Promise<unknown>){
  setBusy(true);setError('');
  try{await action();await load();}catch(e){setError(e instanceof Error?e.message:'Erro ao atualizar.');}finally{setBusy(false);}
 }
 async function uploadImage(file:File|undefined){
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('Use JPG, PNG ou WebP de até 5 MB.');return;}
  setUploading(true);setError('');
  try{const data=new FormData();data.append('file',file);
    const response=await fetch('/api/media/giveaway',{method:'POST',body:data});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'Não foi possível enviar a foto.');
    setImage(result.url);
  }catch(e){setError(e instanceof Error?e.message:'Erro no upload.');}finally{setUploading(false);}
 }
 async function submit(e:FormEvent){
  e.preventDefault();
  await act(async()=>{await request('giveaways',{method:'POST',body:JSON.stringify({title,description,image_url:image})});setTitle('');setDescription('');setImage('');setNewItem(false);});
 }
 return <section style={{paddingBottom:30}}>
  <div className="section-heading"><h2>Desapego da vizinhança</h2><button className="mini-primary" onClick={()=>setNewItem(v=>!v)}><Plus size={16}/> Anunciar grátis</button></div>
  <p className="muted">Itens gratuitos oferecidos por moradores. Combine a retirada diretamente com quem anunciou.</p>
  {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
  {newItem&&<form className="white-panel form-stack" onSubmit={submit} style={{marginBottom:18}}>
    <h3>Publicar desapego</h3>
    <label>Nome do item<input minLength={3} maxLength={120} required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Livros infantis"/></label>
    <label>Descrição<textarea maxLength={600} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Estado do item e detalhes para retirada"/></label>
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
    {items.map(item=><article className="white-panel" key={item.id} style={{overflow:'hidden',padding:0}}>
      {item.image_url?<img src={item.image_url} alt={item.title} style={{width:'100%',height:175,objectFit:'cover'}}/>:
        <div style={{height:150,display:'grid',placeItems:'center',background:'#f3f3f3'}}><Gift size={45} color="#777"/></div>}
      <div style={{padding:16}}>
        <strong style={{fontSize:17}}>{item.title}</strong>
        <div style={{margin:'8px 0',fontWeight:700,color:item.status==='available'?'#047857':'#666'}}>{item.status==='available'?'GRÁTIS':item.status==='reserved'?'Reservado':'Doado'}</div>
        <p style={{fontSize:14,whiteSpace:'pre-wrap'}}>{item.description}</p>
        <small>Por {item.owner_name}</small>
        {item.user_id===viewerId?<div className="inline-actions" style={{marginTop:10}}>
          <select aria-label={'Estado de '+item.title} disabled={busy} value={item.status} onChange={e=>{if(e.target.value==='donated'&&!window.confirm('Marcar como doado? Este anúncio e sua foto serão excluídos automaticamente após 48 horas.'))return;act(()=>request('giveaways/'+item.id,{method:'PATCH',body:JSON.stringify({status:e.target.value})}));}}>
            <option value="available">Disponível</option><option value="reserved">Reservado</option><option value="donated">Doado</option>
          </select>
          <button disabled={busy} type="button" className="danger-text" onClick={()=>{if(window.confirm('Excluir desapego?'))act(()=>request('giveaways/'+item.id,{method:'DELETE'}));}}>Excluir</button>
        </div>:item.status==='available'&&item.owner_phone&&<a target="_blank" rel="noopener noreferrer" style={{display:'inline-flex',marginTop:12,padding:'10px 13px',background:'#111',color:'#fff',borderRadius:12,textDecoration:'none'}} href={'https://wa.me/'+item.owner_phone.replace(/\D/g,'')+'?text='+encodeURIComponent('Olá! Vi seu desapego "'+item.title+'" no Condovery. Ainda está disponível?')}>Tenho interesse</a>}
      </div>
    </article>)}
  </div>
  {!items.length&&<div className="white-panel" style={{textAlign:'center',padding:24}}>Nenhum desapego disponível. Seja o primeiro a anunciar!</div>}
 </section>;
}
