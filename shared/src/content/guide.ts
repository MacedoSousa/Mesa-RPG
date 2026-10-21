/**
 * Conteúdo do "Guia para Novatos" (aba do jogador) e dos tooltips da interface.
 * Cada termo tem uma explicação curta (tooltip) e uma longa (guia).
 */

export interface GuideTerm {
  key: string;
  term: string;
  tooltip: string;
  details: string;
  example?: string;
}

export interface GuideSection {
  key: string;
  title: string;
  icon: string;
  intro: string;
  terms: GuideTerm[];
}

export const GUIDE: GuideSection[] = [
  {
    key: 'basico',
    title: 'O que é um RPG de mesa?',
    icon: '🎲',
    intro: 'Você interpreta um herói numa história contada pelo Mestre. Você diz o que quer fazer; os dados e as regras dizem se deu certo.',
    terms: [
      { key: 'mestre', term: 'Mestre', tooltip: 'Quem narra a história e controla monstros e o mundo.', details: 'O Mestre descreve as cenas, interpreta os personagens do mundo, controla os monstros e decide as consequências das suas ações. Ele joga do PC Host e pode fazer rolagens secretas.' },
      { key: 'd20', term: 'd20', tooltip: 'Dado de 20 lados — o dado mais importante do jogo.', details: 'Quase tudo se resolve com 1d20 + um modificador contra um número-alvo. Tirar 20 natural é um sucesso crítico; 1 natural é uma falha crítica nos ataques.', example: '1d20+5: role o d20 e some 5.' },
      { key: 'notacao', term: 'Notação de dados', tooltip: 'NdX+M: role N dados de X lados e some M.', details: '2d6+3 = role dois dados de 6 lados e some 3. "kh1" significa manter o maior (vantagem), "kl1" manter o menor (desvantagem).', example: '2d20kh1+4 é um ataque com vantagem e +4.' },
      { key: 'cd', term: 'CD (Classe de Dificuldade)', tooltip: 'O número que você precisa alcançar num teste.', details: 'Fácil 10, médio 15, difícil 20. O Mestre define a CD; você rola 1d20 + modificador e precisa igualar ou superar.' },
    ],
  },
  {
    key: 'ficha',
    title: 'Sua ficha',
    icon: '📜',
    intro: 'A ficha descreve o que seu herói sabe fazer. O Mesa RPG calcula quase tudo para você.',
    terms: [
      { key: 'atributos', term: 'Atributos', tooltip: 'Força, Destreza, Constituição, Inteligência, Sabedoria e Carisma.', details: 'Cada atributo vai de 1 a 20 (heróis comuns ficam entre 8 e 17 no começo). Você distribui 27 pontos na criação (point-buy): valores mais altos custam mais.' },
      { key: 'modificador', term: 'Modificador', tooltip: '(atributo − 10) ÷ 2, arredondado para baixo.', details: 'É o número que você soma nas rolagens. Atributo 16 = +3; 10 = +0; 8 = −1.' },
      { key: 'proficiencia', term: 'Bônus de Proficiência', tooltip: '+2 no nível 1: somado no que você treinou.', details: 'Você soma este bônus em ataques com armas que domina, em perícias treinadas e em testes de resistência da sua classe. Sobe para +3 no nível 5.' },
      { key: 'ca', term: 'CA (Classe de Armadura)', tooltip: 'Quão difícil é acertar você.', details: 'Um ataque acerta se o total do d20 for maior ou igual à sua CA. Armaduras, escudos e Destreza aumentam a CA.' },
      { key: 'pv', term: 'PV (Pontos de Vida)', tooltip: 'Sua vida. Em 0 você cai inconsciente.', details: 'Personagens com 0 PV ficam inconscientes e caídos; um aliado pode curar você com Poção de Cura ou Ambrosia.' },
      { key: 'estamina', term: 'Estamina', tooltip: 'Energia para poderes divinos e esforços especiais.', details: 'Poderes do seu pai olímpico gastam Estamina. Néctar recupera Estamina. Constituição aumenta o máximo.' },
      { key: 'restricao', term: 'Itens bloqueados', tooltip: 'Cadeado = sua classe ou atributos não permitem usar o item.', details: 'Cada classe domina certas armas e armaduras. Itens míticos podem exigir atributos mínimos, afinidade com um deus ou uma raça específica. Toque no item para ver o motivo.' },
    ],
  },
  {
    key: 'turno',
    title: 'Combate e turnos',
    icon: '⚔️',
    intro: 'No combate, todos agem em ordem de iniciativa. No seu turno você tem um orçamento de ações — como no Baldur\'s Gate 3.',
    terms: [
      { key: 'iniciativa', term: 'Iniciativa', tooltip: '1d20 + Destreza define a ordem dos turnos.', details: 'Quando o combate começa, todos rolam iniciativa. Quem tira mais age primeiro. A ordem aparece no topo da tela.' },
      { key: 'acao', term: 'Ação', tooltip: 'Uma por turno: atacar, Disparada, Desengajar, Esquivar ou poder divino.', details: 'Atacar: role o ataque contra a CA do alvo. Disparada: dobra seu movimento. Desengajar: sair de perto de inimigos sem levar ataque de oportunidade. Esquivar: ataques contra você têm desvantagem.' },
      { key: 'acao_bonus', term: 'Ação Bônus', tooltip: 'Uma por turno: empurrar ou usar uma poção.', details: 'Empurrar um inimigo adjacente pode jogá-lo na água, na lava ou num abismo! Usar consumíveis (Poção, Ambrosia, Néctar) também gasta a Ação Bônus.' },
      { key: 'movimento', term: 'Movimento', tooltip: 'Quantos quadrados você anda no turno (1 quadrado = 1,5 m).', details: 'Terreno difícil (água rasa, escombros, gelo, óleo) custa o dobro. Você pode dividir o movimento antes e depois da ação.' },
      { key: 'reacao', term: 'Reação e ataque de oportunidade', tooltip: 'Sair do alcance de um inimigo dá a ele um ataque grátis.', details: 'Cada criatura tem uma Reação por rodada. Se você se afasta de um inimigo sem usar Desengajar, ele pode te atacar.' },
      { key: 'vantagem', term: 'Vantagem / Desvantagem', tooltip: 'Role 2d20 e fique com o maior (vantagem) ou menor (desvantagem).', details: 'Atacar alguém caído de perto dá vantagem; atacar à distância com inimigo colado em você dá desvantagem. Uma vantagem e uma desvantagem se anulam.' },
      { key: 'critico', term: 'Acerto crítico', tooltip: '20 natural: acerto automático com dados de dano dobrados.', details: 'Atacar um inimigo inconsciente corpo a corpo também é crítico automático.' },
      { key: 'terreno_elevado', term: 'Terreno elevado', tooltip: '+2 para acertar quem está abaixo de você; −2 de baixo para cima.', details: 'Plataformas, paredes e muralhas dão vantagem tática. Procure as casas mais claras de pedra elevada.' },
    ],
  },
  {
    key: 'superficies',
    title: 'Superfícies e mapa destrutível',
    icon: '🔥',
    intro: 'O cenário reage! Elementos se combinam e quase tudo pode ser quebrado.',
    terms: [
      { key: 'fogo', term: 'Fogo', tooltip: 'Causa 1d4 de dano a quem entra ou começa o turno nele.', details: 'Queima árvores, pontes, portões e caixotes. Fogo em óleo ou veneno causa explosão!' },
      { key: 'agua', term: 'Água e Molhado', tooltip: 'Molhado: resistência a fogo, mas dano elétrico e de frio dobra.', details: 'Água apaga fogo (vira vapor). Um raio na água eletrifica toda a poça. Gelo congela a água e cria um chão escorregadio — até em rios profundos.' },
      { key: 'gelo_oleo', term: 'Gelo e Óleo', tooltip: 'Terreno difícil; teste de Destreza CD 10 ou cai.', details: 'Ao cair, seu movimento termina e você precisa de metade do movimento para levantar no próximo turno.' },
      { key: 'vapor', term: 'Vapor', tooltip: 'Bloqueia a linha de visão.', details: 'Use vapor para se esconder de arqueiros inimigos.' },
      { key: 'destruicao', term: 'Destruição', tooltip: 'Ataque paredes, colunas, árvores, pontes e barris.', details: 'Paredes viram escombros, árvores viram tocos, pontes desabam na água (com quem estiver em cima!). Barris de pólvora grega explodem em cadeia.' },
    ],
  },
  {
    key: 'divino',
    title: 'Pais olímpicos e afinidade',
    icon: '⚡',
    intro: 'Seu pai ou mãe divino concede uma bênção passiva e, às vezes, um poder elemental.',
    terms: [
      { key: 'afinidade', term: 'Afinidade divina', tooltip: '0 a 100: o quanto seu deus presta atenção em você.', details: 'O Mestre aumenta a afinidade quando você honra seu deus e reduz quando o ofende. Itens lendários exigem afinidade mínima (ex.: Arco de Apolo exige 30).' },
      { key: 'poder', term: 'Poder divino', tooltip: 'Gasta Ação + Estamina para lançar um elemento no mapa.', details: 'Zeus: relâmpago. Poseidon: onda. Hefesto: labareda. Ártemis: geada. Hades: chamas do Flegetonte. Hécate: névoa tóxica. Dionísio: vinho escorregadio. Combine com os colegas: Poseidon molha, Zeus eletrifica!' },
      { key: 'nao_reclamado', term: 'Não Reclamado', tooltip: 'Seu pai divino ainda não se revelou.', details: 'Ótimo para quem quer descobrir junto com a história. O Mestre pode revelar a divindade numa cena dramática.' },
    ],
  },
  {
    key: 'lore',
    title: 'Mitologia grega rápida',
    icon: '🏛️',
    intro: 'Tudo aqui vem dos mitos gregos antigos — histórias com mais de 2.500 anos.',
    terms: [
      { key: 'olimpo', term: 'Olimpo', tooltip: 'A montanha onde vivem os doze deuses principais.', details: 'Zeus governa do trono mais alto. Os deuses brigam, fazem alianças e às vezes têm filhos com mortais — os semideuses.' },
      { key: 'submundo', term: 'Submundo', tooltip: 'O reino de Hades, para onde vão as almas.', details: 'Cercado pelos rios Estige (o juramento inquebrável), Lete (o esquecimento) e Flegetonte (o fogo). Caronte cobra uma moeda para a travessia.' },
      { key: 'herois', term: 'Heróis', tooltip: 'Héracles, Perseu, Teseu, Atalanta, Jasão...', details: 'Cada herói enfrentou monstros com ajuda (e atrapalhação) dos deuses. Use as histórias deles como inspiração para o seu personagem.' },
      { key: 'monstros', term: 'Monstros', tooltip: 'Minotauro, Hidra, Quimera, Górgonas, Harpias...', details: 'Muitos monstros são filhos de Tifão e Equidna. Armas de bronze divino ferem monstros com mais facilidade (+dano contra monstros).' },
    ],
  },
];

export function findGuideTerm(key: string): GuideTerm | undefined {
  for (const s of GUIDE) {
    const t = s.terms.find((x) => x.key === key);
    if (t) return t;
  }
  return undefined;
}
