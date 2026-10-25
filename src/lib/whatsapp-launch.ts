/**
 * The API deliberately returns a standard wa.me URL; on Android Chrome a
 * user-initiated intent can target the consumer WhatsApp Messenger package.
 * Chrome blocks app intents without a fresh user gesture, so render the
 * returned URL in a real <a href> button rather than navigating after await.
 */
export function supportsMessengerIntent(userAgent:string):boolean{
  return /Android/i.test(userAgent)
    && /(?:Chrome\/|EdgA\/)/i.test(userAgent)
    && !/(?:SamsungBrowser\/|Firefox\/|FxiOS\/|OPR\/)/i.test(userAgent);
}

export function whatsappMessengerHref(whatsappUrl:string,userAgent:string):string{
  if(!supportsMessengerIntent(userAgent))return whatsappUrl;
  let parsed:URL;
  try{parsed=new URL(whatsappUrl);}catch{return whatsappUrl;}
  if(parsed.protocol!=='https:'||parsed.hostname!=='wa.me'||parsed.port
    ||!/^\/\d{10,15}\/?$/.test(parsed.pathname))return whatsappUrl;
  const phone=parsed.pathname.replace(/\//g,'');
  const message=parsed.searchParams.get('text');
  // Preserve the exact message from the backend when including multiline
  // product notes, extras and total. Never construct an intent from untrusted hosts.
  const params=new URLSearchParams({phone});
  if(message!==null)params.set('text',message);
  return 'intent://send?'+params.toString()
    +'#Intent;scheme=whatsapp;package=com.whatsapp;'
    +'S.browser_fallback_url='+encodeURIComponent(whatsappUrl)+';end';
}
