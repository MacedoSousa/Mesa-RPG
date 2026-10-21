import { OBJECTS } from '../engine/map';
import type { MapState, ObjectType, TerrainType, Tile } from '../engine/types';

/**
 * Mapas padrão desenhados em ASCII (1 caractere = 1 casa de 1,5 m).
 * Legenda de terreno e objetos abaixo — fácil de editar à mão.
 */
export const TERRAIN_CHARS: Record<string, TerrainType> = {
  '.': 'grama', ',': 'terra', '_': 'pedra', ':': 'areia', 'm': 'marmore', 'c': 'nuvem', 'w': 'madeira',
  '~': 'agua_rasa', 'W': 'agua_profunda', 'L': 'lava', 'v': 'abismo', 'S': 'estige',
  '#': 'parede', 'O': 'coluna', 'T': 'arvore', 'x': 'escombros', '=': 'ponte', 'G': 'portao', '^': 'elevado',
};

export const OBJECT_CHARS: Record<string, ObjectType> = {
  b: 'barril_explosivo', a: 'barril_agua', o: 'barril_oleo', k: 'caixote', e: 'estatua', f: 'braseiro',
};

export interface PresetMap {
  key: string;
  name: string;
  description: string;
  /** Terreno sob objetos. */
  floor: TerrainType;
  rows: string[];
  /** Pontos de entrada sugeridos para os heróis. */
  spawns: { x: number; y: number }[];
}

export const PRESET_MAPS: PresetMap[] = [
  {
    key: 'acampamento',
    name: 'Acampamento Meio-Sangue',
    description: 'O vale protegido dos semideuses: chalés, lago das canoas, arena de treino e a floresta onde monstros se escondem.',
    floor: 'grama',
    spawns: [{ x: 11, y: 8 }, { x: 12, y: 8 }, { x: 11, y: 9 }, { x: 12, y: 9 }, { x: 10, y: 8 }, { x: 13, y: 8 }],
    rows: [
      'TTTTTT..........TTTTTTTT',
      'TT.......,,,.......TTTTT',
      'T..###G###.,.....~~~~TTT',
      'T..#wwwwk#.,....~~WW~~TT',
      'T..#wwwww#.,....~WWWW~TT',
      'T..###G###.,.....~~W~~TT',
      'T..........,,,,,,,,=,..T',
      '...^^......,.......,....',
      '...^^...b..,..OO...,....',
      '..........,,,,____,,....',
      'T...###...,...____.....T',
      'T...#wG...,.a.____..o..T',
      'T...###...,..........kkT',
      'TT........,............T',
      'TTT...TT..,,,....TTT..TT',
      'TTTTTTTTTT,,TTTTTTTTTTTT',
    ],
  },
  {
    key: 'submundo',
    name: 'Submundo (Reino de Hades)',
    description: 'Cavernas de pedra negra, o Rio Estige cortando o mapa, lava borbulhando e o palácio do senhor dos mortos.',
    floor: 'pedra',
    spawns: [{ x: 2, y: 8 }, { x: 3, y: 8 }, { x: 2, y: 9 }, { x: 3, y: 9 }, { x: 4, y: 8 }, { x: 4, y: 9 }],
    rows: [
      '__________SS____LL______',
      '__O____O__SS___LLL___O__',
      '__________SS____L_______',
      '_##G##____==____________',
      '_#___#____SS___xx_______',
      '_#_e_#____SS____________',
      '_##G##____SS_____O___O__',
      '__________SS____________',
      '____f_____==_____f______',
      '__________SS______######',
      '_LL_______SS______#____#',
      '_LLL___b__SS______G__e_#',
      '__L_______SS______#____#',
      '__________SS______######',
      '___O___O__SS____________',
      '__________SS____________',
    ],
  },
  {
    key: 'olimpo',
    name: 'Monte Olimpo',
    description: 'Salões de mármore sobre as nuvens, tronos elevados, estátuas dos deuses e bordas que dão direto para o abismo do céu.',
    floor: 'marmore',
    spawns: [{ x: 11, y: 13 }, { x: 12, y: 13 }, { x: 10, y: 13 }, { x: 13, y: 13 }, { x: 11, y: 12 }, { x: 12, y: 12 }],
    rows: [
      'vvvvcccccccccccccccvvvvv',
      'vvcccmmmmmmmmmmmmcccvvvv',
      'vccmmmmO^^^^^^Ommmmccvvv',
      'vcmmmmmm^^^^^^mmmmmmcvvv',
      'vcmmOmmm^^^^^^mmmOmmmcvv',
      'vcmmmmmmmmmmmmmmmmmmmcvv',
      'vcmemmmOmmmmmmOmmmemmcvv',
      'vcmmmmmmmmffmmmmmmmmmcvv',
      'vcmmOmmmmmmmmmmmmmOmmcvv',
      'vcmmmmmmmmmmmmmmmmmmmcvv',
      'vcmemmmOmmmmmmOmmmemmcvv',
      'vccmmmmmmmmmmmmmmmmmccvv',
      'vvcccmmmmmmmmmmmmmmcccvv',
      'vvvcccccccmmmmccccccvvvv',
      'vvvvvvvvccccccccvvvvvvvv',
      'vvvvvvvvvvccccvvvvvvvvvv',
    ],
  },
  {
    key: 'rio_hudson',
    name: 'Rio Hudson',
    description: 'Docas de madeira, uma ponte frágil sobre o rio, caixotes, barris e a cidade mortal do outro lado.',
    floor: 'pedra',
    spawns: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 2 }, { x: 4, y: 3 }],
    rows: [
      '________###_____________',
      '___k____#_#____k__k_____',
      '________###_____________',
      '_____ko_________________',
      'wwwwwwwwww______wwwwwwww',
      'wwwwwwwwwwwa___bwwwwwwww',
      '~~~~~~~~~~ww==ww~~~~~~~~',
      'WWWWWWWWWWWW==WWWWWWWWWW',
      'WWWWWWWWWWWW==WWWWWWWWWW',
      'WWWWWWWWWWWW==WWWWWWWWWW',
      '~~~~~~~~~~ww==ww~~~~~~~~',
      'wwwwwwwwwwwb__awwwwwwwww',
      ':::::::::::____:::::::::',
      '..TT......______....TT..',
      '..TT...k..______.o..TT..',
      '..........______........',
    ],
  },
];

export function buildPresetMap(key: string): MapState {
  const preset = PRESET_MAPS.find((p) => p.key === key);
  if (!preset) throw new Error(`Mapa padrão desconhecido: ${key}`);
  const height = preset.rows.length;
  const width = preset.rows[0].length;
  const tiles: Tile[] = [];
  for (const row of preset.rows) {
    if (row.length !== width) throw new Error(`Mapa ${key}: linhas com tamanhos diferentes`);
    for (const ch of row) {
      if (TERRAIN_CHARS[ch]) tiles.push({ t: TERRAIN_CHARS[ch] });
      else if (OBJECT_CHARS[ch]) {
        const type = OBJECT_CHARS[ch];
        tiles.push({ t: preset.floor, o: { type, hp: OBJECTS[type].maxHp } });
      } else throw new Error(`Mapa ${key}: caractere desconhecido "${ch}"`);
    }
  }
  return { id: null, name: preset.name, preset: key, width, height, tiles };
}
