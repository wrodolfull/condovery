/** Keep cart suggestions within the active seller's visible, purchasable catalog. */
export function recommendStoreProducts<P extends {
  id:string;
  shop_id:string;
  visibility:'available'|'unavailable'|'hidden';
  stock:number|null;
  is_open?:boolean;
}>(
  products:readonly P[],
  shopId:string,
  cart:readonly {product:{id:string}}[],
  limit=8
):P[]{
  const inCart=new Set(cart.map(line=>line.product.id));
  const seen=new Set<string>();
  return products.filter(product=>{
    if(product.shop_id!==shopId||product.visibility!=='available'||
      product.stock===0||product.is_open===false||
      inCart.has(product.id)||seen.has(product.id))return false;
    seen.add(product.id);
    return true;
  }).slice(0,Math.max(0,limit));
}
