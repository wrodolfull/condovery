'use client';
type Props={value:number;onChange?:(value:number)=>void;size?:number;label?:string};

/** Curved star contours, rounded tips and cheerful yellow fill. */
function StarIcon({filled,size}:{filled:boolean;size:number}){
  return <svg viewBox="0 0 24 24" width={size} height={size}
    aria-hidden="true" fill={filled?'currentColor':'none'} stroke="currentColor"
    strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2.3c.42 0 .8.25.98.65l2.55 5.16 5.7.83c.95.14 1.32 1.3.64 1.97l-4.12 4.02.98 5.67c.16.94-.82 1.65-1.66 1.21L12 19.14l-5.07 2.67c-.84.44-1.82-.27-1.66-1.21l.97-5.67-4.12-4.02c-.68-.67-.31-1.83.64-1.97l5.7-.83L11.02 2.95c.18-.4.56-.65.98-.65Z"/>
  </svg>;
}
export function RoundedStars({value,onChange,size=23,label}:Props){
  const interactive=typeof onChange==='function';
  const accessibleLabel=label??(value.toLocaleString('pt-BR',{maximumFractionDigits:1})+' de 5 estrelas');
  return <div className={'rounded-stars'+(interactive?' interactive':'')}
    role={interactive?'group':'img'} aria-label={accessibleLabel}>
    {Array.from({length:5},(_,i)=>{
      const n=i+1,filled=n<=Math.round(value);
      return interactive?
        <button className={'star-choice'+(filled?' filled':'')} key={n} type="button"
          aria-label={n+' '+(n===1?'estrela':'estrelas')} aria-pressed={value===n}
          onClick={()=>onChange(n)}><StarIcon filled={filled} size={size}/></button>:
        <span className={'star-static'+(filled?' filled':'')} key={n}>
          <StarIcon filled={filled} size={size}/>
        </span>;
    })}
  </div>;
}
