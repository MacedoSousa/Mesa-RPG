import type { LootEntry, MapMood, ObjectType } from '../engine/types';
import type { MapKind } from '../engine/mapgen';
import type { LootTier } from './loot';

/**
 * Cenas prontas da aventura "O Ladrão de Raios" (adaptação livre).
 * Carregar uma cena monta o mapa, posiciona monstros e baús (à mostra ou escondidos),
 * cria as quests (obrigatórias e opcionais) e entrega ao Mestre o roteiro da cena:
 * texto para ler, objetivo, regra que ela ensina e o que pode / não pode.
 *
 * Posições em fração do mapa (0–1): funcionam em mapas gerados de qualquer tamanho.
 * Se a casa estiver ocupada (parede, árvore, água), o jogo usa a casa livre mais próxima.
 */

export interface ScenePoint { fx: number; fy: number }
export interface SceneMonster extends ScenePoint { key: string; hidden?: boolean; name?: string; note?: string }
export interface SceneChest extends ScenePoint {
  hidden?: boolean;
  loot?: LootEntry[];
  dracmas?: number;
  tier?: LootTier;
  lockDc?: number;
  /** Para o Mestre: como os heróis acham o baú escondido. */
  note?: string;
}
export interface SceneObject extends ScenePoint { type: ObjectType }
export interface SceneQuest {
  title: string;
  description: string;
  required: boolean;
  hidden?: boolean;
  target?: number;
  rewardXp: number;
  rewardDracmas?: number;
  rewardItems?: LootEntry[];
}
export interface SceneGmNotes {
  /** Regra do jogo que a cena ensina (primeira mesa). */
  regra: string;
  pode: string[];
  naoPode: string[];
  dicas: string[];
}
export interface Scene {
  key: string;
  chapter: number;
  title: string;
  map: { generate: { kind: MapKind; width: number; height: number; seed: string } } | { preset: string };
  mood?: MapMood;
  /** Onde os heróis começam. */
  start: ScenePoint;
  goal: string;
  readAloud: string;
  monsters: SceneMonster[];
  chests: SceneChest[];
  objects?: SceneObject[];
  quests: SceneQuest[];
  gm: SceneGmNotes;
  /** O que fazer quando a cena acabar. */
  next: string;
}

const L = (itemKey: string, quantity = 1): LootEntry => ({ itemKey, quantity });

