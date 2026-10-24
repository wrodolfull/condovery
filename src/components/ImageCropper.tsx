'use client';

import {useEffect,useRef,useState} from 'react';
import {Minus,Plus,Move,X,Check} from 'lucide-react';
import {cropGeometry} from '@/lib/crop-geometry';

export type ImageKind='avatar'|'logo'|'cover'|'product';
const cropPreset:Record<ImageKind,{label:string;aspect:number;hint:string}>={
  avatar:{label:'foto de perfil',aspect:1,hint:'Enquadre seu rosto dentro do círculo.'},
  logo:{label:'foto da loja',aspect:1,hint:'Centralize a imagem dentro do círculo.'},
  cover:{label:'capa da loja',aspect:3,hint:'Arraste para escolher o destaque da capa.'},
  product:{label:'foto do produto',aspect:1.17,hint:'Ajuste o produto dentro da vitrine.'}
};

export function ImageCropper({file,kind,onCancel,onApply}:{
  file:File;kind:ImageKind;onCancel:()=>void;onApply:(image:File)=>void
}){
  const {label,aspect,hint}=cropPreset[kind];
  const [url,setUrl]=useState('');
  const [dimensions,setDimensions]=useState<{w:number;h:number}|null>(null);
  const [previewWidth,setPreviewWidth]=useState(320);
  const [zoom,setZoom]=useState(1);
  const [pan,setPan]=useState({x:0,y:0});
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const frame=useRef<HTMLDivElement|null>(null);
  const bitmap=useRef<ImageBitmap|null>(null);
  const drag=useRef<{x:number;y:number;panX:number;panY:number}|null>(null);

  useEffect(()=>{
    let alive=true;
    const objectUrl=URL.createObjectURL(file);
    setUrl(objectUrl);setDimensions(null);setZoom(1);setPan({x:0,y:0});setError('');
    createImageBitmap(file).then(image=>{
      if(!alive){image.close();return;}
      bitmap.current=image;setDimensions({w:image.width,h:image.height});
    }).catch(()=>{if(alive)setError('Não foi possível abrir esta imagem. Escolha outra foto.');});
    return()=>{alive=false;URL.revokeObjectURL(objectUrl);bitmap.current?.close();bitmap.current=null;};
  },[file]);

  useEffect(()=>{
    if(!frame.current)return;
    const observer=new ResizeObserver(entries=>{
      const width=entries[0]?.contentRect.width;
      if(width&&width>0)setPreviewWidth(width);
    });
    observer.observe(frame.current);
    return()=>observer.disconnect();
  },[]);

  const metrics=dimensions?cropGeometry(dimensions.w,dimensions.h,previewWidth,aspect,zoom,pan.x,pan.y):null;
  function movePan(x:number,y:number){
    if(!dimensions)return;
    const next=cropGeometry(dimensions.w,dimensions.h,previewWidth,aspect,zoom,x,y);
    setPan({x:next.panX,y:next.panY});
  }
  function pointerMove(event:React.PointerEvent<HTMLDivElement>){
    if(!drag.current)return;
    movePan(drag.current.panX+event.clientX-drag.current.x,drag.current.panY+event.clientY-drag.current.y);
  }
  function onKeyMove(event:React.KeyboardEvent<HTMLDivElement>){
    const step=event.shiftKey?25:8;
    if(event.key==='ArrowLeft'){event.preventDefault();movePan(pan.x-step,pan.y);}
    if(event.key==='ArrowRight'){event.preventDefault();movePan(pan.x+step,pan.y);}
    if(event.key==='ArrowUp'){event.preventDefault();movePan(pan.x,pan.y-step);}
    if(event.key==='ArrowDown'){event.preventDefault();movePan(pan.x,pan.y+step);}
  }
  async function apply(){
    if(!bitmap.current||!metrics||saving)return;
    setSaving(true);setError('');
    try{
      const width=960,height=Math.round(width/aspect);
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');
      if(!ctx)throw new Error('Não foi possível preparar a foto.');
      ctx.drawImage(bitmap.current,metrics.sx,metrics.sy,metrics.sw,metrics.sh,0,0,width,height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(
        result=>result?resolve(result):reject(new Error('Não foi possível salvar o enquadramento.')),
        'image/webp',0.85
      ));
      onApply(new File([blob],'condovery-'+kind+'.webp',{type:'image/webp'}));
    }catch(caught){setError(caught instanceof Error?caught.message:'Falha ao preparar a imagem.');}
    finally{setSaving(false);}
  }
  return <div className="crop-overlay" role="presentation" onClick={()=>!saving&&onCancel()}>
    <section className="crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title"
      onClick={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==='Escape'&&!saving)onCancel();}}>
      <header className="crop-header"><div><h2 id="crop-title">Ajustar {label}</h2><p>{hint}</p></div>
        <button type="button" className="crop-close" aria-label="Cancelar enquadramento" onClick={onCancel} disabled={saving}><X size={20}/></button>
      </header>
      <div className="crop-workspace">
        <div className={'crop-frame'+(aspect===1?' circle-preview':'')} ref={frame} style={{aspectRatio:String(aspect)}}
          role="img" aria-label={'Prévia do recorte da '+label} tabIndex={0} onKeyDown={onKeyMove}
          onPointerDown={event=>{
            if(!metrics)return;
            drag.current={x:event.clientX,y:event.clientY,panX:metrics.panX,panY:metrics.panY};
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={pointerMove} onPointerUp={event=>{drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
          onPointerCancel={()=>{drag.current=null;}}>
          {url&&metrics&&<img draggable={false} src={url} alt=""
            style={{width:metrics.renderWidth,height:metrics.renderHeight,
              left:'calc(50% + '+metrics.panX+'px)',top:'calc(50% + '+metrics.panY+'px)'}}/>}
          {!metrics&&<span className="crop-loading">{error||'Carregando imagem...'}</span>}
        </div>
        <p className="crop-tip"><Move size={16}/> Arraste a imagem ou use as setas do teclado para reposicionar.</p>
      </div>
      <div className="crop-controls">
        <label htmlFor="crop-zoom"><strong>Zoom</strong></label>
        <Minus size={18}/>
        <input id="crop-zoom" type="range" min="1" max="3" step="0.05" value={zoom}
          aria-label="Aumentar ou diminuir imagem" onChange={event=>{setZoom(Number(event.target.value));setPan({x:0,y:0});}}/>
        <Plus size={18}/>
      </div>
      {error&&<p className="crop-error" role="alert">{error}</p>}
      <footer className="crop-footer">
        <button type="button" className="outline-button" onClick={onCancel} disabled={saving}>Cancelar</button>
        <button type="button" className="primary-button" disabled={saving||!dimensions} onClick={apply}>
          <Check size={17}/>{saving?'Processando...':'Aplicar enquadramento'}</button>
      </footer>
    </section>
  </div>;
}
