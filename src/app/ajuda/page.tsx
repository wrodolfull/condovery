import type {Metadata} from 'next';
import {HelpCenter} from '@/components/HelpCenter';

export const metadata:Metadata={
  title:'Central de Ajuda | Elevadoor',
  description:'Guias rápidos de compras, vendas e administração no Elevadoor.',
  robots:{index:false,follow:false}
};

export default function HelpPage(){return <HelpCenter/>;}
