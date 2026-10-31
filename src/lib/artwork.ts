/** Slots de arte. Adicione arquivos em public/illustrations/ e troque null pelo caminho.
 * null mantém o fallback do componente (sem imagem quebrada ou request 404).
 * Nenhum item aqui se refere às fotografias de produtos dos moradores.
 */
export const artwork = {
  login: null,
  homeHero: null,
  weeklyOffers: '/illustrations/ofertas-semana.png',
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
  categoryBolos: '/categories/bolos.webp',
  categoryPaes: '/categories/padaria.webp',
  categoryRefeicoes: '/categories/refeicoes.webp',
  categoryBebidas: '/categories/bebidas.webp',
  categoryBeleza: '/categories/beleza.webp',
  categoryModa: '/categories/moda.webp',
  categoryPresentes: '/categories/presentes.webp',
  categoryOutros: '/categories/outros.webp',
  categoryRestaurantes: '/categories/refeicoes.webp',
  categorySobremesas: '/categories/sorvetes.webp',
  categoryLanches: '/categories/lanches.webp',
  categoryMercadinho: '/categories/mercado.webp',
  categoryServicos: '/categories/servicos.webp',
  categorySaude: '/categories/saude.webp',
  categoryCasa: '/categories/casa-decoracao.webp',
  categoryEletronicos: '/categories/eletronicos.webp'
} as Record<string, string | null>;
export type ArtworkKey = keyof typeof artwork;

export function getCategoryArtwork(name:string,icon?:string):string|null {
  const normalized=name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  // Specific categories take precedence over broad groups (e.g. pizza vs. lanches).
  // A missing or invalid image is handled by IllustrationSlot's existing icon fallback.
  if(/desapego/.test(normalized))return '/categories/desapego.webp';
  if(/^outros?$/.test(normalized))return '/categories/outros.webp';
  if(/pizza/.test(normalized))return '/categories/pizzas.webp';
  if(/sushi|japones/.test(normalized))return '/categories/sushi.webp';
  if(/acai/.test(normalized))return '/categories/acai.webp';
  if(/\bpet(s)?\b|animais/.test(normalized))return '/categories/pets.webp';
  if(/limpeza/.test(normalized))return '/categories/limpeza.webp';
  if(/(?:paes|pao).*(?:salgado)|(?:salgado).*(?:paes|pao)/.test(normalized))return '/categories/padaria.webp';
  if(/salgado/.test(normalized))return '/categories/salgados.webp';
  if(/padaria/.test(normalized))return '/categories/padaria.webp';
  if(/\bdoce(s)?\b|brigadeiro/.test(normalized)&&!/bolo/.test(normalized))return '/categories/doces.webp';
  if(/restaurante|delivery/.test(normalized))return artwork.categoryRestaurantes;
  if(/lanch|hamburg|pizza/.test(normalized))return artwork.categoryLanches;
  if(/mercad|conveniencia|supermerc/.test(normalized))return artwork.categoryMercadinho;
  if(/servic|reparo|manutenc/.test(normalized))return artwork.categoryServicos;
  if(/saude|bem[ -]?estar/.test(normalized))return artwork.categorySaude;
  if(/casa|decorac/.test(normalized))return artwork.categoryCasa;
  if(/eletronic|informatica|celular/.test(normalized))return artwork.categoryEletronicos;
  if(/sorvete|gelato|ice[ -]?cream/.test(normalized))return '/categories/sorvetes.webp';
  if(/sobremesa/.test(normalized))return '/categories/doces.webp';
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
    'gift':artwork.categoryPresentes,'shopping-bag':artwork.categoryOutros,
    'pizza':artwork.categoryLanches,'ice-cream-cone':artwork.categorySobremesas,
    'shopping-basket':artwork.categoryMercadinho,'wrench':artwork.categoryServicos,
    'heart-pulse':artwork.categorySaude,'house':artwork.categoryCasa,
    'smartphone':artwork.categoryEletronicos
  };
  return icon?categoryByIcon[icon]??artwork.categoryOutros:artwork.categoryOutros;
}