export const SCENES: Scene[] = [
  // ─────────────────────────────── Capítulo 1 ───────────────────────────────
  {
    key: 'c1_fuga', chapter: 1, title: 'Fuga na tempestade',
    map: { generate: { kind: 'floresta', width: 24, height: 16, seed: 'tempestade' } }, mood: 'noite',
    start: { fx: 0.08, fy: 0.85 },
    goal: 'Chegar ao pinheiro no alto da colina (canto oposto do mapa) antes do Minotauro. É FUGA, não luta.',
    readAloud: 'A chuva bate tão forte no teto da van que parece granizo. Um relâmpago ilumina a estrada e, por um segundo, vocês veem algo enorme correndo atrás de vocês, com chifres. A van derrapa no barro e para atravessada. Lá em cima da colina, um pinheiro solitário balança no vento. Alguém grita: — Corram até o pinheiro! Lá ele não entra! O que vocês fazem?',
    monsters: [{ key: 'minotauro', fx: 0.2, fy: 0.55, note: 'Começa perto dos heróis. Use "Agir sozinho" para ele perseguir o mais próximo.' }],
    chests: [
      { fx: 0.55, fy: 0.45, loot: [L('pocao_cura', 2)], dracmas: 5, note: 'Mochila caída no caminho (visível): recompensa quem arriscar o desvio.' },
      { fx: 0.85, fy: 0.3, hidden: true, loot: [L('espada_curta+1')], note: 'Escondido no oco de uma árvore. Revele se alguém passar um teste de Percepção 13 perto dali.' },
    ],
    objects: [{ fx: 0.4, fy: 0.7, type: 'caixote' }, { fx: 0.62, fy: 0.62, type: 'barril_agua' }],
    quests: [
      { title: 'Chegar ao pinheiro', description: 'Todos os heróis dentro da barreira mágica do acampamento.', required: true, rewardXp: 100 },
      { title: 'Ninguém fica para trás', description: 'Ajudar um herói caído a chegar ao pinheiro (pode carregar ou curar).', required: false, rewardXp: 50 },
    ],
    gm: {
      regra: 'Iniciativa, movimento e a ação Disparada (dobra o movimento). Ensine que fugir também é uma escolha.',
      pode: [
        'Deixar os heróis usarem o terreno: empurrar o barril de água para escorregar o Minotauro, se esconder atrás de árvores.',
        'Dar vantagem a quem tiver uma ideia criativa (ex.: gritar para distrair o monstro).',
        'Encerrar a cena assim que todos passarem do pinheiro: o Minotauro bate na barreira invisível e foge.',
      ],
      naoPode: [
        'Matar um herói aqui: se alguém chegar a 0 PV, Grover (ou outro campista) aparece e arrasta o herói para dentro.',
        'Transformar em luta "até o fim": o Minotauro é forte demais para o nível 1 de propósito.',
      ],
      dicas: [
        'Comece o combate já com o Minotauro a 5–6 casas: a tensão vem da distância diminuindo.',
        'Descreva o chão enlameado e os relâmpagos. Relâmpago é a deixa para filhos de Zeus.',
        'Se a fuga ficar fácil demais, o Minotauro dá uma investida (anda o dobro) uma única vez.',
      ],
    },
    next: 'Carregue "Casa Grande e o Acampamento".',
  },
  {
    key: 'c1_acampamento', chapter: 1, title: 'Casa Grande e o Acampamento',
    map: { preset: 'acampamento' }, mood: 'dia',
    start: { fx: 0.5, fy: 0.85 },
    goal: 'Conhecer Quíron, os chalés e outros campistas. No fim, um Cão do Submundo ataca durante o treino de Captura da Bandeira.',
    readAloud: 'Quando vocês acordam, o sol entra por uma janela de madeira. Um homem de barba castanha, numa cadeira de rodas, sorri: — Bem-vindos ao Acampamento Meio-Sangue. Vocês têm muitas perguntas, e eu tenho algumas respostas. Lá fora, alguém pratica arco e flecha, um grupo canta em volta de uma fogueira e, ao longe, um muro de escalada solta lava de verdade.',
    monsters: [
      { key: 'cao_infernal', fx: 0.15, fy: 0.2, hidden: true, note: 'Escondido na floresta. Revele no fim do treino de Captura da Bandeira.' },
    ],
    chests: [
      { fx: 0.75, fy: 0.3, lockDc: 12, loot: [L('espada_bronze_celestial'), L('escudo_bronze'), L('pocao_cura', 2)], dracmas: 15, note: 'Arsenal do acampamento (visível, trancado): Quíron entrega a chave se pedirem com educação.' },
      { fx: 0.3, fy: 0.15, hidden: true, tier: 'comum', note: 'Tesouro da Captura da Bandeira: quem achar a bandeira inimiga (Investigação 13) revela este baú.' },
    ],
    quests: [
      { title: 'Falar com Quíron', description: 'Entender onde estão e por que monstros os perseguem.', required: true, rewardXp: 50 },
      { title: 'Vencer a Captura da Bandeira', description: 'Pegar a bandeira do outro time e trazer para o seu lado.', required: false, rewardXp: 100, rewardDracmas: 10 },
      { title: 'Sobreviver ao Cão do Submundo', description: 'Derrotar ou espantar o monstro que invadiu o acampamento.', required: true, rewardXp: 150 },
    ],
    gm: {
      regra: 'Testes de perícia com CD (Persuasão, Atletismo) e, no fim, o primeiro combate de verdade: ataque, CA e dano.',
      pode: [
        'Pedir testes pelo painel 🎯 Testes: Persuasão 12 com Quíron, Atletismo 13 no muro de escalada.',
        'Revelar o pai olímpico de alguém no fim do capítulo (o símbolo aparece sobre a cabeça).',
        'Dar o baú do arsenal de presente: equipamento ajuda novatos.',
      ],
      naoPode: [
        'Deixar o Cão do Submundo atacar no começo: primeiro deixe todos explorarem e conversarem.',
        'Responder tudo de uma vez: Quíron explica aos poucos, guarde mistérios.',
      ],
      dicas: [
        'Cada jogador escolhe uma atividade (arco, canoa, escalada) e faz um teste. Sucesso = um elogio de um campista.',
        'Interprete Luke como simpático e prestativo: ele é importante mais tarde.',
        'Quando revelar o Cão, peça iniciativa (⚔️ Combate → Iniciar combate).',
      ],
    },
    next: 'Leia a profecia (roteiro do capítulo) e carregue "As Fúrias no ônibus".',
  },
  // ─────────────────────────────── Capítulo 2 ───────────────────────────────
  {
    key: 'c2_furias', chapter: 2, title: 'As Fúrias na estrada',
    map: { generate: { kind: 'estrada', width: 22, height: 14, seed: 'onibus' } }, mood: 'dia',
    start: { fx: 0.45, fy: 0.5 },
    goal: 'Sobreviver ao ataque das Fúrias que fingiam ser passageiras e fugir do ônibus.',
    readAloud: 'O ônibus para no acostamento, o motor tossindo fumaça. Três senhoras de bolsa no colo, que vinham tricotando desde Nova York, se levantam ao mesmo tempo. As bolsas caem. Das costas delas, asas de couro se abrem e rasgam os casacos. — Onde está? — sibila a primeira. — Onde está o que foi roubado?',
    monsters: [
      { key: 'erinia', fx: 0.55, fy: 0.45, name: 'Fúria 1' },
      { key: 'erinia', fx: 0.6, fy: 0.55, name: 'Fúria 2', hidden: true, note: 'Escondida: revele na segunda rodada, mergulhando do céu.' },
    ],
    chests: [
      { fx: 0.85, fy: 0.25, loot: [L('nectar'), L('arco_curto')], dracmas: 10, note: 'Bagagem do ônibus (visível).' },
      { fx: 0.15, fy: 0.2, hidden: true, tier: 'comum', note: 'Lanchonete abandonada na beira da estrada: revele se alguém procurar abrigo ali.' },
    ],
    objects: [{ fx: 0.5, fy: 0.3, type: 'barril_oleo' }, { fx: 0.35, fy: 0.62, type: 'caixote' }],
    quests: [
      { title: 'Escapar das Fúrias', description: 'Derrotar as Fúrias ou fugir para a floresta.', required: true, rewardXp: 150 },
      { title: 'Salvar os passageiros', description: 'Proteger o motorista e os mortais (ninguém ferido).', required: false, rewardXp: 75 },
    ],
    gm: {
      regra: 'Ação bônus e reação (ataque de oportunidade quando alguém foge de perto de um inimigo).',
      pode: [
        'Usar o barril de óleo: fogo + óleo explode (ótimo para quem tem poder de fogo).',
        'Fazer as Fúrias voarem: elas atacam e recuam, deixando os heróis frustrados mas não em perigo de morte.',
      ],
      naoPode: [
        'Usar as duas Fúrias juntas se o grupo tiver 2 heróis ou menos: uma basta.',
        'Esquecer as reações: lembre os jogadores quando o inimigo foge de perto.',
      ],
      dicas: [
        'As Fúrias querem "o que foi roubado" (o raio): é a primeira pista de que alguém acha que os heróis são os ladrões.',
        'Se o grupo estiver mal, o ônibus explode atrás deles (fogo no mapa) e as Fúrias perdem a pista.',
      ],
    },
    next: 'Carregue "O Empório de Estátuas".',
  },
  {
    key: 'c2_medusa', chapter: 2, title: 'O Empório de Estátuas',
    map: { generate: { kind: 'interior', width: 20, height: 14, seed: 'tia-m' } }, mood: 'dia',
    start: { fx: 0.5, fy: 0.9 },
    goal: 'Descobrir que a simpática "Tia M." é a Medusa e vencê-la sem olhar nos olhos dela.',
    readAloud: 'O pátio está cheio de estátuas de cimento: um sátiro de olhar assustado, uma moça com as mãos na frente do rosto, um menino que parece querer correr. Cheira a hambúrguer. Uma voz doce, por trás de um véu preto, convida: — Entrem, queridos. Estão com fome? A tia faz um lanche para vocês.',
    monsters: [{ key: 'gorgona', fx: 0.5, fy: 0.3, name: 'Tia M.', note: 'Visível, mas com véu. Só tire o véu (descrição) quando alguém desconfiar.' }],
    chests: [
      { fx: 0.2, fy: 0.25, loot: [L('nectar', 2), L('ambrosia')], dracmas: 30, note: 'Cozinha da lanchonete (visível).' },
      { fx: 0.85, fy: 0.2, hidden: true, lockDc: 13, loot: [L('escudo_bronze~do_guardiao')], note: 'Cofre atrás de uma estátua: revele com Investigação 14. Escudo espelhado = seguro contra o olhar.' },
    ],
    objects: [{ fx: 0.3, fy: 0.5, type: 'estatua' }, { fx: 0.7, fy: 0.5, type: 'estatua' }, { fx: 0.5, fy: 0.62, type: 'estatua' }],
    quests: [
      { title: 'Vencer a Medusa', description: 'Derrotá-la usando reflexos ou de olhos fechados.', required: true, rewardXp: 300 },
      { title: 'Desconfiar a tempo', description: 'Perceber que as estátuas são pessoas antes de comer o lanche (Intuição 13).', required: false, rewardXp: 75 },
      { title: 'A cabeça como prova', description: 'Mandar a prova para o Olimpo (Hermes leva por 1 dracma).', required: false, hidden: true, rewardXp: 50 },
    ],
    gm: {
      regra: 'Vantagem e desvantagem: lutar de olhos fechados ou pelo reflexo dá desvantagem, mas evita virar pedra.',
      pode: [
        'Pedir Resistência de CON 14 a quem olhar para ela: falha = condição Atordoado por 1 turno (não vira estátua no nível 2).',
        'Dar vantagem a quem usar o escudo espelhado do cofre.',
      ],
      naoPode: [
        'Transformar herói em pedra de vez: no máximo atordoado, a mesa é para aprender.',
        'Revelar a Medusa logo de cara: deixe os jogadores desconfiarem sozinhos.',
      ],
      dicas: [
        'Descreva as estátuas com detalhes humanos: medo no rosto, mochilas de escola.',
        'Ela é educada e cheia de "queridos": o contraste dá medo.',
      ],
    },
    next: 'Capítulo 3: carregue "A armadilha do parque aquático".',
  },
  // ─────────────────────────────── Capítulo 3 ───────────────────────────────
  {
    key: 'c3_parque', chapter: 3, title: 'A armadilha do parque aquático',
    map: { generate: { kind: 'rio', width: 22, height: 16, seed: 'hefesto' } }, mood: 'dia',
    start: { fx: 0.1, fy: 0.5 },
    goal: 'Pegar o escudo de Ares no parque abandonado sem morrer na armadilha de Hefesto.',
    readAloud: 'O parque aquático está fechado há anos: toboáguas rachados, piscinas verdes de limo, um cheiro de ferrugem. No meio, num pedestal, um escudo de bronze brilha como se alguém o polisse todo dia. É bonito demais para estar ali. Quando o primeiro de vocês pisa na grama, uma engrenagem range em algum lugar.',
    monsters: [
      { key: 'aranha_automato', fx: 0.5, fy: 0.3, hidden: true, note: 'Saem das grades ao tocar no escudo.' },
      { key: 'aranha_automato', fx: 0.55, fy: 0.7, hidden: true },
      { key: 'aranha_automato', fx: 0.7, fy: 0.5, hidden: true },
    ],
    chests: [
      { fx: 0.6, fy: 0.5, lockDc: 14, loot: [L('escudo_bronze+1')], note: 'O "escudo de Ares" no pedestal (visível, trancado). Abrir dispara a armadilha: revele as aranhas.' },
      { fx: 0.9, fy: 0.15, hidden: true, loot: [L('peitoral_bronze'), L('pocao_cura', 2), L('nectar')], dracmas: 40, note: 'Cabine do salva-vidas: revele com Percepção 13.' },
    ],
    quests: [
      { title: 'Recuperar o escudo de Ares', description: 'Abrir o pedestal e sair do parque com o escudo.', required: true, rewardXp: 250 },
      { title: 'Desarmar a armadilha', description: 'Investigação 14 + Prestidigitação 13 antes do alarme encher (4 segmentos).', required: false, target: 2, rewardXp: 100 },
    ],
    gm: {
      regra: 'Relógio de cena: a cada rodada a água sobe (marque o progresso da quest). Cooperação: um investiga, outro desarma.',
      pode: [
        'Encher as piscinas de água (🗺️ Mapa → elemento água) a cada rodada: aranhas na água ficam lentas.',
        'Raio na água eletrifica tudo: ótimo para filhos de Zeus, perigoso para quem estiver molhado.',
      ],
      naoPode: [
        'Soltar todas as aranhas de uma vez num grupo pequeno: 1 por herói é suficiente.',
        'Esquecer que Ares mentiu: o escudo é uma isca de Hefesto para Ares.',
      ],
      dicas: [
        'Faça barulhos mecânicos crescentes: tic, tic, TIC.',
        'Se sair muito difícil, a água derruba as aranhas (elas enferrujam e param).',
      ],
    },
    next: 'Carregue "O Cassino Lótus".',
  },
  {
    key: 'c3_lotus', chapter: 3, title: 'O Cassino Lótus',
    map: { generate: { kind: 'interior', width: 22, height: 14, seed: 'lotus' } }, mood: 'noite',
    start: { fx: 0.5, fy: 0.9 },
    goal: 'Perceber a armadilha do tempo e sair do cassino antes que os dias passem.',
    readAloud: 'Lá dentro tem videogames de realidade virtual, uma piscina com toboágua dentro do prédio, comida que aparece antes de vocês pedirem e flores de lótus brancas em todas as mesas. Um funcionário sorridente entrega cartões dourados: — Crédito infinito, por conta da casa! Ninguém olha para o relógio. Aliás, não há relógio em parede nenhuma.',
    monsters: [],
    chests: [
      { fx: 0.2, fy: 0.3, tier: 'incomum', note: 'Prêmio de um jogo (visível): ganhar exige um teste de Destreza 13, mas cada jogo custa +1 no relógio.' },
      { fx: 0.85, fy: 0.25, hidden: true, loot: [L('ambrosia', 2)], dracmas: 50, note: 'Sala do gerente: revele se alguém procurar a saída de serviço.' },
    ],
    quests: [
      { title: 'Sair do Cassino Lótus', description: 'Convencer todos a ir embora (Persuasão ou Intimidação 12).', required: true, rewardXp: 200 },
      { title: 'O relógio do Lótus', description: 'Cada diversão aceita avança 1 segmento. 6 segmentos = 5 dias perdidos.', required: true, target: 6, hidden: true, rewardXp: 0 },
    ],
    gm: {
      regra: 'Testes de resistência (SAB 13 para não comer o lótus) e consequências fora do combate.',
      pode: [
        'Oferecer diversões a cada jogador: aceitar avança o relógio (marque progresso na quest escondida).',
        'Dar uma recompensa real (o prêmio do baú) para tornar a tentação verdadeira.',
      ],
      naoPode: [
        'Prender o grupo para sempre: se o relógio encher, eles saem mas perderam dias (pressão no prazo do solstício).',
        'Contar a eles que é uma armadilha: deixe alguém desconfiar.',
      ],
      dicas: [
        'Fale de músicas e jogos que já saíram de moda como se fossem novidade: é a pista do tempo parado.',
        'Uma cena sem monstros também é aventura: interpretação e decisões.',
      ],
    },
    next: 'Capítulo 4: carregue "O Palácio das Camas".',
  },
  // ─────────────────────────────── Capítulo 4 ───────────────────────────────
  {
    key: 'c4_procrustes', chapter: 4, title: 'O Palácio das Camas',
    map: { generate: { kind: 'interior', width: 20, height: 14, seed: 'camas' } }, mood: 'noite',
    start: { fx: 0.5, fy: 0.9 },
    goal: 'Escapar do dono da loja, Procrustes, que "ajusta" os clientes ao tamanho das camas.',
    readAloud: 'A loja de colchões é enorme e cheira a perfume barato. Um homem altíssimo, de terno brilhante e sorriso branco demais, abre os braços: — Bem-vindos ao Palácio das Camas! Experimentem, experimentem! Esta aqui é sob medida… para qualquer um. Nas paredes, correias de couro e uma alavanca com uma placa: AJUSTE.',
    monsters: [{ key: 'procrustes', fx: 0.5, fy: 0.4, note: 'Visível e simpático. Ele só ataca se alguém deitar na cama ou desconfiar alto.' }],
    chests: [
      { fx: 0.8, fy: 0.3, lockDc: 14, loot: [L('pocao_cura', 3), L('ambrosia', 2), L('martelo_guerra+1')], dracmas: 60, note: 'Escritório (visível, trancado).' },
      { fx: 0.15, fy: 0.25, hidden: true, tier: 'incomum', note: 'Pertences de vítimas antigas debaixo de uma cama: revele com Investigação 13.' },
    ],
    quests: [
      { title: 'Vencer Procrustes', description: 'Derrotá-lo, ou enganá-lo para deitar na própria cama (Enganação 15 / Persuasão 13).', required: true, rewardXp: 300 },
      { title: 'Usar o truque dele contra ele', description: 'Vencer sem lutar, só na conversa.', required: false, rewardXp: 150 },
    ],
    gm: {
      regra: 'Vários caminhos para resolver: combate, conversa ou enganação. Todos valem XP.',
      pode: [
        'Recompensar a ideia de enganá-lo com o XP da quest opcional (dá mais XP que lutar).',
        'Usar a correia como ataque especial dele: Atletismo 13 para se soltar.',
      ],
      naoPode: [
        'Decidir pelo grupo que só lutar resolve.',
        'Descrever violência com detalhes: deixe a cama assustadora, não sangrenta.',
      ],
      dicas: [
        'Procrustes adora elogios: quem elogiar as camas ganha vantagem em Enganação.',
      ],
    },
    next: 'Carregue "Cérbero nos portões".',
  },
  {
    key: 'c4_cerbero', chapter: 4, title: 'Cérbero nos portões',
    map: { preset: 'submundo' }, mood: 'submundo',
    start: { fx: 0.5, fy: 0.9 },
    goal: 'Passar pelo cão de três cabeças sem lutar: brincar, cantar, distrair ou passar escondido.',
    readAloud: 'Na margem do rio escuro, um portão de obsidiana enorme. Na frente dele, deitado como uma montanha de pelo preto, um cão de três cabeças, cada uma do tamanho de um carro, fareja o ar. As três param ao mesmo tempo, viradas para vocês. Uma das línguas pende para o lado, como a de um filhote esperando a bolinha.',
    monsters: [{ key: 'cerbero', fx: 0.5, fy: 0.25, note: 'NÃO é luta: com nível 4 o grupo não vence. Ele brinca se alguém jogar algo (Lidar com Animais 14).' }],
    chests: [
      { fx: 0.15, fy: 0.5, loot: [L('nectar', 2)], dracmas: 20, note: 'Oferendas deixadas por almas (visível).' },
      { fx: 0.85, fy: 0.45, hidden: true, loot: [L('arco_de_apolo')], note: 'Arma de um herói antigo nos Campos de Asfódelos: revele com Percepção 15 depois de passar pelo Cérbero.' },
    ],
    quests: [
      { title: 'Passar por Cérbero', description: 'Distrair, acalmar ou passar escondido (Furtividade em grupo 15).', required: true, rewardXp: 300 },
      { title: 'Fazer amizade com o cão', description: 'Brincar com Cérbero até ele deitar de barriga para cima.', required: false, rewardXp: 150 },
    ],
    gm: {
      regra: 'Teste em grupo: todos rolam; se metade ou mais passar, o grupo passa.',
      pode: [
        'Aceitar qualquer plano bom: uma bola, uma música (Atuação 14), um pedaço de carne.',
        'Cobrar 10 dracmas de cada um antes, para Caronte atravessá-los (🎯 Testes & 🎁 → Cobrar).',
      ],
      naoPode: [
        'Deixar virar combate: se atacarem, ele derruba quem atacou (0 PV) e volta a deitar. Ninguém morre.',
      ],
      dicas: [
        'Faça as três cabeças discordarem entre si: uma quer brincar, outra quer dormir, a terceira desconfia.',
      ],
    },
    next: 'Capítulo 5: carregue "O Palácio de Hades".',
  },
  // ─────────────────────────────── Capítulo 5 ───────────────────────────────
  {
    key: 'c5_hades', chapter: 5, title: 'O Palácio de Hades',
    map: { generate: { kind: 'templo', width: 22, height: 16, seed: 'hades' } }, mood: 'submundo',
    start: { fx: 0.5, fy: 0.92 },
    goal: 'Convencer Hades de que não roubaram o elmo dele, e descobrir que o raio estava na mochila o tempo todo.',
    readAloud: 'O salão é feito de ossos polidos e pedras preciosas que brilham como olhos. No trono, um homem pálido de cabelos negros apoia o queixo na mão. Atrás dele, espíritos com armaduras antigas formam fileiras silenciosas. — Então os ladrões vieram até mim. Onde está o meu elmo?',
    monsters: [
      { key: 'esqueleto_spartoi', fx: 0.3, fy: 0.3, hidden: true, note: 'Guardas: revele só se a conversa der errado.' },
      { key: 'esqueleto_spartoi', fx: 0.7, fy: 0.3, hidden: true },
      { key: 'erinia', fx: 0.5, fy: 0.15, note: 'Fúria ao lado do trono (visível): ameaça, não ataca se o grupo for respeitoso.' },
    ],
    chests: [
      { fx: 0.15, fy: 0.2, lockDc: 15, tier: 'raro', note: 'Tesouro de Hades (visível, trancado): ele oferece em troca do elmo.' },
      { fx: 0.85, fy: 0.75, hidden: true, loot: [L('ambrosia', 3)], note: 'Romãs do jardim de Perséfone: comer prende no Submundo! A ambrosia está ao lado, revele com Percepção 14.' },
    ],
    quests: [
      { title: 'Provar inocência a Hades', description: 'Convencer Hades (Persuasão 16 ou mostrar a mochila).', required: true, rewardXp: 350 },
      { title: 'Achar o raio na mochila', description: 'Investigação 25 (ou o raio aparece sozinho na frente de Hades).', required: true, rewardXp: 200 },
      { title: 'Salvar quem se ama', description: 'A escolha da profecia: alguém fica para trás? (decisão dos jogadores).', required: false, rewardXp: 150 },
    ],
    gm: {
      regra: 'Interpretação e testes sociais de CD alta; usar Ajuda (um herói ajuda outro e dá vantagem).',
      pode: [
        'Deixar Hades furioso e soltar os guardas se o grupo for arrogante.',
        'Dar vantagem a quem lembrar a profecia ("quem não fez a guerra").',
      ],
      naoPode: [
        'Fazer o raio aparecer antes da hora: é o grande momento do capítulo.',
        'Deixar Hades derrotável: ele é um deus. Se lutarem, ele só os expulsa.',
      ],
      dicas: [
        'Hades é orgulhoso, não malvado: trate-o como um rei ofendido.',
        'Quando o raio cair da mochila, faça uma pausa dramática antes de descrever.',
      ],
    },
    next: 'Capítulo 6: carregue "A praia e o deus da guerra".',
  },
  // ─────────────────────────────── Capítulo 6 ───────────────────────────────
  {
    key: 'c6_ares', chapter: 6, title: 'A praia e o deus da guerra',
    map: { generate: { kind: 'praia', width: 24, height: 16, seed: 'santa-monica' } }, mood: 'dia',
    start: { fx: 0.3, fy: 0.15 },
    goal: 'Enfrentar a forma mortal de Ares na praia e recuperar o elmo de Hades.',
    readAloud: 'A areia está fria e o mar ruge. Uma moto preta para devagar no calçadão. O motoqueiro desce, tira os óculos escuros e, onde deviam estar os olhos, há duas brasas. — Então vocês descobriram o meu presentinho. Vamos ver se aguentam uma briga de verdade.',
    monsters: [{ key: 'avatar_ares', fx: 0.6, fy: 0.5, note: 'Chefe final. O mar ajuda filhos de Poseidon: dê vantagem perto da água.' }],
    chests: [
      { fx: 0.85, fy: 0.2, loot: [L('pocao_cura', 2), L('nectar')], note: 'Mochila de um surfista (visível).' },
      { fx: 0.1, fy: 0.6, hidden: true, loot: [L('tridente_mares')], note: 'Presente das Nereidas: revele se um filho de Poseidon entrar no mar.' },
    ],
    quests: [
      { title: 'Derrotar o avatar de Ares', description: 'Vencer o duelo ou fazê-lo desistir (é um deus, não morre).', required: true, rewardXp: 500, rewardDracmas: 100 },
      { title: 'Recuperar o elmo de Hades', description: 'Pegar o elmo da moto e devolver a Hades.', required: true, rewardXp: 200 },
      { title: 'A ferida de Ares', description: 'Acertar um crítico: Ares sangra icor e a profecia se cumpre ("quem não fez a guerra").', required: false, rewardXp: 100 },
    ],
    gm: {
      regra: 'Combate completo: tudo junto (terreno, empurrões, poderes divinos, poções).',
      pode: [
        'Usar a água: Poseidon empurra ondas (poder Onda) e apaga fogo.',
        'Ares "desiste" quando ficar com metade dos PV: ele é orgulhoso e promete vingança.',
      ],
      naoPode: [
        'Deixar alguém morrer no chefe final sem chance: lembre das poções e dos testes contra a morte.',
      ],
      dicas: [
        'Ares provoca e fala o tempo todo. Ele quer ser respeitado como guerreiro.',
        'Depois da luta, leia o epílogo do roteiro: o Olimpo, a devolução do raio e o recado de Luke.',
      ],
    },
    next: 'Epílogo: carregue "O Olimpo" para a cena final (sem combate).',
  },
  {
    key: 'c6_olimpo', chapter: 6, title: 'O Olimpo',
    map: { preset: 'olimpo' }, mood: 'olimpo',
    start: { fx: 0.5, fy: 0.9 },
    goal: 'Devolver o raio a Zeus, ser reconhecido pelos deuses e voltar ao acampamento como heróis.',
    readAloud: 'O elevador do Empire State sobe até um andar que não existe. As portas abrem para um caminho de nuvens e, lá em cima, palácios brancos com colunas que tocam o céu. No grande salão, tronos gigantes formam um U. No do meio, um homem de barba grisalha e terno azul segura o ar como se ele pesasse. — Vocês trouxeram o que é meu?',
    monsters: [],
    chests: [
      { fx: 0.5, fy: 0.3, loot: [L('ambrosia', 2)], dracmas: 100, note: 'Presente dos deuses (visível): entregue depois da conversa.' },
      { fx: 0.2, fy: 0.4, hidden: true, tier: 'raro', note: 'Presente do pai divino de cada herói: revele um por jogador, com uma frase do deus.' },
    ],
    quests: [
      { title: 'Devolver o raio-mestre', description: 'Entregar o raio a Zeus e contar quem foi o verdadeiro ladrão.', required: true, rewardXp: 300 },
      { title: 'A conversa com o pai divino', description: 'Cada herói tem um momento a sós com seu deus (interpretação).', required: false, rewardXp: 100 },
    ],
    gm: {
      regra: 'Fim de campanha: XP, níveis e ganchos para a próxima aventura.',
      pode: [
        'Subir todo mundo de nível (🎯 Testes & 🎁 → Recompensas).',
        'Plantar o próximo mistério: a traição de Luke.',
      ],
      naoPode: [
        'Encerrar sem dar a cada jogador um momento de destaque.',
      ],
      dicas: [
        'Pergunte a cada jogador o que o herói dele leva desta aventura.',
        'Tire uma foto da mesa: é a primeira campanha de vocês!',
      ],
    },
    next: 'Fim da aventura. Parabéns, Mestre!',
  },
];

export function getScene(key: string): Scene | undefined {
  return SCENES.find((s) => s.key === key);
}

export function scenesOfChapter(chapter: number): Scene[] {
  return SCENES.filter((s) => s.chapter === chapter);
}
