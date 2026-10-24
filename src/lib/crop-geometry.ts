/** Pure crop geometry used by both the preview and the canvas export. */
export function cropGeometry(imageWidth:number,imageHeight:number,viewportWidth:number,aspect:number,zoom:number,panX=0,panY=0){
  if(!(imageWidth>0&&imageHeight>0&&viewportWidth>0&&aspect>0))throw new Error('Invalid crop dimensions.');
  const viewportHeight=viewportWidth/aspect;
  const scale=Math.max(viewportWidth/imageWidth,viewportHeight/imageHeight)*Math.max(1,zoom);
  const renderWidth=imageWidth*scale,renderHeight=imageHeight*scale;
  const maxPanX=Math.max(0,(renderWidth-viewportWidth)/2);
  const maxPanY=Math.max(0,(renderHeight-viewportHeight)/2);
  const x=Math.max(-maxPanX,Math.min(maxPanX,panX));
  const y=Math.max(-maxPanY,Math.min(maxPanY,panY));
  return {
    renderWidth,renderHeight,viewportHeight,maxPanX,maxPanY,panX:x,panY:y,
    sx:(renderWidth-viewportWidth)/2/scale-x/scale,
    sy:(renderHeight-viewportHeight)/2/scale-y/scale,
    sw:viewportWidth/scale,sh:viewportHeight/scale
  };
}
