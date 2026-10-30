import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name:'Elevadoor — Tudo de bom mora aqui',short_name:'Elevadoor',
    description:'Marketplace exclusivo de moradores',start_url:'/',display:'standalone',
    background_color:'#ffffff',theme_color:'#FBE248',
    icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]
  };
}
