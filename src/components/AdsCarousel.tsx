'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight,MapPin} from 'lucide-react';

export type AdCampaign={id:string;merchant_name:string;headline:string;description:string;location:string;image_url:string;destination_url:string};
export function AdsCarousel({campaigns}:{campaigns:AdCampaign[]}){
  const [index,setIndex]=useState(0);
  const touch=useRef<number|null>(null);
  useEffect(()=>setIndex(0),[campaigns]);
  useEffect(()=>{
    if(campaigns.length<2)return;
    const timer=window.setInterval(()=>setIndex(i=>(i+1)%campaigns.length),8500);
    return()=>window.clearInterval(timer);
  },[campaigns]);
  if(!campaigns.length)return null;
  const ad=campaigns[index%campaigns.length];
  return <section aria-label="Ofertas perto de você" style={{margin:'22px 0'}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
      <h2 style={{fontSize:'clamp(19px,4vw,25px)',fontWeight:750,margin:0}}>Ofertas perto de você</h2>
    </div>
    <article onTouchStart={e=>touch.current=e.touches[0]?.clientX??null}
      onTouchEnd={e=>{if(touch.current===null||campaigns.length<2)return;const delta=e.changedTouches[0].clientX-touch.current;if(Math.abs(delta)>45)setIndex(i=>(i+(delta<0?1:campaigns.length-1))%campaigns.length);touch.current=null;}}
      style={{overflow:'hidden',borderRadius:20,background:'#fff',border:'1px solid #e8e8e8',boxShadow:'0 7px 22px rgba(0,0,0,.06)'}}>
      <div style={{position:'relative',height:'clamp(190px,48vw,330px)',background:'#f4f4f4'}}>
        <img key={ad.id} src={ad.image_url} alt={ad.headline} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        <span style={{position:'absolute',right:14,top:14,background:'#111',color:'#fff',borderRadius:999,padding:'8px 13px',fontSize:11,fontWeight:800,letterSpacing:'.04em'}}>PUBLICIDADE</span>
      </div>
      <div style={{padding:'19px 18px 20px'}}>
        <div style={{fontSize:15,fontWeight:700,marginBottom:5}}>{ad.merchant_name}</div>
        <h3 style={{fontSize:'clamp(20px,4vw,25px)',fontWeight:800,margin:'0 0 6px',lineHeight:1.2}}>{ad.headline}</h3>
        <p style={{fontSize:14,lineHeight:1.5,color:'#626262',margin:'0 0 17px'}}>{ad.description}</p>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
          <span style={{display:'inline-flex',alignItems:'center',gap:6,color:'#555',fontSize:13}}><MapPin size={16}/>{ad.location}</span>
          <a href={ad.destination_url} target="_blank" rel="noopener noreferrer sponsored" style={{display:'inline-flex',alignItems:'center',gap:7,background:'#111',color:'white',fontSize:13,padding:'12px 17px',borderRadius:13,textDecoration:'none',fontWeight:700}}>Ver oferta <ArrowUpRight size={16}/></a>
        </div>
      </div>
    </article>
    {campaigns.length>1&&<div role="group" aria-label="Navegar entre anúncios" style={{display:'flex',justifyContent:'center',gap:8,marginTop:13}}>
      {campaigns.map((c,i)=><button key={c.id} type="button" aria-label={`Anúncio ${i+1}`} aria-current={i===index} onClick={()=>setIndex(i)} style={{height:9,width:9,borderRadius:'50%',padding:0,border:0,background:i===index?'#111':'#d0d0d0',cursor:'pointer'}}/>)}
    </div>}
  </section>;
}
