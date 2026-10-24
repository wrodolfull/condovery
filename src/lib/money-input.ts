/** Parse an editable BRL value into integer cents without floating-point rounding. */
export function parseMoneyInput(raw:string):number|null{
  if(!/^\d{0,5}(?:[.,]\d{0,2})?$/.test(raw))return null;
  if(raw==='')return 0;
  const [whole,fraction='']=raw.replace(',','.').split('.');
  const cents=Number(whole||'0')*100+Number(fraction.padEnd(2,'0')||'0');
  return Number.isSafeInteger(cents)&&cents<=1_000_000?cents:null;
}
