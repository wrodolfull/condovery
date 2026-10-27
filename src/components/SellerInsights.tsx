'use client';
import {useEffect,useState} from 'react';
import {BarChart3,RefreshCw} from 'lucide-react';

type Summary={orders_total:number;awaiting:number;confirmed:number;completed:number;cancelled:number;completed_cents:string;average_cents:string};
type ProductResult={product_id:string;name:string;units:number;orders:number;amount_cents:string};
type DayResult={day:string;orders:number;amount_cents:string};
type Insights={days:number;summary:Summary;topProducts:ProductResult[];daily:DayResult[]};
const currency=(c:string|number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(c)/100);
export function SellerInsights({condominiumId}:{condominiumId:string}){
  const [days,setDays]=useState<7|30|90>(30);
  const [data,setData]=useState<Insights|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');setData(null);
    fetch('/api/seller/insights?days='+days,{credentials:'same-origin',cache:'no-store'})
      .then(async res=>{const body=await res.json();if(!res.ok)throw Error(body.error||'Não foi possível carregar os indicadores.');return body as Insights;})
      .then(result=>{if(active)setData(result);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Falha ao carregar.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[days,revision,condominiumId]);
  const topUnits=Math.max(1,...(data?.topProducts.map(x=>x.units)??[]));
  return <section className="admin-section white-panel" aria-label="Resultados da loja">
    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
      <h2><BarChart3 size={21}/> Inteligência da loja</h2>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <label>Período <select value={days} onChange={e=>setDays(Number(e.target.value) as 7|30|90)}>
          <option value={7}>7 dias</option><option value={30}>30 dias</option><option value={90}>90 dias</option>
        </select></label>
        <button type="button" className="outline-button" aria-label="Atualizar indicadores" onClick={()=>setRevision(x=>x+1)}><RefreshCw size={16}/></button>
      </div>
    </div>
    <p className="muted">Resultados derivados dos pedidos registrados no Condovery. Valores de pedidos concluídos não comprovam recebimento do pagamento.</p>
    {loading&&<p className="muted">Carregando resultados...</p>}
    {error&&<p role="alert" style={{color:'#b91c1c'}}>{error}</p>}
    {data&&<><div className="admin-stats" style={{marginTop:16}}>
      <div><strong>{data.summary.orders_total}</strong><span>Pedidos recebidos</span></div>
      <div><strong>{data.summary.completed}</strong><span>Concluídos</span></div>
      <div><strong>{currency(data.summary.completed_cents)}</strong><span>Valor dos pedidos concluídos</span></div>
      <div><strong>{currency(data.summary.average_cents)}</strong><span>Ticket médio concluído</span></div>
    </div>
    <div style={{display:'flex',gap:15,flexWrap:'wrap',margin:'14px 0'}}>
      <span>Aguardando confirmação: <strong>{data.summary.awaiting}</strong></span>
      <span>Confirmados: <strong>{data.summary.confirmed}</strong></span>
      <span>Cancelados: <strong>{data.summary.cancelled}</strong></span>
    </div>
    <h3 style={{margin:'22px 0 10px'}}>Produtos mais pedidos e concluídos</h3>
    {data.topProducts.length?data.topProducts.map(p=><div key={p.product_id} style={{margin:'14px 0'}}>
      <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
        <strong>{p.name}</strong><small>{p.units} unidades · {currency(p.amount_cents)}</small>
      </div>
      <div style={{background:'#eee',height:8,borderRadius:8,overflow:'hidden',marginTop:8}}>
        <div style={{height:'100%',background:'#262626',width:(p.units/topUnits*100)+'%'}}/>
      </div>
    </div>):<p className="muted">Nenhum produto em pedidos concluídos neste período.</p>}
    <h3 style={{margin:'24px 0 10px'}}>Evolução de pedidos concluídos</h3>
    {data.daily.length?<div style={{display:'flex',alignItems:'end',gap:5,height:112,overflowX:'auto',borderBottom:'1px solid #ddd',paddingBottom:4}}>
      {data.daily.map(d=><div key={d.day} title={String(d.day).slice(0,10)+' · '+d.orders+' pedidos · '+currency(d.amount_cents)} style={{minWidth:14,flex:'1 0 14px',maxWidth:42,display:'flex',flexDirection:'column',justifyContent:'end',height:'100%'}}>
        <div style={{height:Math.max(6,d.orders/Math.max(1,...data.daily.map(v=>v.orders))*95)+'%',background:'#303030',borderRadius:'5px 5px 0 0'}}/>
      </div>)}
    </div>:<p className="muted">Ainda não há pedidos concluídos neste período.</p>}
    <small className="muted">A visualização considera a data em que o pedido foi registrado e seu status atual; não representa faturamento conciliado.</small>
    </>}
  </section>;
}
