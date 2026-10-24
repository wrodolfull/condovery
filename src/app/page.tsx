'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {IllustrationSlot} from '@/components/IllustrationSlot';
import {RoundedStars} from '@/components/RoundedStars';
import {ImageCropper,type ImageKind} from '@/components/ImageCropper';
import {artwork,getCategoryArtwork} from '@/lib/artwork';
import {IMAGE_MIME_TYPES, imageSizeIsAllowed} from '@/lib/image-limits';
import {selectedOptions, extrasTotal, arrivalInstructionOptions, toggleArrivalInstruction, type OptionGroup, type Selection} from '@/lib/orders';
import {
  ArrowLeft, ArrowRight, Bell, Building2, CakeSlice, Check, CheckCircle2, ChevronDown, ChevronRight,
  CircleHelp, Clock3, Coffee, Gift, Heart, Home, ImagePlus, LayoutGrid, LogOut, MapPin,
  Menu, MessageCircle, Minus, Package, Plus, Receipt, Search, Settings, Share2, ShieldCheck, ShoppingBag, ShoppingBasket,
  SlidersHorizontal, Sparkles, Store, Tag, Trash2, Truck, UserRound, Utensils, X, Shirt, Sandwich,
  Pizza, IceCreamCone, Wrench, HeartPulse, House, Smartphone, PauseCircle, PlayCircle
} from 'lucide-react';

type Viewer={id:string;name:string;email:string;phone:string;avatar_image:string|null;role:'admin'|'resident';status:'pending'|'approved'|'suspended';tower:string;apartment:string;condominium_name:string;towers:string[]};
type Category={id:string;name:string;icon:string};
type Shop={id:string;name:string;description:string;cover_image:string|null;logo_image:string|null;status?:string;is_open:boolean;delivery_enabled:boolean;delivery_fee_cents:number;pickup_enabled:boolean;lead_time:string;pickup_instructions?:string;whatsapp?:string};
type Product={id:string;shop_id:string;shop_name?:string;visibility:'available'|'unavailable'|'hidden';category_id:string;name:string;description:string;price_cents:number;promo_price_cents:number|null;image_url:string|null;stock:number|null;is_available?:boolean;lead_time?:string;is_featured?:boolean;option_groups?:OptionGroup[]};
type Order={id:string;code:number;status:string;review_status?:'pending'|'approved'|'rejected'|null;total_cents:number;shop_name:string;buyer_name:string;buyer_phone:string;tower:string;apartment:string;fulfillment:string;delivery_day:string|null;delivery_window:string;delivery_instructions:string[];note:string;subtotal_cents:number;delivery_fee_cents:number;items:{name:string;quantity:number;unit_price_cents:number;note:string;options?:{group:string;name:string;price_cents:number}[]}[];created_at:string};
type ReviewStatus='pending'|'approved'|'rejected';
type PublicReview={id:string;rating:number;description:string;created_at:string};
type ReviewSummary={average:number|null;count:number};
type PublicReviews={summary:ReviewSummary;reviews:PublicReview[]};
type SellerReview={id:string;order_id:string;order_code:number;rating:number;description:string;status:ReviewStatus;created_at:string;moderated_at:string|null};
type ContentReport={id:string;target_type:'shop'|'product';target_id:string;target_name:string;reason:string;details:string;product_blocked:boolean;status:'open'|'resolved';created_at:string};
type CartItem={product:Product;quantity:number;note:string;selections?:Selection;line_key?:string};
type CheckoutQuote={subtotal_cents:number;delivery_fee_cents:number;total_cents:number;lines:{
  name:string;quantity:number;unit_price_cents:number;total_cents:number;
  options:{group:string;name:string;price_cents:number}[];note:string
}[]};
const addOns=(p:Product,choices:Selection={})=>{
  try{return extrasTotal(selectedOptions(p.option_groups??[],choices));}catch{return 0;}
};
const cartUnitPrice=(i:CartItem)=>price(i.product)+addOns(i.product,i.selections);
const moneyInput=(v:number)=>Number.isFinite(v)?(v/100).toFixed(2):'0.00';
function MoneyInput({cents,onValue}:{cents:number;onValue:(value:number)=>void}){
  const [raw,setRaw]=useState(moneyInput(cents));
  const [focused,setFocused]=useState(false);
  useEffect(()=>{if(!focused)setRaw(moneyInput(cents));},[cents,focused]);
  return <input type="text" inputMode="decimal" autoComplete="off"
    value={raw} onFocus={e=>{setFocused(true);e.target.select();}}
    onChange={e=>{
      const value=e.target.value;
      if(!/^\\d{0,5}(?:[.,]\\d{0,2})?$/.test(value))return;
      setRaw(value);
      const num=Number(value.replace(',','.'));
      onValue(Number.isFinite(num)?Math.round(num*100):0);
    }} onBlur={()=>setFocused(false)}/>;
}
type HomeData={categories:Category[];shops:Shop[];products:Product[]};
type AdminData={residents:{id:string;name:string;email:string;tower:string;apartment:string;status:string}[];shops:{id:string;name:string;owner_name:string;status:string}[];stats:{residents:number;shops:number;orders:number};categories:Category[]};
type View='home'|'categories'|'favorites'|'orders'|'account'|'shop'|'product'|'cart'|'success'|'seller'|'admin';
const money=(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);
const price=(p:Product)=>p.promo_price_cents??p.price_cents;
const statusLabel:Record<string,string>={awaiting_confirmation:'Aguardando confirmação',confirmed:'Confirmado',completed:'Concluído',cancelled:'Cancelado',pending:'Em análise',approved:'Ativo',suspended:'Suspenso',deleted:'Excluído'};
const emptyHome:HomeData={categories:[],shops:[],products:[]};
const cartShopSafe=(cart:CartItem[],shops:Shop[],selected:{shop:Shop}|null)=>{
  return shops.find(s=>s.id===cart[0]?.product.shop_id)||
    (selected&&cart.length>0&&selected.shop.id===cart[0].product.shop_id?selected.shop:undefined);
};
type OrderFilter='all'|'awaiting_confirmation'|'confirmed'|'completed'|'cancelled';
const orderFilters:{key:OrderFilter;label:string}[]=[
  {key:'all',label:'Todos'},
  {key:'awaiting_confirmation',label:'Criados'},
  {key:'confirmed',label:'Confirmados'},
  {key:'completed',label:'Concluídos'},
  {key:'cancelled',label:'Cancelados'}
];

// Compress large photos before our API request (Vercel Functions: 4.5 MB).
// The backend independently validates image format and size.
async function prepareImageForUpload(file:File):Promise<File>{
  if(!IMAGE_MIME_TYPES.some(type=>type===file.type))throw new Error('Imagem deve ser JPG, PNG ou WebP.');
  if(!imageSizeIsAllowed(file.size))throw new Error('A imagem deve ter no máximo 10 MB.');
  if(file.size<=4_000_000)return file;
  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(file);}
  catch{throw new Error('Não foi possível ler a imagem selecionada.');}
  try{
    const ratio=Math.min(1,960/bitmap.width,960/bitmap.height);
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
    canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw new Error('Não foi possível preparar a imagem.');
    ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(
      result=>result?resolve(result):reject(new Error('Não foi possível otimizar a imagem.')),
      'image/webp',0.8
    ));
    if(blob.type!=='image/webp'||!imageSizeIsAllowed(blob.size)||blob.size>4_000_000)
      throw new Error('Não foi possível reduzir a imagem para envio.');
    return new File([blob],'foto.webp',{type:'image/webp'});
  }finally{bitmap.close();}
}

