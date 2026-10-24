# Condovery — Slots de imagens e tipografia (MVP)

**Para adicionar suas imagens depois, não é necessário editar as telas.** Edite somente
\`src/lib/artwork.ts\` e coloque os arquivos em \`public/illustrations/\`.

O mapa \`artwork\` começa com \`null\` para cada posição. O componente
\`src/components/IllustrationSlot.tsx\` mantém um fallback leve enquanto não houver arte.
Assim a página funciona sem arquivos inexistentes e sem imagens quebradas.
Quando você fornecer o arquivo, substitua o valor \`null\` pelo caminho relativo
à pasta \`public\`. Exemplo: \`homeHero: '/illustrations/home-hero.webp'\`.

## Posições disponíveis

| Chave no artwork.ts | Tela | Sugestão de formato |
|---|---|---|
| \`login\` | Login e boas-vindas, em mobile e desktop (banner laranja) | WebP/PNG transparente, 1000×900 |
| \`homeHero\` | Banner “Descubra o melhor da sua vizinhança”, acima do CTA no celular | WebP/PNG transparente, 1000×750 |
| \`weeklyOffers\` | Card “Ofertas da semana” com CTA “Conferir agora” | WebP/PNG, 800×550 |
| \`signupPending\` | Cadastro enviado / aguardando aprovação | WebP/PNG transparente, 640×520 |
| \`accountApproved\` | Perfil de um morador aprovado | WebP/PNG transparente, 300×300 |
| \`recoverPassword\` | Recuperação de senha | WebP/PNG transparente, 640×520 |
| \`resetPassword\` | Definir nova senha | WebP/PNG transparente, 640×520 |
| \`orderSuccess\` | Pedido registrado | WebP/PNG transparente, 640×520 |
| \`emptyProducts\` | Lista de produtos vazia | WebP/PNG transparente, 500×450 |
| \`emptyShops\` | Sem lojas cadastradas | WebP/PNG transparente, 500×450 |
| \`emptyOrders\` | Histórico/filtro de pedidos vazio | WebP/PNG transparente, 500×450 |
| \`emptyFavorites\` | Favoritos vazios | WebP/PNG transparente, 500×450 |
| \`sellerWelcome\` | Criar minha loja | WebP/PNG transparente, 500×450 |
| \`categoryAll\` | Categoria circular “Todos” no Explorar | WebP/PNG transparente, 256×256 |
| \`categoryBolos\` | Bolos e doces | WebP/PNG transparente, 256×256 |
| \`categoryPaes\` | Pães e salgados | WebP/PNG transparente, 256×256 |
| \`categoryRefeicoes\` | Refeições | WebP/PNG transparente, 256×256 |
| \`categoryBebidas\` | Bebidas | WebP/PNG transparente, 256×256 |
| \`categoryBeleza\` | Beleza | WebP/PNG transparente, 256×256 |
| \`categoryModa\` | Moda | WebP/PNG transparente, 256×256 |
| \`categoryPresentes\` | Presentes | WebP/PNG transparente, 256×256 |
| \`categoryOutros\` | Outras categorias não mapeadas | WebP/PNG transparente, 256×256 |
| \`categoryRestaurantes\` | Restaurantes/lanchonetes | WebP/PNG transparente, 256×256 |
| \`categorySobremesas\` | Sorvetes/sobremesas/açaí | WebP/PNG transparente, 256×256 |

As imagens circulares não substituem os **produtos** cadastrados pelos vendedores:
somente ilustram categorias. O nome real da categoria, sua disponibilidade e o
filtro continuam vindo do backend. \`getCategoryArtwork\` resolve nomes comuns e
usa os ícones do cadastro quando um arquivo não estiver configurado.

**Boas práticas:** otimizar WebP (aprox. 50–200 KB em círculos, e idealmente
até 350 KB nos banners), manter bordas transparentes em ilustrações e usar
nomes simples sem espaços. Não commitar arquivos de fontes.

## Fluxos/filtros
- Home e Explorar usam a **mesma fonte de categorias cadastradas**; ambos
  mostram ícones ilustrativos ou sua arte circular configurada.
- Ofertas da semana: card próprio com arte reservada e CTA “Conferir agora”;
  só exibe produtos em destaque abaixo se houver produtos reais.
- Pedidos: filtros Todos, Criados, Confirmados, Concluídos e Cancelados.
  Eles consultam os status existentes no backend (mais recentes primeiro,
  até 100 resultados por seleção), sem simular entregas ou pagamentos.
- As fontes Outfit (títulos) e DM Sans (corpo) são carregadas com
  \`next/font/google\`, integradas ao CSS e sem dependência do CDN em runtime.

## QA mobile
Validar em larguras 320/360/390/430 px: sem rolagem lateral do documento,
com rolagem *dentro* das categorias/filtros e sem sobreposição da barra
inferior com o botão do carrinho. Conferir login, recuperação, Home,
Explorar, Pedidos, Perfil, carrinho e telas administrativas.
