export type HelpArea='resident'|'seller'|'admin';
export type HelpArticle={
  id:string;
  area:HelpArea;
  topic:string;
  title:string;
  steps:string[];
  note?:string;
};

export const helpArticles:HelpArticle[]=[
  // Moradores: conta e acesso
  {id:'criar-conta',area:'resident',topic:'Conta e acesso',title:'Como criar minha conta?',steps:[
    'Na tela inicial do Elevadoor, toque em Cadastre-se ou Criar minha conta.',
    'Preencha seu nome, WhatsApp, e-mail e crie uma senha segura.',
    'Informe o código de convite fornecido pelo condomínio e selecione sua torre e apartamento.',
    'Toque em Criar minha conta e confirme o e-mail, se solicitado.',
    'Depois, entre com seu e-mail e senha.'
  ],note:'O acesso ao marketplace é exclusivo para moradores cadastrados.'},
  {id:'entrar',area:'resident',topic:'Conta e acesso',title:'Como entrar no Elevadoor?',steps:[
    'Abra o Elevadoor e escolha Entrar com e-mail.',
    'Digite o e-mail cadastrado e a senha.',
    'Toque em Entrar com e-mail. Se a opção estiver disponível, você também pode usar Continuar com Google.'
  ]},
  {id:'recuperar-senha',area:'resident',topic:'Conta e acesso',title:'Esqueci minha senha. O que faço?',steps:[
    'Na tela de login, toque em Esqueci minha senha.',
    'Informe seu e-mail e solicite o link de recuperação.',
    'Abra o e-mail recebido e siga as instruções para criar uma nova senha.'
  ],note:'Verifique a caixa de spam caso a mensagem não apareça.'},
  {id:'meus-dados',area:'resident',topic:'Conta e acesso',title:'Como alterar meus dados ou apartamento?',steps:[
    'Acesse Minha conta → Meu perfil.',
    'Atualize nome, WhatsApp, torre ou apartamento.',
    'Toque em Salvar meus dados.'
  ]},
  {id:'foto-perfil',area:'resident',topic:'Conta e acesso',title:'Como adicionar minha foto de perfil?',steps:[
    'Acesse Minha conta → Meu perfil.',
    'Toque em Adicionar foto de perfil ou Trocar foto de perfil.',
    'Selecione a imagem, ajuste o enquadramento e confirme.'
  ]},
  {id:'loja-compartilhada',area:'resident',topic:'Conta e acesso',title:'Recebi um link de loja. Como acessar?',steps:[
    'Abra o link que recebeu pelo WhatsApp ou outro aplicativo.',
    'Se não estiver conectado, veja o convite com o nome da loja e do condomínio.',
    'Escolha Sou morador · Entrar ou Criar minha conta.',
    'Depois de entrar, a loja será aberta, desde que pertença ao seu condomínio.'
  ]},
  {id:'excluir-conta',area:'resident',topic:'Conta e acesso',title:'Como excluir minha conta?',steps:[
    'Acesse Minha conta.',
    'Toque em Excluir minha conta.',
    'Leia os avisos e siga a confirmação solicitada pelo sistema.'
  ],note:'A exclusão é definitiva e pode afetar sua loja. Verifique pedidos pendentes antes de continuar.'},
  // Moradores: compras e pedidos
  {id:'buscar-produtos',area:'resident',topic:'Compras e pedidos',title:'Como encontrar produtos ou lojas?',steps:[
    'Na página Início, use o campo de busca para procurar um produto ou loja.',
    'Se preferir, toque em Explorar para navegar pelas categorias.',
    'Toque em um produto para ver preço, opções e detalhes.'
  ]},
  {id:'carrinho',area:'resident',topic:'Compras e pedidos',title:'Como colocar produtos no carrinho?',steps:[
    'Abra o produto desejado.',
    'Escolha a quantidade e, se houver, os sabores, tamanhos ou adicionais.',
    'Toque no botão de adicionar ao carrinho.',
    'Abra o carrinho para revisar os itens antes de concluir.'
  ]},
  {id:'finalizar-pedido',area:'resident',topic:'Compras e pedidos',title:'Como fazer um pedido?',steps:[
    'Adicione os produtos ao carrinho e abra o carrinho.',
    'Revise os itens e escolha entrega ou retirada, conforme a disponibilidade da loja.',
    'Preencha data, horário e instruções, se precisar, e selecione a forma de pagamento.',
    'Prossiga para registrar o pedido e abra o WhatsApp.',
    'No WhatsApp, toque em Enviar para encaminhar a mensagem ao vendedor.'
  ],note:'O pedido fica registrado no Elevadoor. A loja é responsável por confirmar disponibilidade, entrega e pagamento.'},
  {id:'entrega-ou-retirada',area:'resident',topic:'Compras e pedidos',title:'Como escolher entrega ou retirada?',steps:[
    'No carrinho, selecione Entrega ou Retirada, quando essas opções estiverem disponíveis.',
    'Em Entrega, confira sua torre e apartamento cadastrados.',
    'Informe data ou período preferido e orientações de entrega, se necessário.',
    'Confira o valor total, inclusive eventual taxa de entrega, antes de continuar.'
  ]},
  {id:'acompanhar-pedido',area:'resident',topic:'Compras e pedidos',title:'Onde acompanho meus pedidos?',steps:[
    'Acesse Minha conta → Meus pedidos ou a aba Pedidos.',
    'Encontre a compra e confira a situação: aguardando confirmação, confirmado, concluído ou cancelado.',
    'Se o pedido estiver em andamento, use Abrir WhatsApp para voltar à conversa com a loja.'
  ]},
  {id:'avaliar-compra',area:'resident',topic:'Compras e pedidos',title:'Como avaliar uma compra?',steps:[
    'Acesse Meus pedidos.',
    'Localize uma compra concluída que permita avaliação.',
    'Toque em Avaliar esta compra.',
    'Escolha as estrelas, escreva o comentário e envie a avaliação.'
  ],note:'A loja analisa a avaliação antes de ela aparecer publicamente.'},
  {id:'favoritos',area:'resident',topic:'Compras e pedidos',title:'Como salvar produtos favoritos?',steps:[
    'Encontre um produto na vitrine ou no catálogo.',
    'Toque no ícone de coração.',
    'Abra a aba Salvos para encontrar seus favoritos novamente.'
  ]},
  // Moradores: comunidade
  {id:'feiras-comprar',area:'resident',topic:'Comunidade',title:'Como ver os produtos de uma feira?',steps:[
    'Acesse Feiras pelo menu ou Minha conta → Feiras do condomínio.',
    'Toque em Explorar feira na feira desejada.',
    'Escolha um produto e continue a compra normalmente.'
  ],note:'A feira e os produtos só aparecem enquanto estiverem publicados e disponíveis.'},
  {id:'desapego',area:'resident',topic:'Comunidade',title:'Como encontrar itens de desapego?',steps:[
    'Abra a área Desapego do condomínio, quando estiver habilitada.',
    'Confira os anúncios disponíveis.',
    'Abra um item para consultar os detalhes e combinar diretamente com o anunciante.'
  ]},
  // Vendedores: loja
  {id:'abrir-loja',area:'seller',topic:'Minha loja',title:'Como criar minha loja?',steps:[
    'Acesse Minha conta → Quero vender.',
    'Preencha o nome da loja, a descrição e o WhatsApp para pedidos.',
    'Teste o número do WhatsApp e aceite as regras da comunidade.',
    'Toque em Criar minha loja.',
    'Acompanhe a situação da loja no Painel do vendedor.'
  ]},
  {id:'configurar-loja',area:'seller',topic:'Minha loja',title:'Como alterar fotos e configurações da loja?',steps:[
    'Acesse Minha conta → Minha loja ou Painel do vendedor.',
    'Abra a aba Configurações.',
    'Altere nome, descrição, WhatsApp, logo, capa e opções de entrega ou retirada.',
    'Revise as formas de pagamento e salve as mudanças.'
  ]},
  {id:'abrir-fechar-loja',area:'seller',topic:'Minha loja',title:'Como abrir ou fechar minha loja temporariamente?',steps:[
    'Acesse Minha conta → Minha loja.',
    'No topo do Painel do vendedor, toque em Fechar loja ou Abrir loja.',
    'Confira a situação atual exibida no painel.'
  ],note:'Uma loja fechada não recebe novos pedidos.'},
  {id:'compartilhar-loja',area:'seller',topic:'Minha loja',title:'Como compartilhar o link da minha loja?',steps:[
    'Acesse Minha conta → Minha loja.',
    'Toque em Compartilhar loja.',
    'Escolha o aplicativo de compartilhamento ou copie o link.',
    'Envie o link aos moradores do condomínio.'
  ],note:'Quem não estiver logado verá um convite para entrar ou criar uma conta.'},
  // Vendedores: produtos
  {id:'adicionar-produto',area:'seller',topic:'Produtos',title:'Como cadastrar um produto?',steps:[
    'Acesse Minha conta → Painel do vendedor → Produtos.',
    'Toque em Adicionar.',
    'Inclua foto, nome, descrição, categoria e preço.',
    'Se desejar, informe preço promocional, estoque e prazo de preparo.',
    'Escolha a exibição do produto e toque em Salvar produto.'
  ]},
  {id:'editar-produto',area:'seller',topic:'Produtos',title:'Como editar um produto?',steps:[
    'Acesse Painel do vendedor → Produtos.',
    'Toque no produto desejado.',
    'Altere as informações necessárias.',
    'Toque em Salvar produto.'
  ]},
  {id:'visibilidade-produto',area:'seller',topic:'Produtos',title:'Como deixar um produto indisponível ou oculto?',steps:[
    'Acesse Painel do vendedor → Produtos.',
    'Encontre o produto e selecione Disponível, Indisponível ou Oculto.',
    'Use Disponível para vender, Indisponível para mostrar sem aceitar compra ou Oculto para retirar da vitrine.'
  ]},
  {id:'opcoes-produto',area:'seller',topic:'Produtos',title:'Como adicionar sabores, tamanhos e adicionais?',steps:[
    'Acesse Painel do vendedor → Produtos e abra um produto.',
    'Na seção Opções do produto, toque em Grupo.',
    'Dê um nome ao grupo, como Sabor ou Cobertura.',
    'Cadastre as escolhas, informe adicionais em reais e configure se a seleção é obrigatória.',
    'Salve o produto.'
  ]},
  {id:'excluir-produto',area:'seller',topic:'Produtos',title:'Como excluir um produto?',steps:[
    'Acesse Painel do vendedor → Produtos.',
    'Encontre o produto e toque em Excluir, ou abra a edição e escolha Excluir produto.',
    'Leia a confirmação e confirme a exclusão.'
  ],note:'A exclusão retira o produto da vitrine; o histórico de pedidos anteriores é preservado.'},
  // Vendedores: pedidos e avaliações
  {id:'pedidos-vendedor',area:'seller',topic:'Pedidos e avaliações',title:'Como confirmar ou concluir um pedido?',steps:[
    'Acesse Painel do vendedor → Pedidos.',
    'Encontre o pedido que está aguardando confirmação.',
    'Toque em Confirmar após conferir a disponibilidade.',
    'Depois da entrega ou retirada, toque em Concluir.',
    'Se não puder atender, use Cancelar quando essa opção estiver disponível.'
  ]},
  {id:'pagamento-loja',area:'seller',topic:'Pedidos e avaliações',title:'Como funciona o pagamento dos pedidos?',steps:[
    'Confira a forma de pagamento escolhida pelo comprador nos detalhes do pedido.',
    'Converse com o cliente pelo WhatsApp para combinar o pagamento e a entrega.',
    'Registre a conclusão do pedido no Painel do vendedor depois de atender o cliente.'
  ],note:'O Elevadoor registra o pedido, mas não processa o pagamento entre morador e vendedor.'},
  {id:'moderar-avaliacao',area:'seller',topic:'Pedidos e avaliações',title:'Como aprovar uma avaliação da minha loja?',steps:[
    'Acesse Painel do vendedor → Avaliações.',
    'Encontre uma avaliação aguardando moderação.',
    'Toque em Aprovar e publicar ou Não publicar.'
  ]},
  // Vendedores: feiras
  {id:'inscrever-feira',area:'seller',topic:'Feiras',title:'Como adicionar um produto à feira?',steps:[
    'Acesse Minha conta → Painel do vendedor → Feiras.',
    'Encontre a feira em Participar de feiras.',
    'No campo Produto, selecione um produto disponível da sua loja.',
    'Toque em Inscrever produto.',
    'Aguarde a aprovação da administração.'
  ],note:'O produto só entra na vitrine da feira depois da aprovação e durante o período da feira.'},
  {id:'retirar-feira',area:'seller',topic:'Feiras',title:'Como retirar um produto de uma feira?',steps:[
    'Acesse Painel do vendedor → Feiras.',
    'Localize a feira e o produto inscrito.',
    'Toque em Retirar ao lado do produto.'
  ]},
  // Administradores: acesso restrito
  {id:'resumo-admin',area:'admin',topic:'Gestão do condomínio',title:'Onde vejo os indicadores do condomínio?',steps:[
    'Acesse Minha conta → Administração.',
    'Abra a aba Resumo.',
    'Consulte os totais de moradores ativos, lojas ativas e pedidos criados.'
  ]},
  {id:'administrar-moradores',area:'admin',topic:'Gestão do condomínio',title:'Como buscar ou suspender um morador?',steps:[
    'Acesse Administração → Moradores.',
    'Use a busca ou os filtros de situação e torre.',
    'Encontre o cadastro desejado.',
    'Toque em Suspender ou Reativar, conforme a situação.'
  ]},
  {id:'administrar-lojas',area:'admin',topic:'Gestão do condomínio',title:'Como consultar ou suspender uma loja?',steps:[
    'Acesse Administração → Lojas.',
    'Busque pelo nome da loja ou do responsável e filtre pela situação.',
    'Encontre a loja desejada.',
    'Toque em Suspender ou Reativar.'
  ]},
  {id:'categorias-admin',area:'admin',topic:'Configurações',title:'Como configurar as categorias do condomínio?',steps:[
    'Acesse Administração → Categorias.',
    'Ative ou desative as categorias opcionais, quando disponíveis.',
    'Para adicionar uma categoria de alimentação, preencha o nome e escolha um ícone.',
    'Toque em Adicionar.'
  ]},
  {id:'torres-admin',area:'admin',topic:'Configurações',title:'Como alterar a identificação das torres?',steps:[
    'Acesse Administração → Configurações.',
    'Encontre Torres do condomínio.',
    'Escolha Letras ou Números e informe a quantidade de torres.',
    'Confira a prévia e toque em Salvar configuração das torres.'
  ],note:'O sistema impede remover torres que ainda têm moradores cadastrados.'},
  {id:'convite-admin',area:'admin',topic:'Configurações',title:'Como alterar o código de convite do condomínio?',steps:[
    'Acesse Administração → Configurações.',
    'Encontre Código do condomínio.',
    'Digite o novo código e toque em Salvar código.',
    'Compartilhe o código apenas com moradores autorizados.'
  ],note:'Ao salvar, o código anterior deixa de funcionar.'},
  {id:'denuncias-admin',area:'admin',topic:'Moderação',title:'Como analisar uma denúncia de conteúdo?',steps:[
    'Acesse Administração → Denúncias.',
    'Filtre por Pendentes para ver o que precisa de análise.',
    'Abra a denúncia para conferir o motivo e o conteúdo.',
    'Escolha Dispensar, Ocultar produto ou Suspender loja, conforme o caso.'
  ]},
  {id:'criar-feira',area:'admin',topic:'Feiras',title:'Como criar uma feira do condomínio?',steps:[
    'Acesse Administração → Feiras.',
    'Em Nova feira, informe nome e descrição.',
    'Se desejar, envie uma imagem de capa.',
    'Defina início e encerramento.',
    'Marque Publicar e abrir inscrições dos vendedores, se quiser liberá-la, e toque em Criar feira.'
  ]},
  {id:'publicar-feira',area:'admin',topic:'Feiras',title:'Como publicar ou retirar uma feira do ar?',steps:[
    'Acesse Administração → Feiras.',
    'Encontre a feira na seção Feiras cadastradas.',
    'Toque em Publicar ou Retirar do ar.',
    'Se precisar alterar datas e outras informações, use Editar.'
  ]},
  {id:'aprovar-feira',area:'admin',topic:'Feiras',title:'Como aprovar um produto inscrito na feira?',steps:[
    'Com um usuário administrador, acesse Administração → Feiras.',
    'Localize a feira desejada.',
    'Na seção Produtos inscritos, encontre o produto.',
    'Toque em Aprovar para aceitar a participação ou Rejeitar para recusá-la.'
  ],note:'Só os produtos aprovados e disponíveis aparecem na feira durante seu período de publicação.'}
];