async function api<T>(url:string,opts:RequestInit={}):Promise<T>{
  const res=await fetch('/api/'+url,{credentials:'same-origin',...opts,headers:{...(opts.body instanceof FormData?{}:{'Content-Type':'application/json'}),...opts.headers}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||'Não foi possível concluir.');
  return data as T;
}
const payload=(data:unknown)=>JSON.stringify(data);
function ShopLogo({src,name}:{src?:string|null;name:string}){
  return <div className="shop-logo">{src?<img src={src} alt={'Foto da loja '+name}/>:<Store size={27}/>}</div>;
}
function ProductPicture({src,name,large=false}:{src?:string|null;name:string;large?:boolean}){
  return <div className={'product-photo'+(large?' product-photo-lg':'')}>
    {src?<img src={src} alt={name} loading="lazy"/>:<div className="photo-placeholder"><ShoppingBasket size={large?54:34} strokeWidth={1.5}/><span>feito por vizinhos</span></div>}
  </div>;
}
function CategorySymbol({name,icon}:{name:string;icon?:string}){
  const lower=name.toLowerCase();
  const icons:Record<string,React.ElementType>={
    'cake-slice':CakeSlice,'sandwich':Sandwich,'utensils':Utensils,'coffee':Coffee,
    'sparkles':Sparkles,'shirt':Shirt,'gift':Gift,'shopping-bag':ShoppingBag,
    'pizza':Pizza,'ice-cream-cone':IceCreamCone,'shopping-basket':ShoppingBasket,
    'wrench':Wrench,'heart-pulse':HeartPulse,'house':House,'smartphone':Smartphone
  };
  const Fallback=lower.includes('bolo')||lower.includes('doce')?CakeSlice:lower.includes('pão')||lower.includes('salgado')?ShoppingBasket:lower.includes('refei')?Utensils:lower.includes('bebida')?Coffee:lower.includes('presente')?Gift:lower.includes('beleza')?Sparkles:ShoppingBag;
  const Icon=icons[icon??'']??Fallback;
  return <Icon size={25} strokeWidth={1.8}/>;
}
function Pill({children,tone='neutral'}:{children:React.ReactNode;tone?:'neutral'|'green'|'orange'}){
  return <span className={'pill pill-'+tone}>{children}</span>;
}
function SectionHeader({title,action,onAction}:{title:string;action?:string;onAction?:()=>void}){
  return <div className="section-heading"><h2>{title}</h2>{action&&<button className="quiet-link" onClick={onAction}>{action}<ChevronRight size={15}/></button>}</div>;
}
function CategoryArtwork({category}:{category:Category}){
  return <IllustrationSlot className="category-art" src={getCategoryArtwork(category.name,category.icon)}
    alt={'Categoria '+category.name} fit="contain"
    fallback={<CategorySymbol name={category.name} icon={category.icon}/>}/>;
}
function Empty({title,subtitle,action,onAction,art='emptyProducts'}:{title:string;subtitle:string;action?:string;onAction?:()=>void;art?:'emptyProducts'|'emptyShops'|'emptyOrders'|'emptyFavorites'}){
  return <div className="empty-state"><IllustrationSlot className="empty-art" src={artwork[art]} alt={title}
    fallback={<ShoppingBasket size={35}/>}/><h3>{title}</h3><p>{subtitle}</p>
    {action&&<button className="outline-button" onClick={onAction}>{action}</button>}</div>;
}
function OrderProgress({status}:{status:string}) {
  if(status==='cancelled')return <p className="order-progress-note">Este pedido foi cancelado. Consulte a loja pelo WhatsApp para esclarecer dúvidas.</p>;
  const current=status==='completed'?3:status==='confirmed'?2:1;
  const steps=['Pedido criado','Confirmado','Concluído'];
  return <div className="order-progress" aria-label={'Andamento do pedido: '+(statusLabel[status]??status)}>
    {steps.map((label,index)=><div className={'order-progress-step'+(index<current?' completed':'')} key={label}>
      <span className="order-step-dot">{index<current?<Check size={12} strokeWidth={3}/>:index+1}</span>
      <span>{label}</span>
    </div>)}
  </div>;
}
function ProductCard({p,onClick,favorite,onFavorite}:{p:Product;onClick:()=>void;favorite:boolean;onFavorite:(id:string)=>void}){
  return <article className={'product-card'+(p.visibility==='unavailable'?' is-unavailable':'')}>
    {p.visibility==='unavailable'&&<span className="unavailable-tag">Indisponível</span>}
    <button className="product-open" onClick={onClick} aria-label={'Ver '+p.name}>
      <ProductPicture src={p.image_url} name={p.name}/>
      {p.promo_price_cents!=null&&<span className="card-offer">Oferta</span>}
      <div className="product-meta"><span className="product-name">{p.name}</span><span className="muted ellipsis">{p.shop_name??''}</span>
        <div className="product-prices">{p.promo_price_cents!=null&&<del>{money(p.price_cents)}</del>}<strong>{money(price(p))}</strong></div>
      </div>
    </button>
    <button className={'favorite-heart'+(favorite?' is-favorite':'')} onClick={()=>onFavorite(p.id)} aria-label={favorite?'Remover dos favoritos':'Salvar nos favoritos'} aria-pressed={favorite}>
      <Heart size={19} fill={favorite?'currentColor':'none'}/>
    </button>
  </article>;
}

export default function Page(){
  const [viewer,setViewer]=useState<Viewer|null>(null);
  const [loading,setLoading]=useState(true);
  const [authMode,setAuthMode]=useState<'login'|'register'|'recover'|'reset'>('login');
  const [passwordRecoveryEnabled,setPasswordRecoveryEnabled]=useState(false);
  const [showDeleteAccount,setShowDeleteAccount]=useState(false);
  const [deleteConfirmation,setDeleteConfirmation]=useState('');
  const [deletePassword,setDeletePassword]=useState('');
  const [resetEmail,setResetEmail]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [googleEnabled,setGoogleEnabled]=useState(false);
  const [googleSignup,setGoogleSignup]=useState<{email:string;name:string}|null>(null);
  const [authForm,setAuthForm]=useState({name:'',email:'',phone:'',password:'',invite:'',tower:'',apartment:''});
  const [condoLookup,setCondoLookup]=useState<{name:string;towers:string[]}|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [toast,setToast]=useState('');
  const [view,setView]=useState<View>('home');
  const [home,setHome]=useState<HomeData>(emptyHome);
  const [favoriteIds,setFavoriteIds]=useState<string[]>([]);
  const [favoriteProducts,setFavoriteProducts]=useState<Product[]>([]);
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState('');
  const [catalogProducts,setCatalogProducts]=useState<Product[]>([]);
  const [catalogPage,setCatalogPage]=useState(0);
  const [catalogHasMore,setCatalogHasMore]=useState(false);
  const [catalogLoading,setCatalogLoading]=useState(false);
  const [selectedShop,setSelectedShop]=useState<{shop:Shop;products:Product[]}|null>(null);
  const [shopReviews,setShopReviews]=useState<PublicReviews|null>(null);
  const [sellerReviews,setSellerReviews]=useState<SellerReview[]>([]);
  const [reviewOrderId,setReviewOrderId]=useState<string|null>(null);
  const [reviewRating,setReviewRating]=useState(0);
  const [reviewText,setReviewText]=useState('');
  const [sharedShopId,setSharedShopId]=useState<string|null>(null);
  const [selectedProduct,setSelectedProduct]=useState<Product|null>(null);
  const [qty,setQty]=useState(1);
  const [itemNote,setItemNote]=useState('');
  const [productChoices,setProductChoices]=useState<Selection>({});
  const [cart,setCart]=useState<CartItem[]>([]);
  const [fulfillment,setFulfillment]=useState<'delivery'|'pickup'>('delivery');
  const [deliveryDay,setDeliveryDay]=useState('');
  const [deliveryWindow,setDeliveryWindow]=useState('');
  const [instructions,setInstructions]=useState<string[]>([]);
  const [checkoutNote,setCheckoutNote]=useState('');
  const [lastOrder,setLastOrder]=useState<{code:number;whatsapp_url:string}|null>(null);
  const [checkoutKey,setCheckoutKey]=useState<string|null>(null);
  const [revisedQuote,setRevisedQuote]=useState<CheckoutQuote|null>(null);
  const [orders,setOrders]=useState<Order[]>([]);
  const [orderFilter,setOrderFilter]=useState<OrderFilter>('all');
  const [ordersLoading,setOrdersLoading]=useState(false);
  const [sellerOrders,setSellerOrders]=useState<Order[]>([]);
  const [myShop,setMyShop]=useState<Shop|null>(null);
  const [showDeleteShop,setShowDeleteShop]=useState(false);
  const [shopDeleteConfirmation,setShopDeleteConfirmation]=useState('');
  const [cropRequest,setCropRequest]=useState<{file:File;kind:ImageKind}|null>(null);
  const [myProducts,setMyProducts]=useState<Product[]>([]);
  const [adminData,setAdminData]=useState<AdminData|null>(null);
  const [sellerTab,setSellerTab]=useState<'orders'|'products'|'reviews'|'settings'>('orders');
  const [shopForm,setShopForm]=useState({name:'',description:'',whatsapp:'',is_open:true,delivery_enabled:true,delivery_fee_cents:0,pickup_enabled:true,lead_time:'',pickup_instructions:'',cover_image:'',logo_image:''});
  const [productForm,setProductForm]=useState({id:'',name:'',description:'',category_id:'',price:'',promo:'',stock:'',image_url:'',visibility:'available' as Product['visibility'],lead_time:'',option_groups:[] as OptionGroup[]});
  const [editingProduct,setEditingProduct]=useState(false);
  const [profile,setProfile]=useState({name:'',phone:'',tower:'',apartment:'',avatar_image:''});
  const [invite,setInvite]=useState('');
  const [customCode,setCustomCode]=useState('');
  const [acceptedGuidelines,setAcceptedGuidelines]=useState(false);
  const [reports,setReports]=useState<ContentReport[]>([]);
  const [reportTarget,setReportTarget]=useState<{type:'shop'|'product';id:string;name:string}|null>(null);
  const [reportReason,setReportReason]=useState<'language'|'image'|'inappropriate'|'other'>('image');
  const [reportDetails,setReportDetails]=useState('');
  const [newCategory,setNewCategory]=useState('');
  const [categoryIcon,setCategoryIcon]=useState('sandwich');

  const notify=(msg:string)=>{setToast(msg);setError('');};
  const fail=(e:unknown)=>setError(e instanceof Error?e.message:'Não foi possível concluir.');
  const go=(next:View)=>{
    setError('');setView(next);
    if(next!=='shop'){
      const url=new URL(window.location.href);
      if(url.searchParams.has('loja')){
        url.searchParams.delete('loja');
        window.history.replaceState({},'',url.pathname+url.search);
      }
    }
    window.scrollTo({top:0,behavior:'smooth'});
  };
  const loadHome=useCallback(async()=>{setHome(await api<HomeData>('home'));},[]);
  const loadFavorites=useCallback(async()=>{
    const result=await api<{ids:string[];products:Product[]}>('favorites');
    setFavoriteIds(result.ids);setFavoriteProducts(result.products);
  },[]);
  const loadMine=useCallback(async()=>{
    const data=await api<{shop:Shop|null;products:Product[]}>('shops/mine');
    setMyShop(data.shop);setMyProducts(data.products);
    if(data.shop)setShopForm({
      name:data.shop.name,description:data.shop.description,whatsapp:data.shop.whatsapp??'',
      is_open:data.shop.is_open,delivery_enabled:data.shop.delivery_enabled,delivery_fee_cents:data.shop.delivery_fee_cents??0,pickup_enabled:data.shop.pickup_enabled,
      lead_time:data.shop.lead_time??'',pickup_instructions:data.shop.pickup_instructions??'',cover_image:data.shop.cover_image??'',logo_image:data.shop.logo_image??''
    });
  },[]);
  const loadOrders=useCallback(async(filter:OrderFilter='all')=>{
    const search=filter==='all'?'':'?status='+encodeURIComponent(filter);
    const result=await api<{orders:Order[]}>('orders'+search);
    setOrders(result.orders);
  },[]);
  const loadSellerOrders=useCallback(async()=>{
    const result=await api<{orders:Order[]}>('orders?scope=seller');setSellerOrders(result.orders);
  },[]);
  const loadSellerReviews=useCallback(async()=>{
    const result=await api<{reviews:SellerReview[]}>('shops/mine/reviews');
    setSellerReviews(result.reviews);
  },[]);
  const loadAdmin=useCallback(async()=>{
    const [summary,queue]=await Promise.all([
      api<AdminData>('admin/summary'),api<{reports:ContentReport[]}>('admin/reports')
    ]);
    setAdminData(summary);setReports(queue.reports);
  },[]);
  const refresh=useCallback(async(u:Viewer)=>{
    await Promise.all([loadHome(),loadMine(),loadOrders(),loadFavorites(),...(u.role==='admin'?[loadAdmin()]:[])]);
  },[loadHome,loadMine,loadOrders,loadFavorites,loadAdmin]);

  useEffect(()=>{
    const link=new URLSearchParams(window.location.search).get('loja');
    if(link&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(link)){
      setSharedShopId(link);
    }
    api<{google:boolean;passwordRecovery:boolean}>('auth/providers').then(r=>{
      setGoogleEnabled(r.google);setPasswordRecoveryEnabled(r.passwordRecovery);
    }).catch(()=>{});
    const reset=new URLSearchParams(window.location.search).get('reset');
    if(reset==='1'){
      setAuthMode('reset');
      window.history.replaceState({},'',window.location.pathname);
    }
    const confirmed=new URLSearchParams(window.location.search).get('email_confirmed');
    if(confirmed==='1'){
      setToast('E-mail confirmado pelo Supabase Auth. Entre com sua senha.');
      window.history.replaceState({},'',window.location.pathname);
    }
    const oauthFailure=new URLSearchParams(window.location.search).get('auth_error');
    if(oauthFailure){
      setError('Não foi possível concluir o acesso Google. Tente novamente.');
      window.history.replaceState({},'',window.location.pathname);
    }
  },[]);
  useEffect(()=>{
    let active=true;
    api<{viewer:Viewer|null;googleSignup?:{email:string;name:string}|null}>('me').then(async r=>{
      if(!active)return;setViewer(r.viewer);
      if(r.googleSignup){
        setGoogleSignup(r.googleSignup);
        setAuthMode('register');
        setAuthForm(s=>({...s,name:r.googleSignup!.name,email:r.googleSignup!.email,password:''}));
      }
      if(r.viewer){
        setProfile({name:r.viewer.name,phone:r.viewer.phone,tower:r.viewer.tower,apartment:r.viewer.apartment,avatar_image:r.viewer.avatar_image??''});
        if(r.viewer.status==='approved')await refresh(r.viewer);
      }
    }).catch(e=>{if(active)fail(e);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[refresh]);

  useEffect(()=>{
    try{const raw=window.localStorage.getItem('condovery_cart');if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed))setCart(parsed);}}catch{}
  },[]);
  useEffect(()=>{try{window.localStorage.setItem('condovery_cart',JSON.stringify(cart));}catch{}},[cart]);
  useEffect(()=>{
    setCheckoutKey(null);setRevisedQuote(null);
  },[cart,fulfillment,deliveryDay,deliveryWindow,instructions,checkoutNote]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{if(view==='seller'&&myShop?.status==='approved'){
    loadSellerOrders().catch(fail);
    loadSellerReviews().catch(fail);
  }},[view,myShop?.status,loadSellerOrders,loadSellerReviews]);
  useEffect(()=>{
    if(viewer?.status!=='approved'||!sharedShopId)return;
    const id=sharedShopId;setSharedShopId(null);
    openShop(id);
  },[viewer?.id,viewer?.status,sharedShopId]);
  useEffect(()=>{
    if(view!=='orders'||viewer?.status!=='approved')return;
    let active=true;
    setOrdersLoading(true);
    loadOrders(orderFilter).catch(e=>{if(active)fail(e);})
      .finally(()=>{if(active)setOrdersLoading(false);});
    return()=>{active=false;};
  },[view,orderFilter,viewer?.status,loadOrders]);
  useEffect(()=>{setCatalogPage(0);setCatalogProducts([]);},[query,category]);
  useEffect(()=>{
    if(!viewer||viewer.status!=='approved'||(view!=='home'&&view!=='categories'))return;
    if(view==='home'&&!query.trim())return;
    let active=true;
    const timer=window.setTimeout(()=>{
      setCatalogLoading(true);
      const params=new URLSearchParams({page:String(catalogPage),limit:'24'});
      if(query.trim())params.set('search',query.trim());
      if(category)params.set('category',category);
      api<{products:Product[];hasMore:boolean}>('catalog?'+params.toString()).then(r=>{
        if(!active)return;
        setCatalogProducts(old=>catalogPage===0?r.products:[...old,...r.products]);
        setCatalogHasMore(r.hasMore);
      }).catch(e=>{if(active)fail(e);}).finally(()=>{if(active)setCatalogLoading(false);});
    },query.trim()?300:100);
    return()=>{active=false;window.clearTimeout(timer);};
  },[viewer?.id,viewer?.status,view,category,query,catalogPage]);
  const categoryName=home.categories.find(c=>c.id===category)?.name;
  const filtered=useMemo(()=>view==='categories'||query.trim()?catalogProducts:home.products,
    [view,query,catalogProducts,home.products]);
  const cartSubtotal=cart.reduce((n,i)=>n+cartUnitPrice(i)*i.quantity,0);
  const actualFulfillment: 'delivery'|'pickup'=cartShopSafe(cart,home.shops,selectedShop)?.delivery_enabled===false?'pickup':
    (cartShopSafe(cart,home.shops,selectedShop)?.pickup_enabled===false?'delivery':fulfillment);
  const fee=actualFulfillment==='delivery'?Number(cartShopSafe(cart,home.shops,selectedShop)?.delivery_fee_cents??0):0;
  const cartTotal=cartSubtotal+fee;
  const cartCount=cart.reduce((n,i)=>n+i.quantity,0);
  const cartShop=home.shops.find(s=>s.id===cart[0]?.product.shop_id)||selectedShop?.shop;
  const featured=home.products.filter(p=>p.promo_price_cents!=null||p.is_featured).slice(0,8);
  const newest=home.products.slice(0,10);

  async function toggleFavorite(id:string){
    const exists=favoriteIds.includes(id);
    setFavoriteIds(old=>exists?old.filter(x=>x!==id):[id,...old]);
    try{
      await api(exists?'favorites/'+id:'favorites',{method:exists?'DELETE':'POST',...(!exists?{body:payload({product_id:id})}:{})});
      await loadFavorites();
    }catch(e){await loadFavorites().catch(()=>{});fail(e);}
  }
  async function submitReset(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{
      if(authMode==='recover'){
        const r=await api<{message:string}>('auth/password/request',{
          method:'POST',body:payload({email:resetEmail})
        });
        notify(r.message);
      }else if(authMode==='reset'){
        const r=await api<{message:string}>('auth/password/confirm',{
          method:'POST',body:payload({password:newPassword})
        });
        setNewPassword('');setAuthMode('login');notify(r.message);
      }
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function lookupCondo(){
    if(authForm.invite.trim().length<10){setCondoLookup(null);return;}
    try{
      const r=await api<{name:string;towers:string[]}>('public/condominium',{
        method:'POST',body:payload({invite:authForm.invite.trim()})
      });
      setCondoLookup(r);setError('');setAuthForm(s=>({...s,tower:r.towers.includes(s.tower)?s.tower:r.towers[0]??''}));
    }catch(e){setCondoLookup(null);fail(e);}
  }
  async function loginOrRegister(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{
      if(authMode==='register'&&googleSignup){
        await api('auth/register-google',{
          method:'POST',
          body:payload({name:authForm.name,phone:authForm.phone,invite:authForm.invite,tower:authForm.tower,apartment:authForm.apartment})
        });
        const response=await api<{viewer:Viewer}>('me');
        setGoogleSignup(null);setViewer(response.viewer);
        setProfile({name:response.viewer.name,phone:response.viewer.phone,tower:response.viewer.tower,apartment:response.viewer.apartment,avatar_image:response.viewer.avatar_image??''});
        await refresh(response.viewer);
        go('home');
      } else if(authMode==='register'){
        const result=await api<{message:string}>('auth/register',{method:'POST',body:payload(authForm)});
        setAuthMode('login');setAuthForm(s=>({...s,password:''}));notify(result.message);
      } else {
        await api('auth/login',{method:'POST',body:payload({email:authForm.email,password:authForm.password})});
        const response=await api<{viewer:Viewer}>('me');setViewer(response.viewer);
        const u=response.viewer;
        if(u.status==='approved')await refresh(u);
        setProfile({name:u.name,phone:u.phone,tower:u.tower,apartment:u.apartment,avatar_image:u.avatar_image??''});
        go('home');
      }
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function deleteAccount(e:React.FormEvent){
    e.preventDefault();
    if(deleteConfirmation!=='EXCLUIR'||busy)return;
    setBusy(true);setError('');
    try{
      const result=await api<{message:string;status:'completed'|'pending'}>('me',{
        method:'DELETE',body:payload({confirmation:'EXCLUIR',password:deletePassword||undefined})
      });
      try{window.localStorage.removeItem('condovery_cart');}catch{}
      setCart([]);setViewer(null);setGoogleSignup(null);setHome(emptyHome);
      setOrders([]);setSellerOrders([]);setMyShop(null);setMyProducts([]);
      setFavoriteIds([]);setFavoriteProducts([]);
      setShowDeleteAccount(false);setDeleteConfirmation('');setDeletePassword('');
      setAuthMode('login');go('home');notify(result.message);
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function logout(){
    try{await api('auth/logout',{method:'POST'});}catch{}
    setViewer(null);setGoogleSignup(null);setHome(emptyHome);setFavoriteIds([]);setFavoriteProducts([]);setCart([]);setMyShop(null);setOrders([]);go('home');
  }
  async function openShop(id:string){
    setBusy(true);
    try{
      const [data,reviews]=await Promise.all([
        api<{shop:Shop;products:Product[]}>('shops/'+id),
        api<PublicReviews>('shops/'+id+'/reviews')
      ]);
      setSelectedShop(data);setShopReviews(reviews);go('shop');
      const url=new URL(window.location.href);
      url.searchParams.set('loja',id);
      window.history.replaceState({},'',url.pathname+url.search);
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function shareShop(id:string,name:string){
    const url=new URL('/',window.location.origin);
    url.searchParams.set('loja',id);
    const link=url.toString();
    if(typeof navigator.share==='function'){
      try{
        await navigator.share({title:name,text:'Conheça esta loja no Condovery!',url:link});
        return;
      }catch(e){
        if(e instanceof DOMException&&e.name==='AbortError')return;
      }
    }
    try{
      await navigator.clipboard.writeText(link);
      notify('Link da loja copiado!');
    }catch{
      window.prompt('Copie o link da loja:',link);
    }
  }
  async function sendReview(e:React.FormEvent){
    e.preventDefault();
    if(!reviewOrderId)return;
    setBusy(true);setError('');
    try{
      await api('orders/'+reviewOrderId+'/review',{
        method:'POST',body:payload({rating:reviewRating,description:reviewText.trim()})
      });
      setReviewOrderId(null);setReviewRating(0);setReviewText('');
      await loadOrders(orderFilter);
      notify('Avaliação enviada! Ela será publicada após aprovação da loja.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function moderateReview(id:string,status:'approved'|'rejected'){
    setBusy(true);setError('');
    try{
      await api('shops/mine/reviews/'+id,{method:'PATCH',body:payload({status})});
      await loadSellerReviews();
      notify(status==='approved'?'Avaliação publicada.':'Avaliação não publicada.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  function openProduct(p:Product){setSelectedProduct(p);setQty(1);setItemNote('');setProductChoices({});go('product');}
  function changeChoice(group:OptionGroup,id:string){
    setProductChoices(current=>{
      const currentIds=current[group.id]??[];
      const selected=group.multiple
        ?currentIds.includes(id)?currentIds.filter(x=>x!==id):[...currentIds,id]
        :[id];
      return {...current,[group.id]:selected};
    });
  }
  const productCanBuy=(p:Product)=>p.visibility==='available'&&p.stock!==0;
  async function changeProductVisibility(id:string,visibility:Product['visibility']){
    setBusy(true);setError('');
    try{
      await api('products/'+id+'/visibility',{method:'PATCH',body:payload({visibility})});
      await Promise.all([loadMine(),loadHome(),loadFavorites()]);
      notify(visibility==='available'?'Produto disponível para compras.':
        visibility==='unavailable'?'Produto marcado como indisponível.':'Produto ocultado da vitrine.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function reopenOrderWhatsApp(id:string){
    try{
      const result=await api<{whatsapp_url:string}>('orders/'+id+'/whatsapp');
      window.location.assign(result.whatsapp_url);
    }catch(e){fail(e);}
  }
  function testShopWhatsApp(){
    const digits=shopForm.whatsapp.replace(/\D/g,'');
    if(!/^(?:55)?\d{10,11}$/.test(digits)){setError('Informe um número brasileiro com DDD.');return;}
    const number=digits.startsWith('55')&&digits.length>11?digits:'55'+digits;
    window.open('https://wa.me/'+number,'_blank','noopener,noreferrer');
  }
  function addToCart(){
    if(!selectedProduct)return;
    if(!productCanBuy(selectedProduct)){notify('Este produto está indisponível.');return;}
    try{selectedOptions(selectedProduct.option_groups??[],productChoices);}
    catch(e){fail(e);return;}
    if(cart.length&&cart[0].product.shop_id!==selectedProduct.shop_id){
      if(!window.confirm('Seu carrinho é de outra loja. Deseja substituí-lo?'))return;
    }
    setCart(current=>{
      const base=current.length&&current[0].product.shop_id!==selectedProduct.shop_id?[]:current;
      const selected={...productChoices};
      const same=base.find(i=>i.product.id===selectedProduct.id&&i.note===itemNote
        &&JSON.stringify(i.selections??{})===JSON.stringify(selected));
      return same?base.map(i=>i===same?{...i,quantity:i.quantity+qty}:i):
        [...base,{product:selectedProduct,quantity:qty,note:itemNote,selections:selected,line_key:crypto.randomUUID()}];
    });
    notify('Produto adicionado ao carrinho.');go('cart');
  }
  function checkoutPayload(key:string){
    return {
      shop_id:cart[0].product.shop_id,
      items:cart.map(i=>({id:i.product.id,quantity:i.quantity,note:i.note,selections:i.selections??{}})),
      fulfillment:actualFulfillment,delivery_day:deliveryDay||null,delivery_window:deliveryWindow,
      instructions:actualFulfillment==='delivery'?instructions:[],note:checkoutNote,client_order_key:key
    };
  }
  async function checkout(confirmed=false){
    if(!cart.length||busy)return;
    setBusy(true);setError('');
    const key=checkoutKey??crypto.randomUUID();
    if(!checkoutKey)setCheckoutKey(key);
    try{
      const payloadData=checkoutPayload(key);
      const latest=await api<{quote:CheckoutQuote}>('orders/quote',{method:'POST',body:payload(payloadData)});
      const quote=latest.quote;
      const changed=quote.total_cents!==cartTotal||
        quote.lines.some((line,i)=>line.unit_price_cents!==cartUnitPrice(cart[i]));
      const newerConfirmation=confirmed&&revisedQuote&&(
        quote.total_cents!==revisedQuote.total_cents||
        quote.lines.some((line,i)=>line.unit_price_cents!==revisedQuote.lines[i]?.unit_price_cents)
      );
      if((changed&&!confirmed)||newerConfirmation){
        setRevisedQuote(quote);
        notify('Confira o valor atualizado antes de registrar o pedido.');
        return;
      }
      const result=await api<{order:{code:number};whatsapp_url:string}>('orders',{method:'POST',body:payload({
        ...payloadData,expected_total_cents:quote.total_cents
      })});
      setLastOrder({code:result.order.code,whatsapp_url:result.whatsapp_url});
      setCheckoutKey(null);setRevisedQuote(null);setCart([]);go('success');
      void Promise.allSettled([loadOrders(),loadHome()]);
      window.location.assign(result.whatsapp_url);
    }catch(e){
      setRevisedQuote(null);
      fail(e);
    }finally{setBusy(false);}
  }
  async function updateStatus(id:string,status:string){
    setBusy(true);try{
      await api('orders/'+id,{method:'PATCH',body:payload({status})});
      await Promise.all([loadSellerOrders(),loadOrders(),loadHome(),loadMine()]);
      notify('Pedido atualizado.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function saveShop(e:React.FormEvent){
    e.preventDefault();setBusy(true);
    try{
      if(!myShop){
        await api('shops/mine',{method:'POST',body:payload({name:shopForm.name,description:shopForm.description,whatsapp:shopForm.whatsapp,accept_guidelines:acceptedGuidelines})});
        notify('Sua loja está pronta! Adicione seus produtos.');
      }else{
        await api('shops/mine',{method:'PATCH',body:payload({...shopForm,cover_image:shopForm.cover_image||null})});
        notify('Configurações salvas.');
      }
      await loadMine();await loadHome();
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function toggleShopOpen(){
    if(!myShop||myShop.status!=='approved')return;
    setBusy(true);setError('');
    try{
      const result=await api<{shop:Shop}>('shops/mine/status',{
        method:'PATCH',body:payload({is_open:!myShop.is_open})
      });
      setMyShop(result.shop);
      setShopForm(current=>({...current,is_open:result.shop.is_open}));
      await loadHome();
      notify(result.shop.is_open?'Loja reaberta e aceitando pedidos.':'Loja pausada. Novos pedidos estão bloqueados.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function deleteShop(e:React.FormEvent){
    e.preventDefault();
    if(shopDeleteConfirmation!=='EXCLUIR LOJA')return;
    setBusy(true);setError('');
    try{
      const oldId=myShop?.id;
      const result=await api<{message:string}>('shops/mine',{
        method:'DELETE',body:payload({confirmation:shopDeleteConfirmation})
      });
      setShowDeleteShop(false);setShopDeleteConfirmation('');
      setMyShop(null);setMyProducts([]);setSellerOrders([]);setSellerReviews([]);
      setShopForm({name:'',description:'',whatsapp:'',is_open:true,delivery_enabled:true,delivery_fee_cents:0,pickup_enabled:true,lead_time:'',pickup_instructions:'',cover_image:'',logo_image:''});
      setCart(items=>items.filter(item=>item.product.shop_id!==oldId));
      if(selectedShop?.shop.id===oldId)setSelectedShop(null);
      await loadHome();go('account');notify(result.message);
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  function choosePhoto(file:File|undefined,kind:ImageKind){
    if(!file)return;
    if(!IMAGE_MIME_TYPES.some(type=>type===file.type)){setError('Imagem deve ser JPG, PNG ou WebP.');return;}
    if(!imageSizeIsAllowed(file.size)){setError('A imagem deve ter no máximo 10 MB.');return;}
    setError('');setCropRequest({file,kind});
  }
  async function upload(file:File,kind:'product'|'cover'|'logo'|'avatar'){
    setBusy(true);setError('');
    try{
      const uploadFile=await prepareImageForUpload(file);
      const data=new FormData();data.append('file',uploadFile);
      const res=await api<{url:string}>(kind==='avatar'?'media/profile':'media',{method:'POST',body:data});
      if(kind==='product'){
        setProductForm(current=>({...current,image_url:res.url}));
        notify('Foto do produto pronta. Salve o produto.');
      }else if(kind==='avatar'){
        await api('me',{method:'PATCH',body:payload({...profile,avatar_image:res.url})});
        const result=await api<{viewer:Viewer}>('me');setViewer(result.viewer);
        setProfile(p=>({...p,avatar_image:res.url}));notify('Foto de perfil salva.');
      }else{
        const next={...shopForm,[kind==='logo'?'logo_image':'cover_image']:res.url};
        await api('shops/mine',{method:'PATCH',body:payload(next)});
        setShopForm(next);
        await loadMine();notify(kind==='logo'?'Foto da loja salva.':'Foto de capa salva.');
      }
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  function editProduct(p?:Product){
    setProductForm(p?{id:p.id,name:p.name,description:p.description,category_id:p.category_id,price:(p.price_cents/100).toFixed(2),promo:p.promo_price_cents?(p.promo_price_cents/100).toFixed(2):'',stock:p.stock==null?'':String(p.stock),image_url:p.image_url??'',visibility:p.visibility??(p.is_available?'available':'hidden'),lead_time:p.lead_time??'',option_groups:p.option_groups??[]}
      :{id:'',name:'',description:'',category_id:home.categories[0]?.id??'',price:'',promo:'',stock:'',image_url:'',visibility:'available',lead_time:'',option_groups:[]});
    setEditingProduct(true);
  }
  async function saveProduct(e:React.FormEvent){
    e.preventDefault();setBusy(true);
    try{
      const b={name:productForm.name,description:productForm.description,category_id:productForm.category_id,
        price_cents:Math.round(Number(productForm.price.replace(',','.'))*100),
        promo_price_cents:productForm.promo?Math.round(Number(productForm.promo.replace(',','.'))*100):null,
        stock:productForm.stock===''?null:Number(productForm.stock),image_url:productForm.image_url||null,
        visibility:productForm.visibility,lead_time:productForm.lead_time,option_groups:productForm.option_groups};
      await api(productForm.id?'products/'+productForm.id:'products',{method:productForm.id?'PATCH':'POST',body:payload(b)});
      setEditingProduct(false);await Promise.all([loadMine(),loadHome()]);notify('Produto salvo.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function adminAction(target:'users'|'shops',id:string,status:string){
    setBusy(true);try{await api('admin/'+target+'/'+id,{method:'PATCH',body:payload({status})});await loadAdmin();await loadHome();notify('Cadastro atualizado.');}catch(e){fail(e);}finally{setBusy(false);}
  }
  async function createCategory(e:React.FormEvent){
    e.preventDefault();setBusy(true);
    try{
      await api('admin/categories',{method:'POST',body:payload({name:newCategory,icon:categoryIcon})});
      setNewCategory('');await Promise.all([loadAdmin(),loadHome()]);notify('Categoria criada.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function saveInvite(e:React.FormEvent){
    e.preventDefault();
    if(!window.confirm('Atualizar código? O código anterior deixará de funcionar.'))return;
    setBusy(true);
    try{
      const r=await api<{invite:string}>('admin/invite',{method:'POST',body:payload({code:customCode.trim()})});
      setInvite(r.invite);setCustomCode('');notify('Código atualizado. Compartilhe com os moradores.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function unblockProduct(id:string){
    if(!window.confirm('Permitir que o vendedor revise e publique este produto novamente?'))return;
    setBusy(true);
    try{
      await api('admin/products/'+id+'/unblock',{method:'PATCH'});
      await loadAdmin();notify('Produto desbloqueado. Continua oculto até o vendedor republicar.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function sendReport(e:React.FormEvent){
    e.preventDefault();if(!reportTarget)return;
    setBusy(true);
    try{
      const result=await api<{message:string}>('reports',{method:'POST',body:payload({
        target_type:reportTarget.type,target_id:reportTarget.id,reason:reportReason,details:reportDetails.trim()
      })});
      setReportTarget(null);setReportDetails('');notify(result.message);
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function resolveReport(id:string,action:'dismiss'|'hide_product'|'suspend_shop'){
    if(action!=='dismiss'&&!window.confirm('Aplicar esta ação ao conteúdo denunciado?'))return;
    setBusy(true);
    try{
      await api('admin/reports/'+id,{method:'PATCH',body:payload({action})});
      await Promise.all([loadAdmin(),loadHome()]);notify('Denúncia analisada.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  async function saveProfile(e:React.FormEvent){
    e.preventDefault();setBusy(true);try{
      await api('me',{method:'PATCH',body:payload(profile)});
      const r=await api<{viewer:Viewer}>('me');setViewer(r.viewer);notify('Perfil atualizado.');
    }catch(e){fail(e);}finally{setBusy(false);}
  }
  const bottomNav:[View,React.ElementType,string][]=[['home',Home,'Início'],['categories',LayoutGrid,'Explorar'],['favorites',Heart,'Salvos'],['orders',Receipt,'Pedidos'],['account',UserRound,'Conta']];

  if(loading)return <main className="loading-page"><div className="spinner"/><strong>condovery.</strong><span>Preparando sua vizinhança</span></main>;
  if(!viewer&&(authMode==='recover'||authMode==='reset'))return <main className="auth-layout">
    <div className="auth-aside"><div className="auth-logo">condovery<span>.</span></div><IllustrationSlot className="auth-art" src={artwork.recoverPassword} alt="Ilustração de recuperação de acesso" eager fallback={<img src="/hero.svg" alt=""/>}/><h1>Seu condomínio mais perto de você!</h1><p>Produtos, comida e serviços dos seus vizinhos, com tudo organizado em um só lugar.</p></div>
    <section className="auth-card">
      <div className="auth-mobile-logo">condovery<span>.</span></div>
      <IllustrationSlot className="auth-state-art" src={authMode==='recover'?artwork.recoverPassword:artwork.resetPassword}
  alt={authMode==='recover'?'Recuperar senha':'Criar uma nova senha'}
  fallback={<ShieldCheck size={34}/>}/>
      <h2>{authMode==='recover'?'Recuperar senha':'Criar nova senha'}</h2>
      <p>{authMode==='recover'?'Informe seu e-mail para receber o link de recuperação.':'Escolha uma nova senha para continuar no Condovery.'}</p>
      {error&&<div className="alert" role="alert">{error}</div>}
      {toast&&<div className="success-banner" role="status">{toast}</div>}
      <form className="form-stack" onSubmit={submitReset}>
        {authMode==='recover'?<label>E-mail<input type="email" required autoComplete="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)} placeholder="seuemail@exemplo.com"/></label>:
          <label>Nova senha<input type="password" required minLength={10} maxLength={100} autoComplete="new-password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="No mínimo 10 caracteres"/></label>}
        <button className="primary-button" disabled={busy} type="submit">{busy?'Enviando...':authMode==='recover'?'Solicitar link':'Salvar nova senha'} <ArrowRight size={18}/></button>
      </form>
      <button className="text-button" onClick={()=>{setAuthMode('login');setError('');}}>Voltar ao login</button>
    </section>
  </main>;
  if(!viewer)return <main className="auth-layout">
    <div className="auth-aside"><div className="auth-logo">condovery<span>.</span></div><IllustrationSlot className="auth-art" src={artwork.login} alt="Ilustração de boas-vindas do Condovery" eager fallback={<img src="/hero.svg" alt=""/>}/><h1>Seu condomínio mais perto de você!</h1><p>Compre dos seus vizinhos. Apoie comércios locais. Receba no seu condomínio.</p></div>
    <section className="auth-card">
      <div className="auth-mobile-logo">condovery<span>.</span></div>
      <div className="auth-mobile-intro" aria-label="O seu condomínio em um só lugar">
        <div className="auth-intro-copy"><span>CONDOVERY · TUDO DE BOM MORA AQUI</span>
          <strong>Seu condomínio mais perto de você!</strong>
          <small>Compre dos seus vizinhos, apoie comércios locais e receba no condomínio.</small>
        </div>
        <IllustrationSlot className="auth-mobile-art" src={artwork.login} alt="Ilustração de boas-vindas" eager fallback={<img src="/hero.svg" alt=""/>}/>
      </div>
      <div className="welcome-emoji"><ShoppingBag size={28}/></div>
      <h2>{googleSignup?'Informações do morador':authMode==='login'?'Bem-vindo(a)!':'Cadastrar conta'}</h2>
      <p>{googleSignup?'Seu e-mail já está confirmado. Informe os dados do condomínio para entrar.':authMode==='login'?'Acesse sua conta para continuar.':'Crie sua conta e descubra o que seus vizinhos oferecem.'}</p>
      {error&&<div role="alert" className="alert">{error}</div>}
      {toast&&<div className="success-banner">{toast}</div>}
      <form onSubmit={loginOrRegister} className="form-stack">
        {authMode==='register'&&<>
          <label>Nome completo<input required autoComplete="name" value={authForm.name} onChange={e=>setAuthForm(s=>({...s,name:e.target.value}))} placeholder="Como podemos chamar você?"/></label>
          <label>WhatsApp<input required type="tel" autoComplete="tel" value={authForm.phone} onChange={e=>setAuthForm(s=>({...s,phone:e.target.value}))} placeholder="(11) 99999-9999"/></label>
          <label>Código de convite<input required value={authForm.invite} onBlur={lookupCondo} onChange={e=>{setCondoLookup(null);setAuthForm(s=>({...s,invite:e.target.value,tower:'' }));}} placeholder="Código fornecido pelo condomínio"/></label>{condoLookup&&<div className="success-banner"><CheckCircle2 size={15}/> {condoLookup.name}</div>}
          <div className="field-grid"><label>Torre<select required disabled={!condoLookup} value={authForm.tower} onChange={e=>setAuthForm(s=>({...s,tower:e.target.value}))}><option value="">Selecione a torre</option>{condoLookup?.towers.map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Apartamento<input required value={authForm.apartment} onChange={e=>setAuthForm(s=>({...s,apartment:e.target.value}))} placeholder="Ex.: 83"/></label></div>
          <p className="form-hint">Com o código do condomínio, você entra sem aguardar aprovação.</p>
        </>}
        <label>E-mail<input required readOnly={Boolean(googleSignup)} type="email" autoComplete="email" value={authForm.email} onChange={e=>setAuthForm(s=>({...s,email:e.target.value}))} placeholder="seuemail@exemplo.com"/></label>
        {!googleSignup&&<label>Senha<input required type="password" minLength={authMode==='register'?10:1} autoComplete={authMode==='register'?'new-password':'current-password'} value={authForm.password} onChange={e=>setAuthForm(s=>({...s,password:e.target.value}))} placeholder={authMode==='register'?'Mínimo de 10 caracteres':'Sua senha'}/></label>}
        <button className="primary-button" type="submit" disabled={busy}>{busy?'Processando...':authMode==='login'?'Entrar com e-mail':'Criar minha conta'}<ArrowRight size={19}/></button>
      </form>
      {!googleSignup&&googleEnabled&&<>
        <div className="auth-divider"><span>ou continue com</span></div>
        <a className="google-button" href="/api/auth/google" aria-label="Continuar com Google">
          <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.3c0-.8-.1-1.5-.2-2.3H12v4.4h6c-.3 1.4-1.1 2.5-2.4 3.2v2.7h3.9c2.2-2.1 3.1-4.8 3.1-8Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.4-2.7l-3.9-2.7c-1.1.7-2.3 1.1-3.5 1.1-2.7 0-5-1.8-5.8-4.3h-4V17c1.8 3.6 5.5 6 9.8 6Z"/><path fill="#FBBC05" d="M6.2 14.4a6.8 6.8 0 0 1 0-4.7V7h-4C1.4 8.6 1 10.3 1 12s.4 3.4 1.2 5l4-2.6Z"/><path fill="#EA4335" d="M12 5.3c1.7 0 3.2.6 4.4 1.7l3.4-3.4C17.8 1.8 15.2 1 12 1 7.7 1 4 3.4 2.2 7l4 2.7c.8-2.6 3.1-4.4 5.8-4.4Z"/></svg>
          Continuar com Google
        </a>
      </>}
      {!googleSignup&&authMode==='login'&&passwordRecoveryEnabled&&<button className="forgot-button" onClick={()=>{setAuthMode('recover');setError('');setToast('');}}>Esqueci minha senha</button>}
      {!googleSignup&&<p className="auth-switch">{authMode==='login'?'Ainda não tem cadastro?':'Já possui uma conta?'} <button onClick={()=>{setAuthMode(authMode==='login'?'register':'login');setError('');}}>{authMode==='login'?'Cadastre-se':'Faça login'}</button></p>}
      <p className="auth-privacy"><ShieldCheck size={14}/> Exclusivo para moradores autorizados.</p>
    </section>
  </main>;

  if(viewer.status!=='approved')return <main className="pending-screen"><div className="brand">condovery<span>.</span></div>
    <div className="pending-art"><ShieldCheck size={42}/></div>
    <h1>Conta suspensa</h1><p>Procure a administração do condomínio para mais informações.</p>
    <button className="text-button" onClick={logout}>Sair da conta</button></main>;

  return <div className="app-shell">
    <header className="app-header"><div className="header-inner">
      <button className="brand" onClick={()=>go('home')} aria-label="Início Condovery">condovery<span>.</span></button>
      <button className="location" onClick={()=>go('account')} title="Seu endereço"><MapPin size={16}/><span><small>Você está em</small><strong>{viewer.condominium_name}</strong></span><ChevronDown size={14}/></button>
      <div className="header-actions"><button aria-label="Meus pedidos" onClick={()=>go('orders')}><Receipt size={20}/></button><button className="cart-toggle" aria-label="Abrir carrinho" onClick={()=>go('cart')}><ShoppingBag size={22}/>{cartCount>0&&<span>{cartCount}</span>}</button><button aria-label="Minha conta" onClick={()=>go('account')}><UserRound size={21}/></button></div>
    </div></header>
    <div className="desktop-nav"><div className="desktop-nav-inner">
      {bottomNav.map(([target,Icon,label])=><button key={target} className={view===target?'active':''} onClick={()=>go(target)}><Icon size={18}/>{label}</button>)}
      <button onClick={()=>{loadMine();go('seller');}}><Store size={18}/>Minha loja</button>
      {viewer.role==='admin'&&<button onClick={()=>{loadAdmin();go('admin');}}><ShieldCheck size={18}/>Administração</button>}
    </div></div>
    {error&&<div className="global-alert" role="alert"><span>{error}</span><button onClick={()=>setError('')} aria-label="Fechar"><X size={17}/></button></div>}
    {toast&&<div role="status" className="global-toast"><CheckCircle2 size={18}/>{toast}</div>}

    <main className="content">
      {view==='home'&&<>
        <div className="hello-row"><div><p>Olá, {viewer.name.split(' ')[0]}! <span className="wave">✳</span></p><h1>Seu condomínio mais perto de você!</h1></div><div className="hello-bag"><ShoppingBasket size={27}/></div></div>
        <div className="search-container"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Busque produtos ou lojas..." aria-label="Buscar produtos ou lojas"/>{query&&<button onClick={()=>setQuery('')} aria-label="Limpar busca"><X size={16}/></button>}</div>
        {!query&&<section className="hero-banner"><div className="hero-copy">
  <span className="eyebrow">TUDO DE BOM MORA AQUI</span>
  <h2>Descubra o melhor <em>da sua vizinhança.</em></h2>
  <p>Produtos, comida e serviços de quem mora pertinho de você.</p>
  <IllustrationSlot className="hero-art" src={artwork.homeHero} alt="Produtos e serviços do condomínio" eager
    fallback={<img src="/hero.svg" alt=""/>}/>
  <button onClick={()=>{setCategory('');go('categories');}}>Começar a explorar <ArrowRight size={17}/></button>
  </div></section>}
        <SectionHeader title="Descubra o que tem por aqui" action="Ver categorias" onAction={()=>go('categories')}/>
        <div className="category-track" aria-label="Categorias">
          <button className="category-card" onClick={()=>{setCategory('');go('categories');}}>
            <IllustrationSlot className="category-art" src={artwork.categoryAll}
              alt="Todas as categorias" fit="contain" fallback={<LayoutGrid size={25}/>}/>
            <span>Todos</span>
          </button>
          {home.categories.map(c=><button key={c.id} className="category-card" onClick={()=>{setCategory(c.id);go('categories');}}>
            <CategoryArtwork category={c}/><span>{c.name}</span></button>)}
        </div>
        {!query&&<>
          <section className="weekly-offer-banner">
            <div className="weekly-offer-copy">
              <span className="eyebrow">ACHADINHOS DA VIZINHANÇA</span>
              <h2>Ofertas da semana</h2>
              <p>Confira o que seus vizinhos prepararam por aqui.</p>
              <button onClick={()=>{setCategory('');go('categories');}}>Conferir agora <ArrowRight size={17}/></button>
            </div>
            <IllustrationSlot className="weekly-offer-art" src={artwork.weeklyOffers}
              alt="Arte promocional das ofertas da semana"
              fallback={<Tag size={54} strokeWidth={1.2}/>}/>
          </section>
          {featured.length>0&&<><SectionHeader title="Produtos em destaque" action="Explorar" onAction={()=>go('categories')}/>
            <div className="product-track">{featured.map(p=><ProductCard key={p.id} p={p} onClick={()=>openProduct(p)} favorite={favoriteIds.includes(p.id)} onFavorite={toggleFavorite}/>)}</div></>}
        </>}
        <SectionHeader title={query?'Resultados da busca':'Feito pelos seus vizinhos'} action={!query?'Ver produtos':undefined} onAction={()=>go('categories')}/>
        {filtered.length?<div className="product-grid">{(query?filtered:newest).map(p=><ProductCard key={p.id} p={p} onClick={()=>openProduct(p)} favorite={favoriteIds.includes(p.id)} onFavorite={toggleFavorite}/>)}</div>
          :<Empty title={query?'Nada por aqui ainda':'A vitrine está começando!'} subtitle={query?'Tente outro termo ou explore as categorias.':'As primeiras lojas e produtos vão aparecer aqui assim que forem aprovados.'} action={!query?'Quero vender':undefined} onAction={()=>go('seller')}/>}
        {query&&catalogHasMore&&<button className="outline-button load-more" disabled={catalogLoading} onClick={()=>setCatalogPage(p=>p+1)}>
          {catalogLoading?'Carregando...':'Mostrar mais produtos'} <ArrowRight size={17}/>
        </button>}
        {!query&&<><SectionHeader title="Lojas em destaque" action="Ver todas" onAction={()=>{setCategory('');go('categories');}}/>
          <div className="shops-list">{home.shops.length?home.shops.slice(0,8).map(s=><button className="shop-row" key={s.id} onClick={()=>openShop(s.id)}>
            <ShopLogo src={s.logo_image??s.cover_image} name={s.name}/>
            <div><strong>{s.name}</strong><p>{s.description||'Conheça os produtos dessa loja'}</p><span className={'open-hint'+(!s.is_open?' closed':'')}><span/> {s.is_open?'Aceitando pedidos':'Pausada'}</span></div><ChevronRight size={20}/></button>):
            <Empty art="emptyShops" title="Nenhuma loja publicada" subtitle="Seja a primeira pessoa a abrir uma loja no condomínio." action="Criar minha loja" onAction={()=>go('seller')}/>}</div>
        </>}
      </>}

      {view==='categories'&&<>
        <div className="page-title"><h1>Explorar</h1><p>Descubra alimentos, bebidas e delícias preparadas pelos seus vizinhos.</p></div>
        <div className="search-container"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por produto ou loja" aria-label="Buscar"/>{query&&<button onClick={()=>setQuery('')}><X size={16}/></button>}</div>
        <div className="category-track explore-category-track" aria-label="Explorar por categoria">
          <button className={'category-card'+(!category?' selected':'')} onClick={()=>setCategory('')} aria-pressed={!category}>
            <IllustrationSlot className="category-art" src={artwork.categoryAll} alt="Todas as categorias"
              fallback={<LayoutGrid size={25}/>}/><span>Todos</span>
          </button>
          {home.categories.map(c=><button key={c.id} className={'category-card'+(category===c.id?' selected':'')}
            onClick={()=>setCategory(c.id)} aria-pressed={category===c.id}>
              <CategoryArtwork category={c}/><span>{c.name}</span>
            </button>)}
        </div>
        <div className="filter-chips"><button className={!category?'chosen':''} onClick={()=>setCategory('')}>Todos</button>{home.categories.map(c=><button key={c.id} className={category===c.id?'chosen':''} onClick={()=>setCategory(c.id)}>{c.name}</button>)}</div>
        <SectionHeader title={categoryName??'Produtos dos vizinhos'}/>
        {filtered.length?<div className="product-grid">{filtered.map(p=><ProductCard key={p.id} p={p} onClick={()=>openProduct(p)} favorite={favoriteIds.includes(p.id)} onFavorite={toggleFavorite}/>)}</div>:
          catalogLoading?<div className="loading-inline"><div className="spinner"/> Buscando produtos...</div>:
          <Empty title="Nenhum produto encontrado" subtitle="Tente outra categoria ou volte mais tarde."/>}
        {catalogHasMore&&<button className="outline-button load-more" disabled={catalogLoading} onClick={()=>setCatalogPage(p=>p+1)}>
          {catalogLoading?'Carregando...':'Mostrar mais produtos'} <ArrowRight size={17}/>
        </button>}
        <SectionHeader title="Todas as lojas"/>
        <div className="shops-list">{home.shops.map(s=><button key={s.id} className="shop-row" onClick={()=>openShop(s.id)}><ShopLogo src={s.logo_image??s.cover_image} name={s.name}/><div><strong>{s.name}</strong><p>{s.description}</p></div><ChevronRight size={18}/></button>)}</div>
      </>}

      {view==='shop'&&selectedShop&&<>
        <button className="back-link" onClick={()=>go('home')}><ArrowLeft size={18}/> Voltar às lojas</button>
        <div className="shop-cover">{selectedShop.shop.cover_image?<img src={selectedShop.shop.cover_image} alt={'Capa '+selectedShop.shop.name}/>:<div className="shop-cover-fallback"><Store size={62}/></div>}</div>
        <div className="shop-profile-photo"><ShopLogo src={selectedShop.shop.logo_image} name={selectedShop.shop.name}/></div>
        <div className="shop-head"><div><h1>{selectedShop.shop.name}</h1><p>{selectedShop.shop.description}</p></div>
          <div className="shop-actions">
            <Pill tone={selectedShop.shop.is_open?'green':'neutral'}>{selectedShop.shop.is_open?'Aceitando pedidos':'Pausada'}</Pill>
            <button className="shop-share-button" onClick={()=>shareShop(selectedShop.shop.id,selectedShop.shop.name)}>
              <Share2 size={17}/> Compartilhar loja
            </button>
            <button className="report-trigger" onClick={()=>setReportTarget({type:'shop',id:selectedShop.shop.id,name:selectedShop.shop.name})}>Denunciar loja</button>
          </div>
        </div>
        <div className="shop-rating" aria-label="Avaliação da loja">
          {shopReviews?.summary.count?<><RoundedStars value={shopReviews.summary.average??0} size={22}/>
            <strong>{(shopReviews.summary.average??0).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})} de 5</strong>
            <span>({shopReviews.summary.count} {shopReviews.summary.count===1?'avaliação':'avaliações'})</span></>:
            <><RoundedStars value={0} size={22}/><span>Sem avaliação</span></>}
        </div>
        <div className="shop-benefits"><span><Truck size={17}/> {selectedShop.shop.delivery_enabled?'Entrega disponível':'Sem entrega'}</span>{selectedShop.shop.pickup_enabled&&<span><ShoppingBag size={17}/> Retirada</span>}{selectedShop.shop.lead_time&&<span><Clock3 size={17}/>{selectedShop.shop.lead_time}</span>}</div>
        <SectionHeader title="Produtos da loja"/>
        <div className="product-grid">{selectedShop.products.map(p=><ProductCard key={p.id} p={{...p,shop_name:selectedShop.shop.name}} onClick={()=>openProduct({...p,shop_name:selectedShop.shop.name})} favorite={favoriteIds.includes(p.id)} onFavorite={toggleFavorite}/>)}</div>
        {!selectedShop.products.length&&<Empty title="Loja sem produtos no momento" subtitle="Em breve, novidades por aqui."/>}
        <section className="shop-reviews-section">
          <div className="section-heading"><h2>Avaliações dos moradores</h2></div>
          {shopReviews?.reviews.length?<div className="public-reviews-list">
            {shopReviews.reviews.map(review=><article key={review.id} className="public-review-card">
              <div className="review-card-header"><RoundedStars value={review.rating} size={19}/>
                <small>{new Date(review.created_at).toLocaleDateString('pt-BR')}</small></div>
              <p>{review.description}</p><small>Compra verificada · Morador do condomínio</small>
            </article>)}
          </div>:<div className="shop-reviews-empty">
            <RoundedStars value={0} size={24}/>
            <strong>Sem avaliação</strong>
            <span>As avaliações dos compradores aparecerão aqui após moderação.</span>
          </div>}
        </section>
      </>}

      {view==='product'&&selectedProduct&&<>
        <button className="back-link" onClick={()=>selectedShop?go('shop'):go('home')}><ArrowLeft size={18}/> Voltar</button>
        <div className={'product-detail'+(!productCanBuy(selectedProduct)?' is-unavailable':'')}>
          <ProductPicture src={selectedProduct.image_url} name={selectedProduct.name} large/>
          <div className="product-detail-copy">
            {!productCanBuy(selectedProduct)?<Pill tone="neutral">Indisponível no momento</Pill>:<Pill tone="orange">Da nossa vizinhança</Pill>}<h1>{selectedProduct.name}</h1>
            <p className="seller-by">Por {selectedProduct.shop_name??home.shops.find(s=>s.id===selectedProduct.shop_id)?.name}</p>
            <div className="detail-price">{selectedProduct.promo_price_cents!=null&&<del>{money(selectedProduct.price_cents)}</del>}<strong>{money(price(selectedProduct))}</strong></div>
            <p>{selectedProduct.description||'Produto disponível diretamente com um morador do condomínio.'}</p>
            {selectedProduct.lead_time&&<p className="time-hint"><Clock3 size={16}/> Prazo informado: {selectedProduct.lead_time}</p>}
            {(selectedProduct.option_groups??[]).map(group=><fieldset className="options-picker" key={group.id}>
              <legend><strong>{group.name}</strong><small>{group.required?' Obrigatório':' Opcional'} · {group.multiple?'Várias escolhas':'Escolha uma'}</small></legend>
              {group.options.map(choice=><label className="option-item" key={choice.id}>
                <input type={group.multiple?'checkbox':'radio'} name={'group-'+group.id}
                  checked={(productChoices[group.id]??[]).includes(choice.id)} onChange={()=>changeChoice(group,choice.id)}/>
                <span>{choice.name}</span><small>{choice.price_cents>0?'+'+money(choice.price_cents):'Incluso'}</small>
              </label>)}
              {!group.required&&!group.multiple&&(productChoices[group.id]??[]).length>0&&
                <button type="button" className="quiet-link"
                  onClick={()=>setProductChoices(c=>({...c,[group.id]:[]}))}>Limpar escolha</button>}
            </fieldset>)}
            <label className="field-label">Observações sobre este produto<textarea maxLength={200} rows={3} value={itemNote} onChange={e=>setItemNote(e.target.value)} placeholder="Ex.: sem cobertura, embalagem para presente..."/></label>
            <div className="add-row"><div className="quantity"><button onClick={()=>setQty(Math.max(1,qty-1))} aria-label="Diminuir"><Minus size={18}/></button><strong>{qty}</strong><button onClick={()=>setQty(Math.min(Math.max(1,selectedProduct.stock??30),qty+1))} aria-label="Aumentar"><Plus size={18}/></button></div>
            <button className="primary-button" disabled={!productCanBuy(selectedProduct)} onClick={addToCart}><Plus size={18}/>Adicionar · {money((price(selectedProduct)+addOns(selectedProduct,productChoices))*qty)}</button></div>
            {!productCanBuy(selectedProduct)&&<p className="helper-note">Este produto continua visível, mas não pode ser comprado agora.</p>}
            <button className="report-trigger" onClick={()=>setReportTarget({type:'product',id:selectedProduct.id,name:selectedProduct.name})}>Denunciar produto</button>
          </div>
        </div>
      </>}

      {view==='cart'&&<>
        <div className="page-title"><h1>Meu carrinho</h1><p>Escolha a entrega e finalize diretamente com o vendedor pelo WhatsApp.</p></div>
        {!cart.length?<Empty title="Seu carrinho está vazio" subtitle="Adicione produtos de uma loja para começar." action="Explorar produtos" onAction={()=>go('categories')}/>:
        <div className="checkout-layout"><section className="checkout-main">
          <div className="white-panel"><h2><Store size={19}/> {cartShop?.name??'Sua loja'}</h2>{cart.map((item,index)=><div className="cart-item" key={item.product.id+'-'+index}>
            <ProductPicture src={item.product.image_url} name={item.product.name}/><div className="cart-item-details"><strong>{item.product.name}</strong>
              {(item.product.option_groups??[]).flatMap(g=>(item.selections?.[g.id]??[]).map(id=>{
                const option=g.options.find(o=>o.id===id);return option?g.name+': '+option.name+(option.price_cents?' (+'+money(option.price_cents)+')':''):null;
              })).filter(Boolean).map((detail,i)=><small key={i}>{detail}</small>)}
              {item.note&&<small>Obs.: {item.note}</small>}
              <b>{money(cartUnitPrice(item)*item.quantity)}</b>
            <div className="cart-controls"><button onClick={()=>setCart(s=>s.map((i,n)=>n===index?{...i,quantity:Math.max(1,i.quantity-1)}:i))} aria-label="Diminuir"><Minus size={15}/></button><span>{item.quantity}</span><button onClick={()=>setCart(s=>s.map((i,n)=>n===index?{...i,quantity:Math.min(30,i.quantity+1)}:i))} aria-label="Aumentar"><Plus size={15}/></button><button className="trash" onClick={()=>setCart(s=>s.filter((_,n)=>n!==index))} aria-label="Remover"><Trash2 size={16}/></button></div>
            </div></div>)}</div>
          <div className="white-panel"><h2><Truck size={19}/> Como prefere receber?</h2><div className="choice-row">
            {cartShop?.delivery_enabled!==false&&<button className={actualFulfillment==='delivery'?'selected':''} onClick={()=>setFulfillment('delivery')}><Truck size={19}/> Entrega</button>}
            {cartShop?.pickup_enabled!==false&&<button className={actualFulfillment==='pickup'?'selected':''} onClick={()=>setFulfillment('pickup')}><ShoppingBag size={19}/> Retirada</button>}</div>
            {actualFulfillment==='delivery'&&<div className="address-box"><MapPin size={18}/><div><strong>{viewer.tower} · Apartamento {viewer.apartment}</strong><small>Seu endereço cadastrado <button onClick={()=>go('account')}>Alterar</button></small></div></div>}
            <div className="field-grid"><label className="field-label">Data preferida<input type="date" min={new Date().toISOString().slice(0,10)} value={deliveryDay} onChange={e=>setDeliveryDay(e.target.value)}/></label>
            <label className="field-label">Período / horário<input value={deliveryWindow} maxLength={70} onChange={e=>setDeliveryWindow(e.target.value)} placeholder="Ex.: 18h às 20h"/></label></div>
            <p className="helper-note">Horário sujeito à confirmação da loja.</p>
            {actualFulfillment==='delivery'&&<><h3>Instruções de entrega</h3><div className="instructions">
              {arrivalInstructionOptions.map(t=><label key={t}><input type="checkbox"
                checked={instructions.includes(t)}
                onChange={e=>setInstructions(s=>toggleArrivalInstruction(s,t,e.target.checked))}/>{t}</label>)}
              </div></>}
            <label className="field-label">Observações gerais<textarea rows={3} maxLength={400} value={checkoutNote} onChange={e=>setCheckoutNote(e.target.value)} placeholder="Algo mais que o vendedor precisa saber?"/></label>
          </div>
        </section><aside className="checkout-total white-panel"><h2>Resumo do pedido</h2><div className="total-line"><span>{cartCount} {cartCount===1?'item':'itens'}</span><strong>{money(cartSubtotal)}</strong></div>
          {actualFulfillment==='delivery'&&<div className="total-line"><span>Taxa de entrega</span><strong>{fee?money(fee):'Grátis'}</strong></div>}
          <div className="total-line bold"><span>Total do pedido</span><strong>{money(cartTotal)}</strong></div><p>O pagamento será combinado diretamente com o vendedor.</p>
          <div className="whatsapp-reminder"><MessageCircle size={19}/>
            <span>O WhatsApp abrirá com a mensagem pronta. <strong>Você precisa tocar em Enviar.</strong> Apenas o vendedor confirma o pedido.</span>
          </div>
          {revisedQuote&&<div className="price-changed" role="alert">
            <strong>O valor foi atualizado</strong>
            <p>Anterior: {money(cartTotal)} → <strong>Atual: {money(revisedQuote.total_cents)}</strong></p>
            {revisedQuote.lines.map((line,n)=><small key={n}>{line.quantity}× {line.name} — {money(line.total_cents)}</small>)}
            <small>Taxa de entrega: {money(revisedQuote.delivery_fee_cents)}</small>
            <button type="button" className="primary-button" disabled={busy} onClick={()=>checkout(true)}>
              Confirmar novo valor e continuar
            </button>
            <button type="button" className="outline-button" onClick={()=>setRevisedQuote(null)}>Revisar carrinho</button>
          </div>}
          {!revisedQuote&&<button className="primary-button" disabled={busy} onClick={()=>checkout()}>
            {busy?'Conferindo valores...':'Continuar no WhatsApp'}<ArrowRight size={18}/>
          </button>}
          <small>O pedido fica registrado mesmo se você fechar o WhatsApp. Apenas a loja poderá confirmá-lo.</small>
        </aside></div>}
      </>}

      {view==='success'&&lastOrder&&<div className="success-page"><IllustrationSlot className="success-art" src={artwork.orderSuccess} alt="Pedido registrado com sucesso"
  fallback={<Check size={44}/>}/><Pill tone="green">Pedido registrado</Pill><h1>Seu pedido foi registrado!</h1><p>Seu pedido <strong>#{lastOrder.code}</strong> foi criado. Envie a mensagem para o vendedor pelo WhatsApp para combinar disponibilidade, entrega e pagamento.</p>
        <div className="whatsapp-reminder"><MessageCircle size={18}/> <strong>Importante: toque em Enviar dentro do WhatsApp.</strong> O Condovery não envia a mensagem sozinho.</div>
        <a className="primary-button" href={lastOrder.whatsapp_url} target="_blank" rel="noopener noreferrer">Abrir conversa no WhatsApp <ArrowRight size={18}/></a>
        <button className="outline-button" onClick={()=>{loadOrders();go('orders');}}>Acompanhar meus pedidos</button><small>Abrir o WhatsApp não significa que o vendedor recebeu ou confirmou o pedido.</small></div>}

      {view==='favorites'&&<>
        <div className="page-title"><h1>Meus favoritos</h1><p>Seus produtos preferidos, sempre à mão.</p></div>
        {favoriteProducts.length?<div className="product-grid">{favoriteProducts.map(p=>
          <ProductCard key={p.id} p={p} onClick={()=>openProduct(p)} favorite={favoriteIds.includes(p.id)} onFavorite={toggleFavorite}/>
        )}</div>:<Empty art="emptyFavorites" title="Nenhum favorito por enquanto" subtitle="Toque no coração de um produto para encontrá-lo facilmente depois." action="Explorar produtos" onAction={()=>go('categories')}/>}
      </>}
            {view==='orders'&&<>
        <div className="page-title"><h1>Meus pedidos</h1><p>Acompanhe seus pedidos com os vizinhos.</p></div>
        <div className="order-filters" role="group" aria-label="Filtrar pedidos por situação">
          {orderFilters.map(option=><button key={option.key} type="button"
            aria-pressed={orderFilter===option.key}
            className={orderFilter===option.key?'selected':''}
            onClick={()=>setOrderFilter(option.key)}>{option.label}</button>)}
        </div>
        {ordersLoading?<div className="loading-inline"><div className="spinner"/> Consultando pedidos...</div>:
        orders.length?<div className="order-list">{orders.map(o=><article className="order-card" key={o.id}>
          <div className="order-top"><strong>#{o.code} · {o.shop_name}</strong>
            <Pill tone={o.status==='completed'?'green':o.status==='cancelled'?'neutral':'orange'}>{statusLabel[o.status]??o.status}</Pill></div>
          <p>{o.items.map(i=>i.quantity+'× '+i.name).join(' · ')}</p><OrderProgress status={o.status}/>
          <div className="order-bottom"><small>{new Date(o.created_at).toLocaleDateString('pt-BR')} · {o.fulfillment==='delivery'?'Entrega':'Retirada'}</small><strong>{money(o.total_cents)}</strong></div>
          {(o.status==='awaiting_confirmation'||o.status==='confirmed')&&
            <div className="order-contact"><p>{o.status==='awaiting_confirmation'?'Aguardando confirmação do vendedor.':'Confirmado pelo vendedor.'} Se precisar, reabra a conversa.</p>
              <button type="button" className="outline-button" onClick={()=>reopenOrderWhatsApp(o.id)}>
                <MessageCircle size={17}/> Abrir WhatsApp</button>
            </div>}
          {o.status==='completed'&&(!o.review_status?
            <div className="review-order-action">
              {reviewOrderId===o.id?<form className="review-form" onSubmit={sendReview}>
                <h3>Como foi comprar nesta loja?</h3>
                <p>Avalie sua experiência. A loja vai moderar antes da publicação.</p>
                <RoundedStars value={reviewRating} onChange={setReviewRating} size={31} label="Escolha de 1 a 5 estrelas"/>
                <label className="field-label">Conte um pouquinho sobre sua compra
                  <textarea rows={3} maxLength={200} minLength={1} required value={reviewText}
                    placeholder="Como foi a experiência? (até 200 caracteres)"
                    onChange={e=>setReviewText(e.target.value)}/>
                </label>
                <div className="review-form-footer"><small>{reviewText.length}/200 caracteres</small>
                  <button className="outline-button" type="button" onClick={()=>setReviewOrderId(null)}>Cancelar</button>
                  <button className="primary-button" type="submit" disabled={busy||!reviewRating||!reviewText.trim()}>
                    Enviar avaliação <ArrowRight size={16}/>
                  </button></div>
              </form>:<button className="review-order-button" onClick={()=>{
                setReviewOrderId(o.id);setReviewRating(0);setReviewText('');
              }}><RoundedStars value={0} size={18}/> Avaliar esta compra <ChevronRight size={16}/></button>}
            </div>:
            <p className="review-status-note"><CheckCircle2 size={15}/>
              {o.review_status==='pending'?'Avaliação enviada · Aguardando moderação':
              o.review_status==='approved'?'Sua avaliação está publicada':'Avaliação não publicada pela loja'}
            </p>)}
        </article>)}</div>:
        <Empty art="emptyOrders" title={orderFilter==='all'?'Ainda não fez pedidos?':'Nenhum pedido neste filtro'}
          subtitle={orderFilter==='all'?'Encontre algo gostoso ou útil vendido pertinho de você.':'Experimente outra situação para consultar seus pedidos.'}
          action={orderFilter==='all'?'Começar a comprar':'Ver todos'}
          onAction={()=>{if(orderFilter!=='all')setOrderFilter('all');else go('home');}}/>}
      </>}

      {view==='account'&&<><div className="page-title"><h1>Meu perfil</h1><p>Seu endereço, seus pedidos e tudo sobre sua conta.</p></div>
        <div className="account-grid"><div className="white-panel"><div className="account-welcome"><IllustrationSlot className="account-approved-art"
  src={artwork.accountApproved} alt="Conta de morador aprovada"
  fallback={<CheckCircle2 size={23}/>}/><div className="avatar">{profile.avatar_image?<img src={profile.avatar_image} alt="Minha foto"/>:viewer.name[0]}</div><div><strong>{viewer.name}</strong><p>{viewer.email}</p></div></div>
          <label className="simple-photo-uploader"><ImagePlus size={18}/>
            {profile.avatar_image?'Trocar foto de perfil':'Adicionar foto de perfil'}
            <input aria-label="Enviar foto de perfil" type="file" accept="image/jpeg,image/png,image/webp"
              disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';choosePhoto(file,'avatar');}}/>
          </label><form onSubmit={saveProfile} className="form-stack">
          <label>Nome<input required value={profile.name} onChange={e=>setProfile(s=>({...s,name:e.target.value}))}/></label>
          <label>WhatsApp<input required type="tel" value={profile.phone} onChange={e=>setProfile(s=>({...s,phone:e.target.value}))}/></label>
          <div className="field-grid"><label>Torre<select value={profile.tower} onChange={e=>setProfile(s=>({...s,tower:e.target.value}))}>{viewer.towers.map(t=><option key={t} value={t}>{t}</option>)}</select></label><label>Apartamento<input required value={profile.apartment} onChange={e=>setProfile(s=>({...s,apartment:e.target.value}))}/></label></div>
          <button type="submit" className="outline-button" disabled={busy}>Salvar meus dados</button>
        </form></div>
        <div className="account-shortcuts"><button onClick={()=>{loadMine();go('seller');}}><Store size={23}/><span><strong>{myShop?'Minha loja':'Quero vender'}</strong><small>{myShop?'Gerencie produtos e pedidos':'Crie sua loja e comece a vender'}</small></span><ChevronRight/></button>
        <button onClick={()=>{loadOrders();go('orders');}}><Receipt size={23}/><span><strong>Meus pedidos</strong><small>Acompanhe suas compras</small></span><ChevronRight/></button>
        {viewer.role==='admin'&&<button onClick={()=>{loadAdmin();go('admin');}}><ShieldCheck size={23}/><span><strong>Administração</strong><small>Segurança e configurações</small></span><ChevronRight/></button>}
        <button onClick={logout}><LogOut size={23}/><span><strong>Sair</strong><small>Encerrar sessão neste dispositivo</small></span><ChevronRight/></button>
        {viewer.role==='resident'&&<button className="delete-account-entry"
          onClick={()=>{setShowDeleteAccount(true);setDeleteConfirmation('');setDeletePassword('');setError('');}}>
          <Trash2 size={23}/><span><strong>Excluir minha conta</strong>
          <small>Encerrar definitivamente seu acesso e sua loja</small></span><ChevronRight/>
        </button>}</div></div>
      </>}

      {showDeleteShop&&myShop&&view==='seller'&&<div className="account-delete-overlay" role="presentation"
        onClick={()=>!busy&&setShowDeleteShop(false)}>
        <section className="account-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-shop-title"
          onClick={event=>event.stopPropagation()}>
          <button className="account-delete-close" type="button" aria-label="Cancelar exclusão" disabled={busy}
            onClick={()=>setShowDeleteShop(false)}><X size={20}/></button>
          <h2 id="delete-shop-title">Excluir loja definitivamente</h2>
          <p>Esta ação é irreversível. A loja e os produtos deixarão de aparecer para os moradores.
            O histórico de pedidos será preservado e sua conta continuará ativa.</p>
          <p>Conclua ou cancele todos os pedidos em andamento antes de excluir a loja.</p>
          <form className="form-stack" onSubmit={deleteShop}>
            <label>Digite <strong>EXCLUIR LOJA</strong> para confirmar
              <input autoComplete="off" required value={shopDeleteConfirmation}
                onChange={event=>setShopDeleteConfirmation(event.target.value)}
                placeholder="EXCLUIR LOJA"/>
            </label>
            {error&&<p className="account-delete-error" role="alert">{error}</p>}
            <button type="submit" className="account-delete-submit" disabled={busy||shopDeleteConfirmation!=='EXCLUIR LOJA'}>
              {busy?'Excluindo...':'Excluir minha loja definitivamente'}
            </button>
            <button type="button" className="outline-button" onClick={()=>setShowDeleteShop(false)} disabled={busy}>Cancelar</button>
          </form>
        </section>
      </div>}
      {showDeleteAccount&&view==='account'&&viewer.role==='resident'&&
        <div className="account-delete-overlay" onClick={()=>!busy&&setShowDeleteAccount(false)}>
          <section className="account-delete-dialog" role="dialog" aria-modal="true"
            aria-labelledby="delete-account-title" onClick={e=>e.stopPropagation()}>
            <button className="account-delete-close" type="button" disabled={busy}
              aria-label="Fechar" onClick={()=>setShowDeleteAccount(false)}><X size={20}/></button>
            <h2 id="delete-account-title">Excluir minha conta</h2>
            <p>Esta ação é irreversível. Seus dados de perfil e fotos serão removidos,
              sua loja será encerrada e você perderá o acesso ao condomínio.</p>
            <p>Pedidos concluídos poderão permanecer no histórico, de forma anonimizada.
              Conclua ou cancele os pedidos em andamento antes da exclusão.</p>
            <form className="form-stack" onSubmit={deleteAccount}>
              <label>Digite <strong>EXCLUIR</strong> para confirmar
                <input required autoComplete="off" value={deleteConfirmation}
                  onChange={e=>setDeleteConfirmation(e.target.value)} placeholder="EXCLUIR"/>
              </label>
              <label>Senha atual (necessária para contas com senha)
                <input type="password" autoComplete="current-password"
                  value={deletePassword} onChange={e=>setDeletePassword(e.target.value)}
                  placeholder="Confirme sua senha"/>
              </label>
              <p className="account-delete-note">Se você usa somente Google, pode ser necessário
                entrar novamente antes de confirmar.</p>
              {error&&<p className="account-delete-error" role="alert">{error}</p>}
              <button className="account-delete-submit" type="submit"
                disabled={busy||deleteConfirmation!=='EXCLUIR'}>
                {busy?'Excluindo conta...':'Confirmar exclusão definitiva'}
              </button>
              <button type="button" className="outline-button"
                onClick={()=>setShowDeleteAccount(false)} disabled={busy}>Cancelar</button>
            </form>
          </section>
        </div>}
      {view==='seller'&&<><button className="back-link" onClick={()=>go('account')}><ArrowLeft size={18}/> Minha conta</button><div className="page-title"><h1>Painel do vendedor</h1><p>Seu negócio, a poucos passos de seus clientes.</p></div>
        {!myShop?<div className="seller-setup white-panel"><IllustrationSlot className="setup-illustration" src={artwork.sellerWelcome}
  alt="Ilustração para nova loja" fallback={<Store size={38}/>}/><h2>Vamos abrir sua lojinha?</h2><p>Abra sua loja agora. Informe os dados e siga as regras da comunidade.</p><form onSubmit={saveShop} className="form-stack">
          <label>Nome da loja<input required minLength={3} value={shopForm.name} onChange={e=>setShopForm(s=>({...s,name:e.target.value}))} placeholder="Ex.: Bolos da Gabi"/></label>
          <label>O que você vende?<textarea maxLength={500} value={shopForm.description} onChange={e=>setShopForm(s=>({...s,description:e.target.value}))} rows={3} placeholder="Conte um pouco sobre seus produtos"/></label>
          <label>WhatsApp para pedidos<input required type="tel" value={shopForm.whatsapp} onChange={e=>setShopForm(s=>({...s,whatsapp:e.target.value}))} placeholder="(19) 99999-9999"/></label>
          <button type="button" className="outline-button" onClick={testShopWhatsApp}>
            <MessageCircle size={17}/> Testar WhatsApp</button>
          <p className="form-hint">Confira se a conversa abre no número correto. Não enviamos mensagens automaticamente.</p>
          <label className="community-agreement">
            <input type="checkbox" required checked={acceptedGuidelines} onChange={e=>setAcceptedGuidelines(e.target.checked)}/>
            <span>Vou usar palavras respeitosas, imagens adequadas e anunciar somente alimentos e bebidas permitidos.</span>
          </label>
          <button className="primary-button" disabled={busy||!acceptedGuidelines} type="submit">Criar minha loja <ArrowRight size={18}/></button>
        </form></div>:<>
          <div className="seller-overview"><div><strong>{myShop.name}</strong><p>Seu painel de vendas</p></div>
            <div className="seller-overview-actions">
              <Pill tone={myShop.status==='approved'&&myShop.is_open?'green':'orange'}>{myShop.status==='approved'&&!myShop.is_open?'Pausada':statusLabel[myShop.status??'pending']}</Pill>
              {myShop.status==='approved'&&<>
                <button className="outline-button seller-pause-button" disabled={busy} type="button" onClick={toggleShopOpen}>
                  {myShop.is_open?<PauseCircle size={17}/>:<PlayCircle size={17}/>}
                  {myShop.is_open?'Pausar loja':'Reabrir loja'}</button>
                <button className="shop-share-button" onClick={()=>shareShop(myShop.id,myShop.name)}>
                  <Share2 size={16}/> Compartilhar loja</button>
              </>}
            </div></div>
          <div className={'seller-activation'+(myShop.status==='approved'?(myShop.is_open?' approved':' paused'):myShop.status==='suspended'?' suspended':'')}>
            <div className="activation-symbol">{myShop.status==='approved'?<CheckCircle2 size={28}/>:<Clock3 size={28}/>}</div>
            <div><strong>{myShop.status==='approved'?(myShop.is_open?'Sua loja está ativa!':'Sua loja está pausada'):myShop.status==='suspended'?'Loja suspensa':'Ativando sua loja'}</strong>
              <p>{myShop.status==='approved'?(!myShop.is_open?'A loja está pausada e não recebe novos pedidos. Reabra quando quiser.':myProducts.length?'Sua loja está pronta para receber pedidos.':'Agora adicione seus produtos para começar a vender.'):
                myShop.status==='suspended'?'Fale com a administração do condomínio.':'Sua loja ficará disponível automaticamente.'}</p>
            </div>
          </div>
          {myShop.status==='approved'&&!myShop.logo_image&&<div className="seller-activation-help">
            <label className="simple-photo-uploader"><ImagePlus size={17}/>
              Adicionar foto da loja
              <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
                onChange={e=>{const file=e.target.files?.[0];e.target.value='';choosePhoto(file,'logo');}}/>
            </label>
          </div>}
          <div className="seller-metrics"><div><small>Pedidos aguardando</small><strong>{sellerOrders.filter(o=>o.status==='awaiting_confirmation').length}</strong></div><div><small>Vendas concluídas</small><strong>{money(sellerOrders.filter(o=>o.status==='completed').reduce((n,o)=>n+o.total_cents,0))}</strong></div></div>
          <div className="seller-tabs">
            <button className={sellerTab==='orders'?'active':''} onClick={()=>{setSellerTab('orders');loadSellerOrders().catch(fail);}}>Pedidos</button>
            <button className={sellerTab==='products'?'active':''} onClick={()=>setSellerTab('products')}>Produtos</button>
            <button className={sellerTab==='reviews'?'active':''} onClick={()=>{setSellerTab('reviews');loadSellerReviews().catch(fail);}}>
              Avaliações {sellerReviews.filter(r=>r.status==='pending').length>0&&
                <span className="review-pending-counter">{sellerReviews.filter(r=>r.status==='pending').length}</span>}
            </button>
            <button className={sellerTab==='settings'?'active':''} onClick={()=>setSellerTab('settings')}>Configurações</button>
          </div>
          {sellerTab==='orders'&&<>{sellerOrders.length?<div className="order-list">{sellerOrders.map(o=><article className="order-card" key={o.id}>
            <div className="order-top"><strong>Pedido #{o.code}</strong><Pill tone={o.status==='completed'?'green':'orange'}>{statusLabel[o.status]??o.status}</Pill></div>
            <p><strong>{o.buyer_name}</strong> · {o.fulfillment==='delivery'?o.tower+' · Ap. '+o.apartment:'Retirada'}</p>
            <div className="seller-order-lines">{o.items.map((item,index)=><div key={index}>
              <strong>{item.quantity}× {item.name} — {money(item.unit_price_cents*item.quantity)}</strong>
              {item.options?.map((opt,i)=><small key={i}>{opt.group}: {opt.name}{opt.price_cents>0?' (+'+money(opt.price_cents)+')':''}</small>)}
              {item.note&&<small>Obs. do produto: {item.note}</small>}
            </div>)}</div>
            {o.fulfillment==='delivery'&&<p>Entrega: {o.tower} · Ap. {o.apartment} · Taxa: {money(o.delivery_fee_cents??0)}</p>}
            {o.delivery_day&&<p>Data: {String(o.delivery_day).slice(0,10)}</p>}{o.delivery_window&&<p>Preferência: {o.delivery_window}</p>}
            {o.note&&<p>Observação: {o.note}</p>}{o.delivery_instructions?.length>0&&<p>Instruções: {o.delivery_instructions.join(', ')}</p>}
            <div className="order-bottom"><strong>Subtotal {money(o.subtotal_cents??o.total_cents)} · Total {money(o.total_cents)}</strong><div className="inline-actions">{o.status==='awaiting_confirmation'&&<><button disabled={busy} onClick={()=>updateStatus(o.id,'confirmed')}>Confirmar</button><button className="danger-text" disabled={busy} onClick={()=>updateStatus(o.id,'cancelled')}>Cancelar</button></>}
              {o.status==='confirmed'&&<><button disabled={busy} onClick={()=>updateStatus(o.id,'completed')}>Concluir</button><button className="danger-text" disabled={busy} onClick={()=>updateStatus(o.id,'cancelled')}>Cancelar</button></>}</div></div>
          </article>)}</div>:<Empty title="Sem pedidos ainda" subtitle="Quando moradores comprarem na sua loja, os pedidos aparecerão aqui."/>}</>}
          {sellerTab==='reviews'&&<>
            <div className="section-heading"><h2>Moderar avaliações</h2></div>
            <p className="muted moderation-help">Somente avaliações de compras concluídas entram nesta lista. Apenas as aprovadas aparecem publicamente e contam para a média da loja.</p>
            {myShop.status!=='approved'?<div className="info-banner">Sua loja precisa estar aprovada para moderar avaliações.</div>:
              sellerReviews.length?<div className="seller-review-list">
                {sellerReviews.map(r=><article className="seller-review-card" key={r.id}>
                  <div className="review-card-header">
                    <div><strong>Pedido #{r.order_code}</strong>
                      <RoundedStars value={r.rating} size={20}/></div>
                    <Pill tone={r.status==='approved'?'green':r.status==='pending'?'orange':'neutral'}>
                      {r.status==='pending'?'Aguardando moderação':r.status==='approved'?'Publicada':'Rejeitada'}
                    </Pill>
                  </div>
                  <p>{r.description}</p>
                  <small>{new Date(r.created_at).toLocaleDateString('pt-BR')}</small>
                  {r.status==='pending'&&<div className="moderation-actions">
                    <button className="primary-button" disabled={busy} onClick={()=>moderateReview(r.id,'approved')}>
                      <Check size={17}/> Aprovar e publicar
                    </button>
                    <button className="outline-button" disabled={busy} onClick={()=>moderateReview(r.id,'rejected')}>
                      Não publicar
                    </button>
                  </div>}
                </article>)}
              </div>:<Empty title="Sem avaliações até agora"
                subtitle="Quando alguém avaliar uma compra concluída, você poderá moderar o comentário por aqui."/>}
          </>}
          {sellerTab==='products'&&<><div className="section-heading"><h2>Seus produtos</h2><button className="mini-primary" disabled={myShop.status!=='approved'} onClick={()=>editProduct()}><Plus size={17}/>Adicionar</button></div>
            {editingProduct?<form className="white-panel form-stack product-editor" onSubmit={saveProduct}>
              <div className="section-heading"><h2>{productForm.id?'Editar produto':'Novo produto'}</h2><button type="button" onClick={()=>setEditingProduct(false)}><X size={19}/></button></div>
              <label>Foto do produto<div className="image-upload">{productForm.image_url?<img src={productForm.image_url} alt="Prévia do produto"/>:<ImagePlus size={29}/>}<span>Selecionar foto (até 10 MB)</span><input aria-label="Enviar foto do produto" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];e.target.value='';choosePhoto(f,'product');}}/></div></label>
              <label>Nome<input required minLength={2} maxLength={100} value={productForm.name} onChange={e=>setProductForm(s=>({...s,name:e.target.value}))}/></label>
              <label>Descrição<textarea rows={3} maxLength={600} value={productForm.description} onChange={e=>setProductForm(s=>({...s,description:e.target.value}))}/></label>
              <label>Categoria<select required value={productForm.category_id} onChange={e=>setProductForm(s=>({...s,category_id:e.target.value}))}><option value="">Selecione</option>{home.categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <div className="field-grid"><label>Preço (R$)<input required type="number" min=".01" step=".01" value={productForm.price} onChange={e=>setProductForm(s=>({...s,price:e.target.value}))}/></label><label>Promocional (opcional)<input type="number" min=".01" step=".01" value={productForm.promo} onChange={e=>setProductForm(s=>({...s,promo:e.target.value}))}/></label></div>
              <div className="field-grid"><label>Estoque (opcional)<input type="number" min="0" step="1" value={productForm.stock} onChange={e=>setProductForm(s=>({...s,stock:e.target.value}))}/></label><label>Prazo de preparo<input maxLength={100} value={productForm.lead_time} onChange={e=>setProductForm(s=>({...s,lead_time:e.target.value}))} placeholder="Ex.: 1 dia"/></label></div>
              <section className="product-option-editor">
                <div className="section-heading"><h3>Opções do produto</h3>
                  <button type="button" className="outline-button" disabled={productForm.option_groups.length>=8}
                    onClick={()=>setProductForm(x=>({...x,option_groups:[...x.option_groups,{
                      id:crypto.randomUUID(),name:'',required:false,multiple:false,options:[{id:crypto.randomUUID(),name:'',price_cents:0}]
                    }]}))}><Plus size={15}/> Grupo</button>
                </div>
                <p className="helper-note">Ex.: Sabor, tamanho ou adicionais. Os valores são somados ao preço do produto.</p>
                {productForm.option_groups.map(group=><div className="option-group-editor" key={group.id}>
                  <label>Nome da opção<input required minLength={2} maxLength={65}
                    placeholder="Ex.: Cobertura" value={group.name}
                    onChange={e=>setProductForm(x=>({...x,option_groups:x.option_groups.map(g=>g.id===group.id?{...g,name:e.target.value}:g)}))}/></label>
                  <div className="option-flags">
                    <label><input type="checkbox" checked={group.required}
                      onChange={e=>setProductForm(x=>({...x,option_groups:x.option_groups.map(g=>g.id===group.id?{...g,required:e.target.checked}:g)}))}/> Obrigatório</label>
                    <label><input type="checkbox" checked={group.multiple}
                      onChange={e=>setProductForm(x=>({...x,option_groups:x.option_groups.map(g=>g.id===group.id?{...g,multiple:e.target.checked}:g)}))}/> Permitir várias opções</label>
                  </div>
                  {group.options.map(opt=><div key={opt.id} className="option-choice-editor">
                    <label>Escolha<input required maxLength={70} placeholder="Ex.: Chocolate" value={opt.name}
                      onChange={e=>setProductForm(x=>({...x,option_groups:x.option_groups.map(g=>g.id===group.id?{...g,options:g.options.map(o=>o.id===opt.id?{...o,name:e.target.value}:o)}:g)}))}/></label>
                    <label>Adicional (R$)<MoneyInput cents={opt.price_cents} onValue={cents=>setProductForm(x=>({...x,
                      option_groups:x.option_groups.map(g=>g.id===group.id?{...g,options:g.options.map(o=>o.id===opt.id?{...o,price_cents:cents}:o)}:g)
                    }))}/></label>
                    <button type="button" className="option-remove" aria-label="Remover escolha"
                      disabled={group.options.length<=1} onClick={()=>setProductForm(x=>({...x,option_groups:x.option_groups.map(g=>g.id===group.id?{...g,options:g.options.filter(o=>o.id!==opt.id)}:g)}))}><X size={16}/></button>
                  </div>)}
                  <div className="option-editor-footer">
                    <button type="button" className="quiet-link" disabled={group.options.length>=15}
                      onClick={()=>setProductForm(x=>({...x,option_groups:x.option_groups.map(g=>g.id===group.id?{...g,options:[...g.options,{id:crypto.randomUUID(),name:'',price_cents:0}]}:g)}))}>+ Adicionar escolha</button>
                    <button type="button" className="danger-text" onClick={()=>setProductForm(x=>({...x,option_groups:x.option_groups.filter(g=>g.id!==group.id)}))}>Remover grupo</button>
                  </div>
                </div>)}
              </section>
              <label>Exibição do produto
                <select value={productForm.visibility} onChange={e=>setProductForm(s=>({...s,visibility:e.target.value as Product['visibility']}))}>
                  <option value="available">Disponível — pode comprar</option>
                  <option value="unavailable">Indisponível — aparece em cinza</option>
                  <option value="hidden">Oculto — só você vê</option>
                </select>
              </label>
              <button className="primary-button" disabled={busy} type="submit">{busy?'Salvando...':'Salvar produto'}<Check size={18}/></button>
            </form>:myProducts.length?<div className="seller-product-list">
              {myProducts.map(p=><article className={'seller-product-item'+(p.visibility==='unavailable'?' is-unavailable':'')} key={p.id}>
                <button className="seller-product-edit" onClick={()=>editProduct(p)}>
                  <ProductPicture src={p.image_url} name={p.name}/><span><strong>{p.name}</strong>
                    <small>{money(price(p))} · {p.visibility==='available'?'Disponível':
                      p.visibility==='unavailable'?'Indisponível':'Oculto'}</small></span>
                  <ChevronRight size={18}/>
                </button>
                <div className="product-visibility-actions" role="group" aria-label={'Exibição de '+p.name}>
                  {(['available','unavailable','hidden'] as const).map(v=><button key={v} type="button"
                    disabled={busy} aria-pressed={p.visibility===v}
                    className={p.visibility===v?'selected':''}
                    onClick={()=>changeProductVisibility(p.id,v)}>
                      {v==='available'?'Disponível':v==='unavailable'?'Indisponível':'Oculto'}
                  </button>)}
                </div>
              </article>)}
            </div>:<Empty title="Seu catálogo está vazio" subtitle="Adicione o primeiro produto para começar a vender."/>}</>}
          {sellerTab==='settings'&&<form className="white-panel form-stack" onSubmit={saveShop}>
            <label>Nome da loja<input required minLength={3} value={shopForm.name} onChange={e=>setShopForm(s=>({...s,name:e.target.value}))}/></label>
            <label>Descrição<textarea rows={3} maxLength={500} value={shopForm.description} onChange={e=>setShopForm(s=>({...s,description:e.target.value}))}/></label>
            <label>WhatsApp<input required value={shopForm.whatsapp} onChange={e=>setShopForm(s=>({...s,whatsapp:e.target.value}))}/></label>
            <button type="button" className="outline-button" onClick={testShopWhatsApp}><MessageCircle size={17}/> Testar número no WhatsApp</button>
            <label>Foto de perfil da loja<div className="image-upload">{shopForm.logo_image?<img src={shopForm.logo_image} alt="Perfil da loja"/>:<ImagePlus size={30}/>}<span>Adicionar foto da loja</span><input aria-label="Enviar foto do perfil da loja" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';choosePhoto(file,'logo');}}/></div></label>
            <label>Foto de capa<div className="image-upload">{shopForm.cover_image?<img src={shopForm.cover_image} alt="Capa"/>:<ImagePlus size={30}/>}<span>Enviar foto de capa</span><input aria-label="Enviar foto de capa" type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];e.target.value='';choosePhoto(f,'cover');}}/></div></label>
            <label>Prazo de preparo<input maxLength={100} value={shopForm.lead_time} onChange={e=>setShopForm(s=>({...s,lead_time:e.target.value}))} placeholder="Ex.: Até 2 horas"/></label>
            <label>Orientações para retirada<textarea rows={2} maxLength={250} value={shopForm.pickup_instructions} onChange={e=>setShopForm(s=>({...s,pickup_instructions:e.target.value}))}/></label>
            <p className="muted seller-pause-note">Para abrir ou pausar as vendas imediatamente, use o botão {myShop.is_open?'Pausar loja':'Reabrir loja'} no topo deste painel.</p>
            <label className="check-label"><input type="checkbox" checked={shopForm.delivery_enabled} onChange={e=>setShopForm(s=>({...s,delivery_enabled:e.target.checked}))}/> Oferecer entrega</label>
            {shopForm.delivery_enabled&&<label>Taxa de entrega (R$)
              <MoneyInput cents={shopForm.delivery_fee_cents}
                onValue={cents=>setShopForm(x=>({...x,delivery_fee_cents:cents}))}/>
            </label>}
            <label className="check-label"><input type="checkbox" checked={shopForm.pickup_enabled} onChange={e=>setShopForm(s=>({...s,pickup_enabled:e.target.checked}))}/> Oferecer retirada</label>
            <button className="primary-button" disabled={busy} type="submit">Salvar configurações <Check size={18}/></button>
            <div className="shop-danger-zone"><h3>Encerrar loja</h3>
              <p>A exclusão remove sua loja da vitrine e seus produtos. Pedidos anteriores são preservados.
                Para excluir, finalize ou cancele os pedidos em andamento. Sua conta de morador continuará ativa.</p>
              <button type="button" className="shop-delete-trigger" disabled={busy}
                onClick={()=>{setShowDeleteShop(true);setShopDeleteConfirmation('');setError('');}}>
                <Trash2 size={17}/> Excluir minha loja</button>
            </div>
          </form>}
        </>}
      </>}

      {view==='admin'&&viewer.role==='admin'&&<><button className="back-link" onClick={()=>go('account')}><ArrowLeft size={18}/> Minha conta</button><div className="page-title"><h1>Administração do condomínio</h1><p>Gerencie moradores, lojas e categorias da sua comunidade.</p></div>
        {adminData?<><div className="admin-stats"><div><strong>{adminData.stats.residents}</strong><span>Moradores ativos</span></div><div><strong>{adminData.stats.shops}</strong><span>Lojas ativas</span></div><div><strong>{adminData.stats.orders}</strong><span>Pedidos criados</span></div></div>
        <section className="admin-section"><SectionHeader title="Moradores cadastrados"/>
          {adminData.residents.length?adminData.residents.map(r=><div className="admin-row" key={r.id}><div><strong>{r.name}</strong><p>{r.email} · {r.tower} / {r.apartment}</p><Pill tone={r.status==='approved'?'green':'orange'}>{statusLabel[r.status]}</Pill></div><div className="inline-actions">{r.status==='suspended'&&<button disabled={busy} onClick={()=>adminAction('users',r.id,'approved')}>Reativar</button>}{r.status!=='suspended'&&<button disabled={busy} className="danger-text" onClick={()=>adminAction('users',r.id,'suspended')}>Suspender</button>}</div></div>):<p className="muted">Nenhum morador cadastrado ainda.</p>}</section>
        <section className="admin-section"><SectionHeader title="Lojas"/>{adminData.shops.length?adminData.shops.map(s=><div className="admin-row" key={s.id}><div><strong>{s.name}</strong><p>Responsável: {s.owner_name}</p><Pill tone={s.status==='approved'?'green':'orange'}>{statusLabel[s.status]}</Pill></div><div className="inline-actions">{s.status==='suspended'&&<button disabled={busy} onClick={()=>adminAction('shops',s.id,'approved')}>Reativar</button>}{s.status!=='suspended'&&<button disabled={busy} className="danger-text" onClick={()=>adminAction('shops',s.id,'suspended')}>Suspender</button>}</div></div>):<p className="muted">Nenhuma loja cadastrada.</p>}</section>
        <section className="admin-section white-panel"><h2><LayoutGrid size={20}/> Categorias</h2><div className="filter-chips">{adminData.categories.map(c=><span className="category-tag" key={c.id}>{c.name}</span>)}</div><form className="admin-category-form" onSubmit={createCategory}><input required minLength={2} maxLength={60} value={newCategory} onChange={e=>setNewCategory(e.target.value)} placeholder="Nova categoria de alimentação"/><select value={categoryIcon} onChange={e=>setCategoryIcon(e.target.value)} aria-label="Ícone"><option value="cake-slice">Bolos</option><option value="sandwich">Alimentos</option><option value="coffee">Bebidas</option><option value="pizza">Lanches</option><option value="ice-cream-cone">Sobremesas</option><option value="shopping-basket">Mercadinho</option></select><button className="outline-button" disabled={busy} type="submit"><Plus size={16}/>Adicionar</button></form></section>
                <section className="admin-section white-panel">
          <h2><ShieldCheck size={20}/> Denúncias de conteúdo
            {reports.filter(r=>r.status==='open').length>0&&<span className="review-pending-counter">
              {reports.filter(r=>r.status==='open').length}</span>}</h2>
          {reports.filter(r=>r.status==='open').length===0?<p className="muted">Nenhuma denúncia pendente.</p>:
            <div className="content-report-list">
              {reports.filter(r=>r.status==='open').map(r=><article className="content-report" key={r.id}>
                <strong>{r.target_type==='shop'?'Loja':'Produto'}: {r.target_name??'Indisponível'}</strong>
                <small>{r.reason==='image'?'Imagem imprópria':r.reason==='language'?'Linguagem ofensiva':r.reason==='inappropriate'?'Conteúdo inadequado':'Outro motivo'}</small>
                {r.details&&<p>{r.details}</p>}
                <div className="moderation-actions">
                  <button className="outline-button" disabled={busy} onClick={()=>resolveReport(r.id,'dismiss')}>Dispensar</button>
                  {r.target_type==='product'&&<button className="outline-button" disabled={busy} onClick={()=>resolveReport(r.id,'hide_product')}>Ocultar produto</button>}
                  <button className="danger-text" disabled={busy} onClick={()=>resolveReport(r.id,'suspend_shop')}>Suspender loja</button>
                </div>
              </article>)}
            </div>}
          {reports.some(r=>r.status==='resolved'&&r.target_type==='product'&&r.product_blocked)&&
            <div className="blocked-products">
              <h3>Produtos bloqueados</h3>
              {reports.filter(r=>r.status==='resolved'&&r.target_type==='product'&&r.product_blocked).map(r=>
                <div className="content-report" key={'blocked-'+r.id}>
                  <strong>{r.target_name??'Produto'}</strong>
                  <button type="button" className="outline-button" disabled={busy}
                    onClick={()=>unblockProduct(r.target_id)}>Permitir revisão do produto</button>
                </div>)}
            </div>}
        </section>
<section className="admin-section white-panel">
  <h2><ShieldCheck size={20}/> Código do condomínio</h2>
  <p>Você escolhe o código. Quem o informar pode entrar após confirmar o e-mail.</p>
  <form className="form-stack" onSubmit={saveInvite}>
    <label>Novo código<input required minLength={10} maxLength={40}
      pattern="[A-Za-z0-9-]+" value={customCode} placeholder="Ex.: JARDIM-CAJU-2026"
      onChange={e=>setCustomCode(e.target.value)}/></label>
    <button className="outline-button" disabled={busy} type="submit">Salvar código</button>
  </form>
  {invite&&<div className="invite-code"><code>{invite}</code>
    <button onClick={()=>navigator.clipboard.writeText(invite).then(()=>notify('Código copiado.')).catch(fail)}>Copiar</button></div>}
  <small>O código anterior deixa de funcionar quando você salva outro. Compartilhe somente com moradores.</small>
</section>
        </>:<Empty title="Carregando administração" subtitle="Confira sua conexão e tente novamente." action="Recarregar" onAction={()=>loadAdmin().catch(fail)}/>}
      </>}
      {reportTarget&&<div className="report-overlay" role="presentation" onClick={()=>setReportTarget(null)}>
        <section className="report-dialog" role="dialog" aria-modal="true" aria-label="Denunciar conteúdo" onClick={e=>e.stopPropagation()}>
          <button className="report-close" aria-label="Fechar denúncia" onClick={()=>setReportTarget(null)}><X size={21}/></button>
          <h2>Denunciar conteúdo</h2><p>{reportTarget.name}</p>
          <form className="form-stack" onSubmit={sendReport}>
            <label>Motivo<select value={reportReason} onChange={e=>setReportReason(e.target.value as typeof reportReason)}>
              <option value="image">Imagem imprópria</option>
              <option value="language">Palavras ofensivas</option>
              <option value="inappropriate">Conteúdo inadequado</option>
              <option value="other">Outro motivo</option>
            </select></label>
            <label>Detalhes (opcional)<textarea rows={3} maxLength={250} value={reportDetails}
              onChange={e=>setReportDetails(e.target.value)} placeholder="O que está errado?"/></label>
            <button className="primary-button" type="submit" disabled={busy}>Enviar denúncia</button>
          </form>
        </section>
      </div>}
    </main>

    {cropRequest&&<ImageCropper file={cropRequest.file} kind={cropRequest.kind}
      onCancel={()=>setCropRequest(null)}
      onApply={cropped=>{const kind=cropRequest.kind;setCropRequest(null);void upload(cropped,kind);}}/>}

    {cartCount>0&&view!=='cart'&&view!=='success'&&<button className="floating-cart" onClick={()=>go('cart')}><ShoppingBag size={19}/><span>{cartCount} {cartCount===1?'item':'itens'}</span><strong>{money(cartTotal)}</strong><ArrowRight size={18}/></button>}
    <nav className="bottom-nav" aria-label="Navegação principal">{bottomNav.map(([target,Icon,label])=><button key={target} className={view===target?'active':''} onClick={()=>go(target)}><Icon size={22} strokeWidth={view===target?2.4:1.8}/><span>{label}</span></button>)}</nav>
  </div>;
}
