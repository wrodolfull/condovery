import type {Metadata} from 'next';
import {AdvertiserReportView} from '@/components/AdvertiserReportView';

export const metadata:Metadata={
  title:'Relatório de publicidade | Elevadoor ADS',
  description:'Resultados de campanha publicitária no Elevadoor.',
  robots:{index:false,follow:false,noarchive:true,nosnippet:true},
  other:{referrer:'no-referrer'}
};
export default async function PublicAdReport({params}:{params:Promise<{token:string}>}){
  const {token}=await params;
  return <AdvertiserReportView token={token}/>;
}
