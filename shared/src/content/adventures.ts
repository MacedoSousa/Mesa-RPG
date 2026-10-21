import type { LootEntry } from '../engine/types';

/**
 * Aventuras prontas para carregar no HUD do Mestre (Fases → "📚 Carregar aventura").
 * O roteiro completo, com textos para ler em voz alta, fica em docs/campanha/.
 */

export interface AdventureQuest {
  title: string;
  description: string;
  hidden: boolean;
  target: number;
  reward: string;
  rewardXp: number;
  rewardDracmas: number;
  rewardItems: LootEntry[];
}

export interface Adventure {
  key: string;
  title: string;
  summary: string;
  levels: string;
  doc: string;
  chapters: { title: string; description: string }[];
  quests: AdventureQuest[];
}

const q = (title: string, description: string, rewardXp: number, extra: Partial<AdventureQuest> = {}): AdventureQuest => ({
  title, description, hidden: false, target: 1, reward: '', rewardXp, rewardDracmas: 0, rewardItems: [], ...extra,
});

export const ADVENTURES: Adventure[] = [
  {
    key: 'ladrao_de_raios',
    title: 'O Ladrão de Raios',
    summary: 'Novatos do Acampamento Meio-Sangue recebem a profecia: atravessar o país, descer ao Mundo Inferior e devolver o raio-mestre de Zeus até o solstício.',
    levels: 'Níveis 1 → 5 · 6 capítulos · 2 a 5 jogadores',
    doc: 'docs/campanha/O_LADRAO_DE_RAIOS.md',
    chapters: [
      {
        title: 'Cap. 1 — O Novato',
        description: [
          'OBJETIVO: chegar vivos ao acampamento, ser reconhecidos e receber a profecia. Mapa: Acampamento Meio-Sangue (cena 1: Gerar → Floresta).',
          'CENAS: 1) Fuga do Minotauro até o pinheiro (ensina iniciativa, movimento, Disparada — é FUGA, não luta). 2) Casa Grande: Quíron e Sr. D (teste de perícia/CD: Persuasão 15). 3) Tour + Luke (chalé 11) + Clarisse (vantagem/desvantagem). 4) Captura da Bandeira — treino; no fim um Cão do Submundo de verdade ataca (ataque, CA, 0 PV). 5) Reconhecimento: revele os pais divinos (Resistência de SAB 10). 6) O Oráculo e a profecia (descanso longo). 7) Luke dá a mochila (raio escondido, Investigação 25) e os tênis alados amaldiçoados.',
          'LEIA EM VOZ ALTA (cena 1): "A chuva bate tão forte no teto da van que parece granizo. O motorista, um rapaz magrelo de boné, não para de olhar pelo retrovisor. Um relâmpago ilumina a estrada e, por um segundo, vocês veem algo enorme correndo atrás da van, com chifres. A van derrapa no barro. — Corram até o pinheiro no topo da colina! Lá dentro ele não entra! O que vocês fazem?"',
          'PROFECIA (entregue aos jogadores): "Ao poente seguirão, onde o sol morre na terra, / buscando o que foi tirado por quem não fez a guerra. / Um sorriso amigo esconde a lâmina na mão; / e ao fim, no portão dos mortos, a escolha do coração: / salvar quem se ama, ou salvar a missão."',
          'BAÚ (arsenal, CD 12): Espada de Bronze Celestial, Escudo de Bronze, 2 Poções, 15 dracmas. Fim: conclua "A profecia do Oráculo" → nível 2.',
        ].join('\n\n'),
      },
      {
        title: 'Cap. 2 — A Estrada para o Oeste',
        description: [
          'OBJETIVO: sair de Nova York e sobreviver aos primeiros monstros. Mapas: Gerar → Estrada, Jardim/Interior, Templo.',
          'CENAS: 1) As três Moiras cortam um fio (presságio; Resistência SAB 12 ou Amedrontado). 2) Fúrias no ônibus — 1 Fúria (erinia) por 2 heróis (ação bônus e reação). 3) Empório de Estátuas da "Tia M." — Medusa (gorgona): quem olha faz CON 14 ou Atordoado; lutar pelo reflexo = desvantagem e seguro. 4) O Arco — Equidna + Quimera: fortes demais, a cena é FUGA pelo cenário (janelas quebram, pular no rio).',
          'LEIA EM VOZ ALTA (cena 3): "O pátio está cheio de estátuas de cimento: um sátiro de olhar assustado, uma moça com as mãos na frente do rosto, um menino que parece querer correr. A porta se abre e uma voz doce, por trás de um véu preto, convida: — Entrem, queridos. Estão com fome?"',
          'BAÚ (lanchonete da Medusa): 2 Néctar, 1 Ambrosia, Arco Curto, 30 dracmas. Fim → nível 3. Marque +2 dias no Solstício.',
        ].join('\n\n'),
      },
      {
        title: 'Cap. 3 — Águas e Ilusões',
        description: [
          'OBJETIVO: conseguir carona para o oeste sem ficar preso. Mapas: Gerar → Interior, Água/Parque.',
          'CENAS: 1) Ares na lanchonete oferece ajuda em troca do escudo (Intuição 14: ele mente). 2) Parque aquático: armadilha de Hefesto — rede (DES 13), Aranhas Autômato (2 por herói), alarme de 4 segmentos com a água subindo; desarmar: Investigação 14 + Prestidigitação 13. 3) Caminhão do zoológico: libertar animais (bondade opcional). 4) Cassino Lótus: relógio de 6 segmentos (cada diversão = +1 e +1 dia no Solstício); comer o lótus = SAB 13; sair convencendo os outros (Persuasão/Intimidação 12).',
          'LEIA EM VOZ ALTA (cena 4): "Lá dentro tem videogames de realidade virtual, uma piscina com toboágua dentro do prédio, comida que aparece antes de pedir e flores de lótus brancas em todas as mesas. Ninguém olha para o relógio — e não há relógio em parede nenhuma."',
          'BAÚ (cabine do salva-vidas, CD 13): Peitoral de Bronze Celestial, 2 Poções, 1 Néctar, 40 dracmas.',
        ].join('\n\n'),
      },
      {
        title: 'Cap. 4 — Rumo ao Mundo Inferior',
        description: [
          'OBJETIVO: achar a entrada do Mundo Inferior e atravessar o Estige. Mapas: Gerar → Interior; Submundo (padrão).',
          'CENAS: 1) O Palácio das Camas — Procrustes (procrustes); melhor solução: convencê-lo a deitar (Enganação 15 / Persuasão 13). 2) Estúdio Último Suspiro — Caronte cobra 10 dracmas por pessoa (🎯 Testes & 🎁 → Cobrar item: dracmas × 10); tocar no Estige = SAB 12. 3) Cérbero (cerbero): NÃO é luta — bola + Lidar com Animais 14, música (Atuação 14), petisco ou Furtividade em grupo 15. 4) Campos de Asfódelos: os tênis de Luke puxam para o Tártaro (FOR 15) e a voz diz "o presente chegou quase até mim".',
          'LEIA EM VOZ ALTA (cena 3): "Na margem, um portão de obsidiana enorme. Na frente dele, deitado como uma montanha de pelo preto, um cão de três cabeças — cada uma do tamanho de um carro — fareja o ar. As três param ao mesmo tempo, viradas para vocês."',
          'BAÚ (loja de Procrustes, CD 14): 3 Poções, 2 Ambrosias, Martelo de Guerra, 60 dracmas. Fim → nível 4.',
        ].join('\n\n'),
      },
      {
        title: 'Cap. 5 — O Palácio de Hades',
        description: [
          'OBJETIVO: enfrentar Hades, descobrir a verdade e fugir. Mapa: Submundo (palácio à direita).',
          'CENAS: 1) Hades acusa o grupo — cena SOCIAL (Persuasão 15). Ao abrir a mochila, o raio-mestre está lá: Hades manda Fúrias e Guerreiros Spartoi. 2) As pérolas: há uma a menos que o necessário (a escolha da profecia). Relógio de fuga: 6 rodadas. Aliados que ajudam: Cérbero (se amigo), pégaso (se amigo), um herói que se sacrifica e é libertado no epílogo.',
          'LEIA EM VOZ ALTA (cena 1): "No trono, um homem pálido, de cabelos pretos e manto cheio de rostos sofredores, apoia o queixo na mão. — Os ladrões vêm à minha casa. Vieram devolver o que me roubaram, ou zombar de mim como meu irmão?"',
          'BAÚ (tesouro de Hades, CD 16): tabela Rara.',
        ].join('\n\n'),
      },
      {
        title: 'Cap. 6 — A Praia, o Deus e o Olimpo',
        description: [
          'OBJETIVO: derrotar Ares, recuperar o Elmo das Trevas e devolver o raio. Mapas: Gerar → Praia; Olimpo (padrão).',
          'CENAS: 1) Duelo com Ares (avatar_ares) na praia — o mar ajuda filhos de Poseidon; com 0 PV ele recua e amaldiçoa quem o feriu; se o Solstício encheu, tempestade (2d6 elétrico numa casa por rodada). 2) Empire State, andar 600: devolver o raio a Zeus; +20 afinidade para todos; item da tabela Rara para cada herói. 3) Epílogo: Luke revela a traição e solta o escorpião (Aranha Autômato renomeada, dano veneno 2d6) — gancho para a próxima campanha.',
          'LEIA EM VOZ ALTA (cena 1): "Na areia, de pé ao lado da moto, Ares bate palmas devagar. — Bravo. Os novatos sobreviveram ao Submundo. Pena que agora vão ter que me entregar esse bastão aí. Na cintura dele pende um capacete de bronze negro: o Elmo das Trevas."',
        ].join('\n\n'),
      },
    ],
    quests: [
      q('⭐ A profecia do Oráculo', 'Cap. 1 — chegar ao acampamento, ser reconhecido e ouvir a profecia.', 150, { reward: 'Kit de Quíron', rewardDracmas: 20, rewardItems: [{ itemKey: 'pocao_cura', quantity: 1 }, { itemKey: 'nectar', quantity: 1 }, { itemKey: 'ambrosia', quantity: 1 }] }),
      q('O chifre do Minotauro', 'Cap. 1 — arrancar um chifre na fuga (Atletismo 15).', 100, { hidden: true }),
      q('Derrotar Clarisse', 'Cap. 1 — vencer a filha de Ares na briga ou na Captura da Bandeira.', 75, { hidden: true }),
      q('O pégaso amigo', 'Cap. 1 — Lidar com Animais 12 no estábulo; o pégaso vira fuga de emergência.', 50, { hidden: true }),
      q('Quem soltou o cão?', 'Cap. 1 — juntar 3 pistas (pegadas, bilhete, pena). Não deixe fechar em Luke ainda.', 100, { hidden: true, target: 3 }),
      q('☀️ Solstício (prazo)', 'Relógio da campanha: +1 a cada dia na estrada ou desvio. Se encher, a guerra começa (final mais difícil).', 0, { hidden: true, target: 10 }),
      q('⭐ A estrada para o oeste', 'Cap. 2 — sobreviver às Fúrias, à Medusa e ao Arco.', 300),
      q('As vítimas da Medusa', 'Cap. 2 — mandar a cabeça da Medusa ao Olimpo.', 150, { hidden: true }),
      q('🦇 As Fúrias', 'Relógio: +1 quando o grupo chama atenção. Ao encher, uma Fúria ataca.', 0, { hidden: true, target: 4 }),
      q('A mensagem da náiade', 'Cap. 2 — quem pular no rio recebe o recado e uma pérola.', 100, { hidden: true, rewardItems: [{ itemKey: 'pocao_cura', quantity: 1 }] }),
      q('⭐ Águas e ilusões', 'Cap. 3 — conseguir a carona de Ares e sair de Las Vegas.', 400),
      q('O escudo de Ares', 'Cap. 3 — recuperar o escudo no parque aquático.', 200, { hidden: true }),
      q('Libertar os animais', 'Cap. 3 — abrir as jaulas do caminhão.', 75, { hidden: true }),
      q('🪷 Sair do Lótus', 'Cap. 3 — relógio de 6: sair com 3 ou menos vale a recompensa completa.', 250, { hidden: true, target: 1 }),
      q('⭐ Rumo ao Mundo Inferior', 'Cap. 4 — atravessar o Estige e passar por Cérbero.', 500),
      q('Prender Procrustes', 'Cap. 4 — prendê-lo na própria cama (sem lutar vale mais).', 200, { hidden: true }),
      q('Fazer amizade com Cérbero', 'Cap. 4 — bola, música ou petisco.', 250, { hidden: true }),
      q('⭐ O Palácio de Hades', 'Cap. 5 — descobrir a verdade e fugir do Mundo Inferior.', 600),
      q('Convencer Hades da verdade', 'Cap. 5 — Persuasão 15; Hades fica neutro.', 300, { hidden: true }),
      q('Ninguém fica para trás', 'Cap. 5 — todos escapam no relógio de 6 rodadas.', 300, { hidden: true }),
      q('⭐ O raio volta ao Olimpo', 'Cap. 6 — vencer Ares e entregar o raio-mestre a Zeus.', 1000, { reward: 'Gratidão do Olimpo', rewardDracmas: 100 }),
    ],
  },
];

export function getAdventure(key: string): Adventure | undefined {
  return ADVENTURES.find((a) => a.key === key);
}
