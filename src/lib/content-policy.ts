/** Basic, deliberately conservative PT-BR text guard.
 * This is NOT a full moderation system. Reports allow handling nuanced text
 * and images after publication; no automated image-content classifier is used.
 */
const disallowedWords=new Set([
  'caralho','porra','merda','puta','putaria','putaquepariu','arrombado',
  'fdp','foda-se','fodase','cuzao','cuzão','pornografia','pornografico',
  'pornografica','nazismo','nazista'
]);
function normalize(input:string) {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^\p{L}\p{N}]+/gu,' ').toLowerCase().trim();
}
const normalizedWords=new Set([...disallowedWords].map(normalize));
export function violatesCommunityLanguage(...values:(string|undefined|null)[]):boolean {
  for(const value of values){
    const normalized=normalize(value??'');
    if(!normalized)continue;
    const tokens=normalized.split(/\s+/);
    if(tokens.some(token=>normalizedWords.has(token)))return true;
    if(tokens.some((token,i)=>token==='foda'&&tokens[i+1]==='se'))return true;
  }
  return false;
}
export const communityGuidelines=[
  'Use palavras respeitosas e descrições verdadeiras.',
  'Não publique ofensas, discriminação, pornografia ou imagens inadequadas.',
  'Venda apenas alimentos e bebidas permitidos por lei.',
  'Conteúdos denunciados podem ser ocultados e lojas podem ser suspensas.'
] as const;
