/** Desapego is a separate, free resident-to-resident listing flow. */
export function isCommercialProductCategory(categoryName:string):boolean {
  return categoryName.trim().toLocaleLowerCase('pt-BR')!=='desapego';
}

export const EXCLUSIVE_DESAPEGO_MESSAGE=
  'A categoria Desapego é exclusiva para anúncios gratuitos entre moradores. Use a seção Desapego para publicar esse tipo de anúncio.';
