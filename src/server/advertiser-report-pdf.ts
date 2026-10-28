import type {AdvertiserReport} from './advertiser-report';

const fmt=(n:number)=>n.toLocaleString('pt-BR');
const pct=(n:number)=>n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
const safe=(value:string)=>value.normalize('NFC').replace(/[\u2010-\u2015]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
  .replace(/[^\u0020-\u007e\u00a0-\u00ff]/g,' ').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
const text=(x:number,y:number,value:string,size=11,bold=false,color='0.12 0.12 0.12')=>
  `BT /${bold?'F2':'F1'} ${size} Tf ${color} rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${safe(value).slice(0,160)}) Tj ET\n`;
const rect=(x:number,y:number,w:number,h:number,color:string)=>`${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f\n`;
const line=(x1:number,y1:number,x2:number,y2:number,color='0.88 0.87 0.85')=>
  `${color} RG 0.75 w ${x1} ${y1} m ${x2} ${y2} l S\n`;
const shortDate=(s:string)=>s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4);

export function buildAdvertiserPdf(report:AdvertiserReport):Buffer{
  const pages:string[]=[];
  const rows=report.daily;
  let content='';
  function header(page:number){
    let s=rect(0,0,595,842,'1 1 1');
    s+=rect(0,818,595,24,'0.988 0.404 0.255');
    s+=text(42,782,'condovery.',23,true,'0.14 0.14 0.14');
    s+=text(42,759,'RELATORIO DE PUBLICIDADE',11,true,'0.63 0.28 0.16');
    s+=text(42,733,report.campaign.merchant_name.slice(0,55),19,true);
    s+=text(42,710,report.campaign.headline.slice(0,75),11);
    s+=text(42,687,'Condominio: '+report.campaign.condominium_name.slice(0,60),10);
    s+=text(42,670,'Periodo: '+shortDate(report.period.from)+' a '+shortDate(report.period.to),10);
    s+=line(42,652,553,652);
    s+=text(42,40,'Condovery ADS  |  Dados agregados e deduplicados por sessao/dia (UTC)',8,false,'0.46 0.46 0.46');
    s+=text(492,40,'Pagina '+page,8);
    return s;
  }
  content=header(1);
  for(const [i,item] of [{name:'Visualizacoes',v:fmt(report.totals.impressions)},{name:'Cliques',v:fmt(report.totals.clicks)},{name:'CTR',v:pct(report.totals.ctr)}].entries()){
    const x=42+i*174;
    content+=rect(x,563,164,73,'0.967 0.960 0.951');
    content+=text(x+13,608,item.name,10);
    content+=text(x+13,580,item.v,22,true);
  }
  content+=text(42,538,'Visualizacoes por dia (ate 30 dias mais recentes)',11,true);
  const chart=rows.slice(-30);
  const max=Math.max(1,...chart.map(d=>d.impressions));
  const barWidth=chart.length?Math.min(12,475/chart.length-3):12;
  const gap=chart.length?475/chart.length:475;
  content+=line(42,412,553,412);
  chart.forEach((metric,i)=>{
    const h=metric.impressions/max*100;
    if(h>0)content+=rect(49+i*gap,413,barWidth,h,'0.988 0.404 0.255');
  });
  content+=text(42,395,chart.length?shortDate(chart[0].day):'Sem dados',8);
  if(chart.length)content+=text(476,395,shortDate(chart[chart.length-1].day),8);
  content+=text(42,367,'DETALHAMENTO DIARIO',10,true);
  content+=text(42,344,'Dia',9,true);
  content+=text(290,344,'Visualizacoes',9,true);
  content+=text(430,344,'Cliques',9,true);
  content+=line(42,336,553,336);
  let y=318;
  // Page one contains at most 12 daily rows; subsequent pages contain up to 31.
  for(let i=0;i<rows.length;i++){
    if(i===12||i>12&&(i-12)%31===0){
      pages.push(content);
      content=header(pages.length+1);
      content+=text(42,620,'DETALHAMENTO DIARIO (CONTINUACAO)',10,true);
      content+=text(42,595,'Dia',9,true)+text(290,595,'Visualizacoes',9,true)+text(430,595,'Cliques',9,true);
      content+=line(42,584,553,584);
      y=566;
    }
    const row=rows[i];
    content+=text(42,y,shortDate(row.day),9);
    content+=text(290,y,fmt(row.impressions),9);
    content+=text(430,y,fmt(row.clicks),9);
    content+=line(42,y-9,553,y-9,'0.93 0.93 0.92');
    y-=16;
  }
  pages.push(content);
  // Minimal standard PDF with built-in WinAnsi fonts. No external dependencies.
  const objects:string[]=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  ];
  const pageIds:number[]=[];
  for(const page of pages){
    const pageId=objects.length+1,streamId=pageId+1;
    pageIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${streamId} 0 R >>`);
    const bytes=Buffer.from(page,'latin1');
    objects.push(`<< /Length ${bytes.length} >>\nstream\n${page}endstream`);
  }
  objects[1]=`<< /Type /Pages /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] /Count ${pageIds.length} >>`;
  const chunks:Buffer[]=[Buffer.from('%PDF-1.4\n','ascii')];
  const offsets=[0];
  let position=chunks[0].length;
  objects.forEach((obj,i)=>{
    offsets.push(position);
    const bytes=Buffer.from(`${i+1} 0 obj\n${obj}\nendobj\n`,'latin1');
    chunks.push(bytes);position+=bytes.length;
  });
  const xrefAt=position;
  let xref=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset=>{xref+=String(offset).padStart(10,'0')+' 00000 n \n';});
  xref+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  chunks.push(Buffer.from(xref,'ascii'));
  return Buffer.concat(chunks);
}
