'use client';

import {useEffect,useState} from 'react';
import {BarChart3,RefreshCw,Trophy,Users,Store,ShoppingBag,TrendingUp} from 'lucide-react';
import type {GrowthPeriod,PlatformGrowthReport} from '@/server/platform-growth';

type Api=<T>(path:string,options?:RequestInit)=>Promise<T>;
const periods:readonly {key:GrowthPeriod;label:string}[]=[
  {key:7,label:'7 dias'},{key:30,label:'30 dias'},
  {key:90,label:'90 dias'},{key:'all',label:'Todo o período'},
];
const dateTime=(value:string)=>new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short',
}).format(new Date(value));
function money(cents:string):string{
  const value=BigInt(cents||'0');
  const integer=new Intl.NumberFormat('pt-BR').format(value/100n);
  return 'R$ '+integer+','+(value%100n).toString().padStart(2,'0');
}
function change(current:number,previous:number,period:GrowthPeriod){
  if(period==='all')return 'Acumulado histórico';
  if(previous===0)return current===0?'Sem atividade nos dois períodos':'Primeira atividade no período';
  const difference=(current-previous)/previous*100;
  return (difference>0?'+':'')+new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(difference)+'% vs. período anterior';
}
function ratio(cents:string,maximum:string):number{
  const max=BigInt(maximum||'0');
  return max>0n?Number(BigInt(cents||'0')*1000n/max)/10:0;
}

export function PlatformGrowthDashboard({api}:{api:Api}){
  const [period,setPeriod]=useState<GrowthPeriod>(30);
  const [reports,setReports]=useState<Partial<Record<GrowthPeriod,PlatformGrowthReport>>>({});
  const [loading,setLoading]=useState(false);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');
  const report=reports[period];

  // Mounted only while the superadmin opens the Crescimento tab. No timer and
  // no background polling. Switching to an already visited period stays local.
  useEffect(()=>{
    if(report)return;
    let active=true;
    void api<PlatformGrowthReport>('platform/growth?period='+period)
      .then(result=>{if(active){setReports(old=>({...old,[period]:result}));setError('');}})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível consultar os indicadores.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[api,period,report]);

  async function refresh(){
    if(refreshing||loading)return;
    setRefreshing(true);setError('');
    try{
      const result=await api<PlatformGrowthReport>('platform/growth?period='+period+'&refresh=1');
      setReports(old=>({...old,[period]:result}));
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar os dados.');}
    finally{setRefreshing(false);}
  }

  const s=report?.summary;
  const stats=s?[
    {label:'Novos moradores',value:s.new_residents.toLocaleString('pt-BR'),
      comparison:change(s.new_residents,s.previous_residents,period),icon:Users},
    {label:'Novas lojas cadastradas',value:s.new_shops.toLocaleString('pt-BR'),
      comparison:change(s.new_shops,s.previous_shops,period),icon:Store},
    {label:'Pedidos concluídos',value:s.completed_orders.toLocaleString('pt-BR'),
      comparison:change(s.completed_orders,s.previous_orders,period),icon:ShoppingBag},
    {label:'Valor dos pedidos concluídos',value:money(s.completed_cents),
      comparison:change(Number(s.completed_cents),Number(s.previous_cents),period),icon:TrendingUp},
  ]:[];
  const highest=report?.ranking[0]?.completed_cents??'0';
  return <section className="platform-growth" aria-label="Crescimento e ranking Elevadoor">
    <div className="platform-growth-heading">
      <div><h2><BarChart3 size={22}/> Evolução do Elevadoor</h2>
        <p>Indicadores de todos os condomínios, com ranking por valor dos pedidos concluídos.</p></div>
      <button type="button" className="outline-button" disabled={refreshing||loading||!report}
        aria-label="Atualizar indicadores de crescimento"
        onClick={()=>void refresh()}>
        <RefreshCw size={16}/> {refreshing?'Consultando...':'Atualizar'}
      </button>
    </div>
    <div className="platform-growth-periods" role="group" aria-label="Período dos indicadores">
      {periods.map(option=><button key={option.key} type="button"
        className={period===option.key?'selected':''}
        aria-pressed={period===option.key}
        onClick={()=>{setPeriod(option.key);setError('');}}>
        {option.label}
      </button>)}
    </div>
    {error&&<p className="platform-growth-error" role="alert">{error}</p>}
    {!report&&<p role="status" className="platform-growth-loading">Consultando indicadores do período...</p>}
    {report&&s&&<>
      <div className="platform-growth-overview">
        {stats.map(({label,value,comparison,icon:Icon})=><div className="platform-growth-kpi" key={label}>
          <div className="platform-growth-kpi-header"><span>{label}</span><Icon size={17}/></div>
          <strong>{value}</strong>
          <small>{comparison}</small>
        </div>)}
      </div>
      <div className="platform-growth-meta">
        <span><strong>{s.condominiums.toLocaleString('pt-BR')}</strong> condomínios cadastrados</span>
        <span><strong>{s.approved_residents.toLocaleString('pt-BR')}</strong> moradores ativos</span>
        <span><strong>{s.active_shops.toLocaleString('pt-BR')}</strong> lojas aprovadas</span>
      </div>
      <section className="white-panel platform-growth-ranking">
        <div className="platform-growth-ranking-head">
          <div><h3><Trophy size={21}/> Ranking de condomínios</h3>
            <p>Classificação por soma dos valores dos pedidos concluídos no período.</p></div>
          <span className="platform-growth-ranking-scope">Top {Math.min(report.ranking_limit,s.condominiums)} de {s.condominiums}</span>
        </div>
        <div className="platform-growth-table-scroll">
          <table>
            <thead><tr><th scope="col">Posição</th><th scope="col">Condomínio</th>
              <th scope="col">Valor concluído</th><th scope="col">Pedidos</th>
              <th scope="col">Novos moradores</th><th scope="col">Novas lojas</th>
              <th scope="col">Lojas ativas</th></tr></thead>
            <tbody>{report.ranking.map(row=><tr key={row.id}>
              <td className="platform-growth-position">#{row.rank}</td>
              <td><strong>{row.name}</strong>
                {!row.is_active&&<small>Inativo</small>}
              </td>
              <td><div className="platform-growth-value"><strong>{money(row.completed_cents)}</strong>
                <span className="platform-growth-bar" aria-hidden="true"><i style={{width:ratio(row.completed_cents,highest)+'%'}}/></span>
              </div></td>
              <td>{row.completed_orders.toLocaleString('pt-BR')}</td>
              <td>{row.new_residents.toLocaleString('pt-BR')}</td>
              <td>{row.new_shops.toLocaleString('pt-BR')}</td>
              <td>{row.active_shops.toLocaleString('pt-BR')}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {report.ranking.length===0&&<p className="platform-growth-empty">Nenhum condomínio cadastrado até o momento.</p>}
        <div className="platform-growth-footer">
          <p><strong>Importante:</strong> {report.note} Esses valores não devem ser usados sozinhos para premiações financeiras.</p>
          <p>Gerado em {dateTime(report.generated_at)} · Horário de Brasília · Consulta somente ao abrir esta aba ou selecionar um período. Cache de até dois minutos; atualização manual limitada a um recálculo a cada 60 segundos.</p>
        </div>
      </section>
    </>}
  </section>;
}
