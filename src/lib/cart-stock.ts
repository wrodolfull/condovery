/** Limites de estoque compartilhados por todas as linhas de um produto.
 * stock=null significa estoque ilimitado; o limite individual de 30 permanece.
 */
export type StockLine={product:{id:string};quantity:number};
export function unitsInCart(lines:readonly StockLine[],id:string,excludingIndex=-1):number{
  return lines.reduce((total,line,index)=>total+(index!==excludingIndex&&line.product.id===id?line.quantity:0),0);
}
export function remainingToAdd(stock:number|null,lines:readonly StockLine[],id:string):number|null{
  return stock===null?null:Math.max(0,stock-unitsInCart(lines,id));
}
export function maxLineQuantity(stock:number|null,lines:readonly StockLine[],id:string,lineIndex:number):number{
  if(stock===null)return 30;
  return Math.max(0,Math.min(30,stock-unitsInCart(lines,id,lineIndex)));
}
