export async function prepareMarketplaceImage(file:File,maxMB:number):Promise<File>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Selecione JPG, PNG ou WebP.');
 if(file.size>maxMB*1024*1024)throw new Error('Imagem deve ter no máximo '+maxMB+' MB.');
 if(file.size<3_500_000)return file;
 const bitmap=await createImageBitmap(file);
 try{
  const ratio=Math.min(1,960/bitmap.width,960/bitmap.height);
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
  canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Não foi possível preparar a imagem.');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(v=>v?resolve(v):reject(new Error('Falha ao otimizar imagem.')),'image/webp',0.8));
  return new File([blob],'imagem.webp',{type:'image/webp'});
 }finally{bitmap.close();}
}
