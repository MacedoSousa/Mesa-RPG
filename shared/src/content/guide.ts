/**
 * "Guia para Novatos" (aba 📘 Guia do jogador e página /#/guia) e textos dos tooltips (componente <Term>).
 * Cada termo tem: tooltip (1 linha), details (explicação), steps (passo a passo opcional) e example.
 */

export interface GuideTerm {
  key: string;
  term: string;
  tooltip: string;
  details: string;
  steps?: string[];
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
    key: 'comecar',
    title: 'Comece aqui: como se joga',
    icon: '🚀',
    intro: 'RPG de mesa é contar uma história em grupo. O Mestre descreve o mundo; você diz o que o seu herói faz; os dados decidem se dá certo quando há risco. Não existe "ganhar": a graça é viver a aventura junto.',
    terms: [
      {
        key: 'ciclo', term: 'O ciclo do jogo', tooltip: 'Mestre descreve → você decide → dados resolvem → Mestre narra o resultado.',
        details: 'Tudo no RPG gira em torno de quatro passos que se repetem a noite inteira. Você pode tentar QUALQUER coisa que faria sentido para o seu personagem — não existe só uma resposta certa.',
        steps: [
          'O Mestre descreve a cena ("Uma harpia mergulha do céu…").',
          'Você diz o que seu herói faz ("Me jogo atrás do caixote e atiro uma flecha!").',
          'Se o resultado for incerto, o Mestre pede uma rolagem (o app mostra um aviso no seu celular).',
          'O Mestre narra o que aconteceu, e a história segue.',
        ],
        example: 'Você não precisa saber regras para dizer "quero convencer o guarda a nos deixar passar". O Mestre pede um teste de Persuasão e o app soma tudo.',
      },
      {
        key: 'mestre', term: 'Mestre', tooltip: 'Quem narra a história, interpreta todos os outros personagens e controla os monstros.',
        details: 'O Mestre não é seu adversário: ele quer que a história seja incrível. Ele descreve lugares, faz as vozes dos NPCs (personagens do mundo), decide as consequências das ações e pode fazer rolagens secretas no PC dele.',
      },
      {
        key: 'npc', term: 'NPC', tooltip: 'Personagem não-jogador: todo mundo do mundo que não é um dos heróis.',
        details: 'Quíron, o Sr. D, o vendedor do posto e o próprio monstro são NPCs, interpretados pelo Mestre. Converse com eles! Muitos problemas se resolvem sem luta.',
      },
      {
        key: 'app', term: 'Sua tela no celular', tooltip: 'Barra de PV/Estamina no topo, mapa no meio, abas embaixo.',
        details: 'No topo: seu retrato, ❤️ PV, ⚡ Estamina, 🛡️ CA, ⭐ nível e, no combate, quanto resta de Ação, Bônus, Reação e Movimento. No meio: o mapa (arraste para olhar, pinça para zoom). Embaixo: ⚔️ Ações, 🎲 Dados, 🎒 Itens, 📜 Histórico e 📘 Guia. Palavras sublinhadas com pontinhos mostram uma explicação ao tocar.',
      },
      {
        key: 'sessao', term: 'Como é uma sessão', tooltip: 'Recapitulação → exploração e conversas → um ou dois combates → gancho para a próxima.',
        details: 'Uma noite típica dura 2 a 3 horas. Começa com o Mestre lembrando onde a história parou. Depois vocês exploram lugares, falam com NPCs, resolvem enigmas e, uma ou duas vezes, entram em combate. A sessão termina num momento de suspense. O Mestre salva a mesa e, na próxima vez, tudo continua exatamente de onde parou.',
      },
      {
        key: 'etiqueta', term: 'Combinados da mesa', tooltip: 'Respeite a vez dos outros, fale como seu personagem e use o "X" se algo incomodar.',
        details: 'Antes de começar, o grupo combina temas que não devem aparecer. Se uma cena ficar desconfortável, qualquer pessoa pode dizer "X" ou tocar no cartão X, e o Mestre muda a cena — sem precisar explicar. Dê espaço para todos brilharem e lembre: o objetivo é todo mundo se divertir.',
      },
    ],
  },
  {
    key: 'dados',
    title: 'Dados e testes',
    icon: '🎲',
    intro: 'Quando algo é arriscado, você rola 1d20 (um dado de 20 lados) e soma um bônus. Se o total for igual ou maior que o número-alvo, deu certo.',
    terms: [
      { key: 'd20', term: 'd20', tooltip: 'Dado de 20 lados — o dado mais importante do jogo.', details: 'Ataques, testes e resistências usam 1d20 + modificador. Tirar 20 no dado ("20 natural") é um sucesso crítico nos ataques; 1 natural é uma falha automática.', example: '1d20+5: role o d20 e some 5.' },
      { key: 'notacao', term: 'Notação de dados', tooltip: 'NdX+M: role N dados de X lados e some M.', details: '2d6+3 = role dois dados de 6 lados e some 3. "kh1" significa manter o maior (vantagem), "kl1" manter o menor (desvantagem). Os dados existentes: d4, d6, d8, d10, d12, d20 e d100.', example: '2d20kh1+4 é um ataque com vantagem e +4.' },
      {
        key: 'cd', term: 'CD (Classe de Dificuldade)', tooltip: 'O número que você precisa alcançar num teste.',
        details: 'O Mestre escolhe a CD pela dificuldade: 5 muito fácil, 10 fácil, 15 médio, 20 difícil, 25 muito difícil. Às vezes ele esconde a CD — você só descobre se deu certo.',
      },
      {
        key: 'teste_pedido', term: 'Teste pedido pelo Mestre', tooltip: 'Aparece um aviso amarelo no seu celular: toque em Rolar.',
        details: 'Quando o Mestre pede um teste (ex.: "Percepção CD 13"), surge um cartão no topo da sua tela. Toque em 🎲 Rolar (ou com vantagem/desvantagem, se o Mestre disser). O app rola 1d20, soma o atributo e o seu treino, e mostra SUCESSO ou FALHA para todos. Esse resultado vale de verdade na história.',
        steps: ['Leia o que o Mestre pediu no cartão amarelo.', 'Toque em 🎲 Rolar.', 'Veja o resultado no topo e no Histórico.', 'Diga como o seu herói faz aquilo — o Mestre narra o resto.'],
      },
      { key: 'rolagem_livre', term: 'Rolagem livre', tooltip: 'Na aba Dados você rola qualquer coisa, pública ou só para o Mestre.', details: 'Use para testes que o Mestre pedir de boca, dano de uma magia ou só pela diversão. O Mestre vê o total e pode usá-lo: por exemplo, aplicar o número como dano num monstro com um clique. Marque "🔒 Só eu e o Mestre" para rolagens secretas.' },
      { key: 'vantagem', term: 'Vantagem / Desvantagem', tooltip: 'Role 2d20 e fique com o maior (vantagem) ou menor (desvantagem).', details: 'Vantagem quando algo te ajuda: atacar alguém caído de perto, um amigo distraiu o monstro, você conhece o lugar. Desvantagem quando atrapalha: atirar com um inimigo colado em você, estar envenenado, lutar de olhos fechados. Uma vantagem e uma desvantagem se anulam.' },
      { key: 'inspiracao', term: 'Inspiração heroica', tooltip: 'Prêmio do Mestre por uma cena incrível: troque por vantagem numa rolagem.', details: 'Quando você interpreta muito bem, tem uma ideia genial ou faz algo heroico, o Mestre pode te dar inspiração. Avise na hora de rolar que vai usá-la.' },
    ],
  },
  {
    key: 'ficha',
    title: 'Sua ficha',
    icon: '📜',
    intro: 'A ficha descreve o que seu herói sabe fazer. O Mesa RPG calcula quase tudo para você — toque em "Ver ficha" na tela inicial.',
    terms: [
      { key: 'atributos', term: 'Atributos', tooltip: 'Força, Destreza, Constituição, Inteligência, Sabedoria e Carisma.', details: 'Vão de 1 a 20 (heróis começam entre 8 e 17). Na criação você distribui 27 pontos (point-buy): valores mais altos custam mais. Força = músculos; Destreza = agilidade e pontaria; Constituição = resistência e vida; Inteligência = raciocínio; Sabedoria = percepção e intuição; Carisma = presença e lábia.' },
      { key: 'modificador', term: 'Modificador', tooltip: '(atributo − 10) ÷ 2, arredondado para baixo.', details: 'É o número que entra nas rolagens. Atributo 8 = −1; 10 = +0; 12 = +1; 14 = +2; 16 = +3; 18 = +4; 20 = +5.' },
      { key: 'proficiencia', term: 'Bônus de Proficiência', tooltip: '+2 no nível 1: somado no que você treinou.', details: 'Soma em ataques com armas que sua classe domina, nas perícias treinadas e nas resistências da sua classe. Sobe para +3 no nível 5 e continua crescendo.' },
      { key: 'pericias', term: 'Perícias', tooltip: '18 habilidades (Percepção, Furtividade…) ligadas a um atributo.', details: 'Atletismo (FOR) — escalar, nadar, empurrar. Acrobacia (DES) — equilíbrio, cambalhotas. Furtividade (DES) — se esconder. Prestidigitação (DES) — truques de mão, fechaduras. Arcanismo (INT) — magia. História (INT) — fatos e mitos. Investigação (INT) — procurar pistas. Natureza (INT) — plantas e animais. Religião (INT) — deuses e rituais. Lidar com Animais (SAB) — acalmar bichos. Intuição (SAB) — perceber mentiras. Medicina (SAB) — primeiros socorros. Percepção (SAB) — notar coisas. Sobrevivência (SAB) — rastrear, se orientar. Atuação (CAR) — música, teatro. Enganação (CAR) — mentir. Intimidação (CAR) — assustar. Persuasão (CAR) — convencer.' },
      { key: 'resistencia', term: 'Teste de resistência', tooltip: 'Rolagem para EVITAR algo ruim: veneno, explosão, encanto.', details: 'O nome é o atributo: Resistência de Destreza para pular de uma explosão, de Constituição para aguentar veneno, de Sabedoria para resistir a ilusões. Cada classe é treinada em duas resistências.' },
      { key: 'ca', term: 'CA (Classe de Armadura)', tooltip: 'Quão difícil é acertar você.', details: 'Um ataque acerta se o total for maior ou igual à sua CA. Armaduras, escudos e Destreza aumentam a CA. Típico: 12 (sem armadura ágil) a 18 (armadura pesada + escudo).' },
      { key: 'pv', term: 'PV (Pontos de Vida)', tooltip: 'Sua vida. Em 0 você cai inconsciente.', details: 'O dano tira PV na hora (o app desconta sozinho e avisa no seu celular). Poções, Ambrosia, magias de cura e descansos devolvem PV. Cada nível novo aumenta seu PV máximo.' },
      { key: 'estamina', term: 'Estamina', tooltip: 'Energia para poderes divinos.', details: 'Poderes do seu pai olímpico gastam Estamina. Néctar e descansos recuperam. Constituição aumenta o máximo.' },
      { key: 'restricao', term: 'Itens bloqueados', tooltip: 'Cadeado = sua classe ou atributos não permitem usar o item.', details: 'Cada classe domina certas armas e armaduras. Itens míticos podem exigir atributo mínimo, afinidade com um deus ou uma raça específica. Toque no item para ver o motivo — às vezes basta subir de nível ou agradar o seu deus.' },
    ],
  },
  {
    key: 'turno',
    title: 'Combate passo a passo',
    icon: '⚔️',
    intro: 'No combate, todos agem em ordem de iniciativa. No seu turno você tem um "orçamento": um movimento, uma ação, uma ação bônus e, durante a rodada, uma reação.',
    terms: [
      {
        key: 'combate', term: 'Seu turno, na prática', tooltip: 'Mova, faça sua ação, use a ação bônus se quiser, toque em Encerrar turno.',
        details: 'A barra do topo pisca "⚔️ É O SEU TURNO!". As casas azuis mostram até onde você anda. Você pode andar um pouco, atacar e andar o resto.',
        steps: [
          'Olhe o mapa: onde estão os inimigos, aliados, barris, água, terreno alto?',
          'Mover: toque numa casa azul (terreno difícil custa o dobro).',
          'Ação: na aba ⚔️ Ações escolha Atacar (toque no alvo vermelho), Poder divino, Disparada, Desengajar, Esquivar, Golpear cenário ou Abrir baú.',
          'Ação bônus (opcional): Empurrar um inimigo ou beber uma poção (aba 🎒 Itens).',
          'Toque em ⏭️ Encerrar turno.',
        ],
      },
      { key: 'iniciativa', term: 'Iniciativa', tooltip: '1d20 + Destreza define a ordem dos turnos.', details: 'Quando o combate começa, o app rola a iniciativa de todos. Quem tira mais age primeiro. A rodada termina quando todos agiram; aí começa a próxima.' },
      { key: 'acao', term: 'Ação', tooltip: 'Uma por turno: Atacar, Poder divino, Disparada, Desengajar, Esquivar, Golpear cenário, Abrir baú.', details: 'Atacar: role contra a CA do alvo. Poder divino: lança o elemento do seu deus (gasta Estamina). Disparada: dobra o movimento. Desengajar: sair de perto dos inimigos sem levar ataque de oportunidade. Esquivar: ataques contra você têm desvantagem até seu próximo turno. Golpear cenário: quebrar parede, árvore, ponte, barril. Abrir baú: precisa estar ao lado.' },
      { key: 'acao_bonus', term: 'Ação Bônus', tooltip: 'Uma por turno: empurrar ou usar uma poção.', details: 'Empurrar um inimigo adjacente (Atletismo contra o inimigo) pode jogá-lo na água, na lava ou num abismo! Beber Poção, Ambrosia ou Néctar também gasta a ação bônus — e pode ser em um aliado ao seu lado.' },
      { key: 'movimento', term: 'Movimento', tooltip: 'Quantos quadrados você anda (1 quadrado = 1,5 m).', details: 'Humanos andam 6 quadrados por turno. Água rasa, escombros, gelo e óleo custam o dobro. Paredes, árvores e água profunda bloqueiam — mas água congelada vira caminho!' },
      { key: 'reacao', term: 'Reação e ataque de oportunidade', tooltip: 'Sair do alcance de um inimigo dá a ele um ataque grátis.', details: 'Cada criatura tem uma reação por rodada. Se você se afastar de um inimigo sem usar Desengajar, ele te ataca na hora — e você também ganha esse ataque grátis quando um monstro foge de você (o app faz sozinho).' },
      { key: 'ataque', term: 'Como funciona um ataque', tooltip: '1d20 + bônus ≥ CA do alvo = acertou; aí rola o dano.', details: 'O app rola o ataque, compara com a CA, rola o dano e desconta do PV do alvo. Armas de bronze celestial causam dano extra em monstros. Você vê o número flutuando no mapa e a linha no Histórico.' },
      { key: 'critico', term: 'Acerto crítico', tooltip: '20 natural: acerto automático com dados de dano dobrados.', details: 'Atacar corpo a corpo um inimigo inconsciente também é crítico automático. E 1 natural sempre erra.' },
      { key: 'terreno_elevado', term: 'Terreno elevado', tooltip: '+2 para acertar quem está abaixo; −2 de baixo para cima.', details: 'Plataformas, colinas e muralhas dão vantagem tática. Arqueiros adoram ficar em cima.' },
      { key: 'cobertura', term: 'Linha de visão', tooltip: 'Paredes, árvores e vapor bloqueiam ataques à distância.', details: 'Se não dá para ver o alvo, não dá para acertar de longe. Use paredes para se proteger de arqueiros — ou crie vapor (fogo + água) como cortina.' },
    ],
  },
  {
    key: 'morte',
    title: 'Ferimentos, morte e descanso',
    icon: '💀',
    intro: 'Heróis raramente morrem de uma vez. Com 0 PV você cai e passa a lutar pela vida a cada turno.',
    terms: [
      {
        key: 'morte', term: 'Salvaguardas contra a morte', tooltip: 'Com 0 PV, no seu turno o app rola 1d20: 10+ é sucesso, menos é falha.',
        details: 'Três sucessos = você fica estável (inconsciente, mas fora de perigo). Três falhas = morte. Tirar 1 conta como duas falhas; tirar 20 te levanta com 1 PV! Levar dano caído conta como uma falha. Qualquer cura te acorda na hora — por isso, ajude o amigo caído com uma poção.',
      },
      { key: 'inconsciente', term: 'Inconsciente', tooltip: 'Caído com 0 PV: não age e ataques de perto contra você são críticos.', details: 'Aliados podem te dar uma poção (ação bônus estando ao seu lado) ou o Mestre pode te curar de outro jeito.' },
      { key: 'descanso', term: 'Descanso curto e longo', tooltip: 'Curto (1 hora): recupera parte do PV. Longo (uma noite): recupera tudo.', details: 'O Mestre aplica o descanso para o grupo inteiro pelo app. No curto, cada herói recupera ¼ do PV máximo e metade da Estamina. No longo, tudo volta ao máximo e as condições somem. Cuidado: descansar na estrada gasta tempo — e às vezes o tempo é o inimigo.' },
    ],
  },
  {
    key: 'progresso',
    title: 'XP, níveis, tesouros e quests',
    icon: '⭐',
    intro: 'Cada monstro derrotado e cada missão cumprida dá experiência (XP). Com XP suficiente seu herói sobe de nível e fica mais forte.',
    terms: [
      { key: 'xp', term: 'Experiência (XP)', tooltip: 'Monstros derrotados e quests concluídas dão XP para todos os heróis.', details: 'O XP de um monstro é dividido igualmente entre os heróis na mesa. Quests dão XP para cada um. O Mestre também pode dar XP de bônus por boas ideias e boa interpretação. Veja seu XP na ficha.' },
      { key: 'nivel', term: 'Subir de nível', tooltip: '300 XP → nível 2; 900 → 3; 2.700 → 4; 6.500 → 5.', details: 'Quando chega o XP necessário, o app avisa "🆙 sobe para o NÍVEL X": seu PV máximo aumenta (e você ganha a diferença na hora), a Estamina também, e no nível 5 seu bônus de proficiência vira +3.' },
      { key: 'bau', term: 'Baús de tesouro', tooltip: 'Fique ao lado e use "🧰 Abrir baú". Trancado? Você tenta abrir ou arrombar.', details: 'O conteúdo é secreto até alguém abrir. Se estiver trancado, o app usa o melhor entre Prestidigitação (abrir a fechadura) e Atletismo (arrombar). Não abriu? Tente de novo — mas no combate cada tentativa gasta sua ação. Itens e dracmas vão direto para o seu inventário.' },
      { key: 'dracmas', term: 'Dracmas', tooltip: 'A moeda dos deuses e monstros.', details: 'Pagam o barqueiro dos mortos, compram informação e favores. Ficam no seu inventário; o Mestre pode cobrar (por exemplo, a travessia de um rio).' },
      { key: 'quests', term: 'Quests e side quests', tooltip: 'Missões principais movem a história; side quests são opcionais e dão XP extra.', details: 'Algumas têm relógio (⏳ rodadas ou minutos) — se o tempo acabar, algo acontece. Quando o Mestre marca uma quest como concluída, a recompensa cai sozinha para todos. Acompanhe no Histórico.' },
    ],
  },
  {
    key: 'superficies',
    title: 'Superfícies e mapa destrutível',
    icon: '🔥',
    intro: 'O cenário reage! Elementos se combinam e quase tudo pode ser quebrado — use isso a seu favor.',
    terms: [
      { key: 'fogo', term: 'Fogo', tooltip: 'Causa 1d4 de dano a quem entra ou começa o turno nele.', details: 'Queima árvores, pontes, portões e caixotes. Fogo em óleo ou veneno causa explosão!' },
      { key: 'agua', term: 'Água e Molhado', tooltip: 'Molhado: resistência a fogo, mas dano elétrico e de frio dobra.', details: 'Água apaga fogo (vira vapor). Um raio na água eletrifica a poça inteira. Gelo congela a água e cria um chão escorregadio — até em rios profundos.' },
      { key: 'gelo_oleo', term: 'Gelo e Óleo', tooltip: 'Terreno difícil; teste de Destreza CD 10 ou cai.', details: 'Ao cair, seu movimento termina e você precisa de metade do movimento para levantar no próximo turno.' },
      { key: 'vapor', term: 'Vapor', tooltip: 'Bloqueia a linha de visão.', details: 'Use vapor para se esconder de arqueiros inimigos.' },
      { key: 'destruicao', term: 'Destruição', tooltip: 'Ataque paredes, colunas, árvores, pontes e barris.', details: 'Paredes viram escombros, árvores viram tocos, pontes desabam na água (com quem estiver em cima!). Barris de pólvora grega explodem em cadeia. Baús não quebram — só abrem.' },
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
      { key: 'submundo', term: 'Submundo', tooltip: 'O reino de Hades, para onde vão as almas.', details: 'Cercado pelos rios Estige (o juramento inquebrável), Lete (o esquecimento) e Flegetonte (o fogo). Caronte cobra uma moeda para a travessia; Cérbero, o cão de três cabeças, guarda o portão.' },
      { key: 'titas', term: 'Titãs', tooltip: 'Os pais dos deuses, derrotados e presos no Tártaro.', details: 'Cronos, o rei dos Titãs, devorava os próprios filhos até Zeus libertá-los. Dizem que ele ainda sonha em voltar.' },
      { key: 'herois', term: 'Heróis', tooltip: 'Héracles, Perseu, Teseu, Atalanta, Jasão...', details: 'Cada herói enfrentou monstros com ajuda (e atrapalhação) dos deuses. Perseu venceu a Medusa usando um escudo como espelho; Teseu derrotou o Minotauro no Labirinto.' },
      { key: 'monstros', term: 'Monstros', tooltip: 'Minotauro, Hidra, Quimera, Górgonas, Harpias...', details: 'Muitos são filhos de Tifão e Equidna. Armas de bronze divino ferem monstros com mais facilidade (+dano contra monstros).' },
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
