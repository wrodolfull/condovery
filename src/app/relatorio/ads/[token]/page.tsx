import type {Metadata} from 'next';
import {AdvertiserReportView} from '@/components/AdvertiserReportView';

export const metadata:Metadata={
  title:'Relatório de publicidade | Condovery ADS',
  description:'Resultados de campanha publicitária no Condovery.',
  robots:{index:false,follow:false,noarchive:true,nosnippet:true},
  referrer:'no-referrer'
};
export default async function PublicAdReport({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  return <AdvertiserReportView token={token}/>;
}
