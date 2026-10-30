'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,Download,Eye,MousePointerClick,TrendingUp} from 'lucide-react';
import type {AdvertiserReport,ReportRange} from '@/server/advertiser-report';

type Props={campaignId?:string;token?:string};
const number=(value:number)=>value.toLocaleString('pt-BR');
const percent=(value:number)=>value.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const date=(value:string)=>value.slice(8,10)+'/'+value.slice(5,7)+'/'+value.slice(0,4);
export function AdvertiserReportView({campaignId,token}:Props){
  const [range,setRange]=useState<ReportRange>('30');
  const [report,setReport]=useState<AdvertiserReport|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const prefix=campaignId?'/api/platform/ads/'+campaignId+'/report':'/api/ads-reports/'+token;
  useEffect(()=>{
    let active=true;
    setLoading(true);setError('');setReport(null);
    fetch(prefix+'?range='+range,{cache:'no-store',credentials:'same-origin'})
      .then(async res=>{const data=await res.json();if(!res.ok)throw Error(data.error||'Relatório indisponível.');return data as AdvertiserReport;})
      .then(data=>{if(active)setReport(data);})
      .catch(e=>{if(active)setError(e instanceof Error?e.message:'Não foi possível consultar o relatório.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[prefix,range]);
  const chart=report?.daily.slice(-30)??[];
  const max=Math.max(1,...chart.map(row=>row.impressions));
  return <section className={'adreport'+(!campaignId?' adreport-public':'')} aria-label="Relatório da campanha">
    {!campaignId&&<div className="adreport-public-brand">elevadoor<span>.</span> <small>ADS · Relatório de campanha</small></div>}
    <div className="adreport-header">
      <div><span className="adreport-eyebrow">DESEMPENHO DA CAMPANHA</span>
        <h2>{report?.campaign.merchant_name||'Relatório de publicidade'}</h2>
        {report&&<p>{report.campaign.headline} · {report.campaign.condominium_name}</p>}
      </div>
      <a className="outline-button adreport-download" href={prefix+'/pdf?range='+range} download>
        <Download size={16}/> Gerar PDF
      </a>
    </div>
    <label className="adreport-filter">Período
      <select value={range} onChange={e=>setRange(e.target.value as ReportRange)}>
        <option value="7">Últimos 7 dias da campanha</option>
        <option value="30">Últimos 30 dias da campanha</option>
        <option value="90">Últimos 90 dias da campanha</option>
        <option value="all">Todo o período</option>
      </select>
    </label>
    {loading&&<p className="muted" role="status">Consultando resultados...</p>}
    {error&&<p role="alert" className="adreport-error">{error}</p>}
    {report&&<>
      <p className="muted adreport-period">{date(report.period.from)} a {date(report.period.to)}</p>
      <div className="adreport-kpis">
        <div><Eye size={20}/><small>Visualizações</small><strong>{number(report.totals.impressions)}</strong></div>
        <div><MousePointerClick size={20}/><small>Cliques</small><strong>{number(report.totals.clicks)}</strong></div>
        <div><TrendingUp size={20}/><small>CTR</small><strong>{percent(report.totals.ctr)}</strong></div>
      </div>
      <div className="adreport-section">
        <h3>Visualizações por dia</h3>
        {chart.length&&max>0?<div className="adreport-chart-scroll"><div className="adreport-chart" role="img" aria-label="Gráfico das visualizações diárias da campanha">
          {chart.map(metric=><div className="adreport-bar-column" key={metric.day}
             title={date(metric.day)+': '+number(metric.impressions)+' visualizações e '+number(metric.clicks)+' cliques'}>
            <div className="adreport-bar-track"><span style={{height:(metric.impressions/max*100)+'%'}}/></div>
          </div>)}
        </div><div className="adreport-chart-labels"><span>{date(chart[0].day)}</span><span>{date(chart[chart.length-1].day)}</span></div></div>:
        <p className="muted">Nenhuma visualização registrada neste período.</p>}
        <small className="muted">O gráfico mostra até os 30 dias mais recentes. Os indicadores acima consideram todo o período selecionado.</small>
        {report.daily_truncated&&<p className="muted">O detalhamento diário exibe somente os 400 dias mais recentes. Os totais continuam considerando todo o período.</p>}
      </div>
      <div className="adreport-section">
        <h3>Detalhamento diário</h3>
        <div className="adreport-table-scroll"><table><thead><tr><th>Dia</th><th>Visualizações</th><th>Cliques</th></tr></thead>
          <tbody>{report.daily.slice().reverse().map(metric=><tr key={metric.day}><td>{date(metric.day)}</td><td>{number(metric.impressions)}</td><td>{number(metric.clicks)}</td></tr>)}</tbody>
        </table></div>
      </div>
      <p className="adreport-disclaimer">{report.disclaimer} Cliques não significam compras realizadas.</p>
    </>}
    {!campaignId&&<p className="adreport-footnote">Relatório compartilhado pelo responsável pela publicidade no Elevadoor. Este link pode expirar ou ser revogado.</p>}
  </section>;
}
