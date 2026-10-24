/** Slots de arte. Adicione arquivos em public/illustrations/ e troque null pelo caminho.
 * null mantém o fallback do componente (sem imagem quebrada ou request 404).
 * Nenhum item aqui se refere às fotografias de produtos dos moradores.
 */
export const artwork = {
  login: null,
  homeHero: null,
  weeklyOffers: null,
  signupPending: null,
  accountApproved: null,
  recoverPassword: null,
  resetPassword: null,
  orderSuccess: null,
  emptyProducts: null,
  emptyShops: null,
  emptyOrders: null,
  emptyFavorites: null,
  sellerWelcome: null,
  categoryAll: null,
  categoryBolos: null,
  categoryPaes: null,
  categoryRefeicoes: null,
  categoryBebidas: null,
  categoryBeleza: null,
  categoryModa: null,
  categoryPresentes: null,
  categoryOutros: null,
  categoryRestaurantes: null,
  categorySobremesas: null
} as Record<string, string | null>;
export type ArtworkKey = keyof typeof artwork;

export function getCategoryArtwork(name:string,icon?:string):string|null {
  const normalized=name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(/restaurante|lanchonete|delivery/.test(normalized))return artwork.categoryRestaurantes;
  if(/sobremesa|sorvete|acai/.test(normalized))return artwork.categorySobremesas;
  if(/bolo|doce/.test(normalized))return artwork.categoryBolos;
  if(/pao|salgado/.test(normalized))return artwork.categoryPaes;
  if(/refeic|comida|almoco|jantar/.test(normalized))return artwork.categoryRefeicoes;
  if(/bebida|suco|cafe/.test(normalized))return artwork.categoryBebidas;
  if(/beleza|perfume|cosmetico/.test(normalized))return artwork.categoryBeleza;
  if(/moda|roupa|vestuario/.test(normalized))return artwork.categoryModa;
  if(/presente|artesanato/.test(normalized))return artwork.categoryPresentes;
  const categoryByIcon:Record<string,string|null>={
    'cake-slice':artwork.categoryBolos,'sandwich':artwork.categoryPaes,
    'utensils':artwork.categoryRefeicoes,'coffee':artwork.categoryBebidas,
    'sparkles':artwork.categoryBeleza,'shirt':artwork.categoryModa,
    'gift':artwork.categoryPresentes,'shopping-bag':artwork.categoryOutros
  };
  return icon?categoryByIcon[icon]??artwork.categoryOutros:artwork.categoryOutros;
}
