'use client';
import {useEffect,useState} from 'react';
import {Download,Search} from 'lucide-react';

type Item={id:string;name:string;status:string;email?:string;phone?:string;tower?:string;apartment?:string;owner_name?:string;created_at:string};
type ResponseData={items:Item[];page:number;total:number;pageSize:number;totalPages:number};
type Props={kind:'users'|'shops';condominiumId:string;towers:string[];onChanged:()=>void};
const statusName:Record<string,string>={approved:'Ativo',suspended:'Suspenso',pending:'Pendente'};

export function AdminDirectory({kind,condominiumId,towers,onChanged}:Props){
  const [search,setSearch]=useState('');
  const [debounced,setDebounced]=useState('');
  const [status,setStatus]=useState('all');
  const [tower,setTower]=useState('');
  const [page,setPage]=useState(0);
  const [data,setData]=useState<ResponseData|null>(null);
  const [loading,setLoading]=useState(true);
  const [updating,setUpdating]=useState<string|null>(null);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const timeout=setTimeout(()=>setDebounced(search),300);return()=>clearTimeout(timeout);},[search]);
  useEffect(()=>{setPage(0);setSearch('');setDebounced('');setStatus('all');setTower('');setData(null);},[condominiumId,kind]);
  const params=new URLSearchParams({kind,search:debounced,status,page:String(page)});
  if(kind==='users'&&tower)params.set('tower',tower);
  const url='/api/admin/directory?'+params.toString();
  const exportUrl='/api/admin/directory/export?'+params.toString();
  useEffect(()=>{
    let active=true;
    setLoading(true);
    fetch(url,{credentials:'same-origin',cache:'no-store'})
      .then(async response=>{
        const body=await response.json();
        if(!response.ok)throw Error(body.error||'Não foi possível carregar os cadastros.');
        return body as ResponseData;
      })
      .then(result=>{
        if(!active)return;
        if(page>=result.totalPages&&page>0){setPage(result.totalPages-1);return;}
        setData(result);setError('');
      })
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Erro ao consultar.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[url,revision,condominiumId]);
  async function changeStatus(item:Item){
    const next=item.status==='suspended'?'approved':'suspended';
    setUpdating(item.id);setError('');setNotice('');
    try{
      const response=await fetch('/api/admin/'+kind+'/'+item.id,{
        method:'PATCH',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({status:next})
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(body.error||'Não foi possível alterar o cadastro.');
      setNotice('Cadastro atualizado.');setRevision(v=>v+1);onChanged();
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível alterar o cadastro.');}
    finally{setUpdating(null);}
  }
  return <section className="admin-section white-panel">
    <h2>{kind==='users'?'Moradores cadastrados':'Lojas cadastradas'}</h2>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'end',margin:'15px 0'}}>
      <label style={{flex:'2 1 230px'}}>Buscar
        <div style={{display:'flex',gap:7,alignItems:'center'}}><Search size={17}/><input
          value={search} placeholder={kind==='users'?'Nome, e-mail ou apartamento':'Loja ou responsável'}
          onChange={e=>{setSearch(e.target.value);setPage(0);}} maxLength={100} /></div>
      </label>
      <label style={{flex:'1 1 145px'}}>Situação
        <select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}>
          <option value="all">Todas</option><option value="approved">Ativas</option>
          <option value="suspended">Suspensas</option><option value="pending">Pendentes</option>
        </select>
      </label>
      {kind==='users'&&<label style={{flex:'1 1 130px'}}>Torre
        <select value={tower} onChange={e=>{setTower(e.target.value);setPage(0);}}>
          <option value="">Todas</option>{towers.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </label>}
      {data&&data.total<=5000&&<a href={exportUrl} className="outline-button"
        style={{display:'inline-flex',gap:7,alignItems:'center',textDecoration:'none',minHeight:40}}>
        <Download size={16}/> Exportar CSV</a>}
    </div>
    {data&&<p className="muted" style={{marginBottom:10}}>{data.total} registro(s) encontrado(s) · página {data.page+1} de {data.totalPages}</p>}
    {data&&data.total>5000&&<p className="muted">Refine os filtros para exportar até 5.000 registros.</p>}
    {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    {loading?<p className="muted">Consultando registros...</p>:data?.items.length?
      data.items.map(item=><div className="admin-row" key={item.id}>
        <div>
          <strong>{item.name}</strong>
          <p>{kind==='users'?item.email+' · '+item.tower+' / '+item.apartment:'Responsável: '+item.owner_name}</p>
          <small>{statusName[item.status]??item.status}</small>
        </div>
        <div className="inline-actions">
          <button type="button" disabled={updating!==null} onClick={()=>changeStatus(item)}
            className={item.status==='suspended'?'outline-button':'danger-text'}>
            {updating===item.id?'Salvando...':item.status==='suspended'?'Reativar':'Suspender'}
          </button>
        </div>
      </div>):<p className="muted">Nenhum registro encontrado com esses filtros.</p>}
    {data&&data.totalPages>1&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,marginTop:16}}>
      <button className="outline-button" type="button" disabled={page===0||loading} onClick={()=>setPage(p=>Math.max(0,p-1))}>Anterior</button>
      <span>Página {page+1} / {data.totalPages}</span>
      <button className="outline-button" type="button" disabled={page>=data.totalPages-1||loading} onClick={()=>setPage(p=>p+1)}>Próxima</button>
    </div>}
  </section>;
}
