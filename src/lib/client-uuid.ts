/**
 * UUID v4 for browser clients, including HTTP on the local network.
 * crypto.randomUUID() is only available in secure contexts; crypto.getRandomValues()
 * also works on non-secure origins such as http://192.168.x.x:3000.
 */
export function uuidV4FromBytes(source:Uint8Array):string{
  if(source.length!==16)throw new Error('Expected 16 random bytes.');
  const bytes=new Uint8Array(source);
  bytes[6]=(bytes[6]&0x0f)|0x40;
  bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0'));
  return [hex.slice(0,4).join(''),hex.slice(4,6).join(''),hex.slice(6,8).join(''),
    hex.slice(8,10).join(''),hex.slice(10,16).join('')].join('-');
}

export function clientUUID():string{
  const cryptoProvider=globalThis.crypto;
  if(!cryptoProvider?.getRandomValues)throw new Error(
    'Este navegador não permite gerar identificadores seguros.'
  );
  return uuidV4FromBytes(cryptoProvider.getRandomValues(new Uint8Array(16)));
}
