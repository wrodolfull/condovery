export type TowerScheme='letters'|'numbers';
export function towerLabel(scheme:TowerScheme,index:number):string {
  if(!Number.isInteger(index)||index<0||index>=30)throw new Error('Índice de torre inválido.');
  if(scheme==='numbers')return 'Torre '+(index+1);
  // Excel-style alphabet sequence: A...Z, AA...AD (30 towers).
  let value=index+1,letters='';
  while(value>0){value--;letters=String.fromCharCode(65+(value%26))+letters;value=Math.floor(value/26);}
  return 'Torre '+letters;
}
export function towerLabels(scheme:TowerScheme,count:number):string[]{
  if(!['letters','numbers'].includes(scheme)||!Number.isInteger(count)||count<1||count>30)
    throw new Error('Informe entre 1 e 30 torres.');
  return Array.from({length:count},(_,i)=>towerLabel(scheme,i));
}
export function currentTowerScheme(towers:string[]):TowerScheme|null{
  if(towers.length===0||towers.length>30)return null;
  if(towers.every((value,index)=>value===towerLabel('letters',index)))return 'letters';
  if(towers.every((value,index)=>value===towerLabel('numbers',index)))return 'numbers';
  return null;
}
