'use client';
import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {Image as ImageIcon} from 'lucide-react';

type Props = {
  src?:string|null;
  alt:string;
  className?:string;
  fallback?:ReactNode;
  fit?:'cover'|'contain';
  eager?:boolean;
};

/** Layout-stable slot: works without an art file and switches automatically
 * to the real artwork once its src is configured. */
export function IllustrationSlot({src,alt,className='',fallback,fit='contain',eager=false}:Props) {
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[src]);
  const show=Boolean(src&&!failed);
  return <div className={['illustration-slot',className].filter(Boolean).join(' ')}
    role={!show?'img':undefined} aria-label={!show?alt:undefined}>
    {show?<img src={src!} alt={alt} loading={eager?'eager':'lazy'}
      decoding="async" className={'illustration-image fit-'+fit}
      onError={()=>setFailed(true)}/>:
      <div className="illustration-fallback" aria-hidden="true">
        {fallback??<ImageIcon size={30} strokeWidth={1.5}/>}
      </div>}
  </div>;
}
