export type DiscoveryCampaign="new_shop"|"new_products"|"sunday_food";
export const discoveryCampaigns:readonly {key:DiscoveryCampaign;label:string;description:string}[]=[
  {key:"new_shop",label:"Novas lojas",description:"Novas lojas aprovadas, abertas e com produtos disponíveis"},
  {key:"new_products",label:"Novidades da vizinhança",description:"Resumo diário quando há produtos publicados recentemente"},
  {key:"sunday_food",label:"Domingo com fome",description:"Domingo à noite, somente com alimentação disponível"},
];
export type DiscoveryVariant={title:string;body:string};
export function discoveryMessages(campaign:DiscoveryCampaign,shopName?:string):readonly [DiscoveryVariant,DiscoveryVariant]{
  // Never interpolate untrusted text without a bound. Never claim a sale or a discount.
  const name=(shopName??"uma loja vizinha").trim().slice(0,40)||"uma loja vizinha";
  if(campaign==="new_shop")return [
    {title:"Tem loja nova na vizinhança!",body:name+" chegou ao Elevadoor. Confira as novidades pertinho de casa!"},
    {title:"Olha quem chegou por aqui!",body:"A loja "+name+" já está no Elevadoor. Venha conhecer o que seus vizinhos oferecem!"},
  ];
  if(campaign==="new_products")return [
    {title:"Tem novidade na vizinhança!",body:"Seus vizinhos adicionaram novos produtos. Veja o que chegou ao Elevadoor!"},
    {title:"Chegou coisa nova por aqui!",body:"A vitrine da vizinhança tem novidades. Que tal descobrir o que apareceu?"},
  ];
  return [
    {title:"Domingo à noite e bateu aquela fome?",body:"Seus vizinhos têm delícias disponíveis. Confira as opções abertas no Elevadoor!"},
    {title:"Fome de domingo? Olha aqui pertinho!",body:"Antes de procurar longe, veja o que seus vizinhos estão oferecendo no Elevadoor!"},
  ];
}
/** Choose an A/B copy per recipient and event without unstable randomness. */
export function discoveryVariant(userId:string,eventKey:string):0|1{
  let total=0;
  for(const c of userId+eventKey)total=(total*31+c.charCodeAt(0))|0;
  return (total&1) as 0|1;
}
export type DiscoveryLocalTime={date:string;hour:number;minute:number;weekday:string};
/** All scheduling is condominium-local São Paulo time, independent of VPS UTC. */
export function localDiscoveryTime(now:Date):DiscoveryLocalTime{
  const parts=new Intl.DateTimeFormat("en-US",{
    timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit",
    hour:"2-digit",minute:"2-digit",weekday:"short",hourCycle:"h23",
  }).formatToParts(now);
  const value=(type:string)=>parts.find(part=>part.type===type)?.value??"";
  return {date:value("year")+"-"+value("month")+"-"+value("day"),
    hour:Number(value("hour")),minute:Number(value("minute")),weekday:value("weekday")};
}
export function discoveryWindowOpen(campaign:DiscoveryCampaign,t:DiscoveryLocalTime):boolean{
  const mins=t.hour*60+t.minute;
  if(mins<10*60||mins>20*60+30)return false;
  if(campaign==="new_products")return mins>=12*60&&mins<14*60;
  if(campaign==="sunday_food")return t.weekday==="Sun"&&mins>=19*60&&mins<20*60;
  return true;
}
