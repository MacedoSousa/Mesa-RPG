import type { Ability, Skill } from '../rules/abilities';
import type { DamageType } from './items';

/** Efeitos mecânicos de raças e divindades, aplicados nos atributos derivados. */
export interface PassiveMechanics {
  hpBonusPerLevel?: number;
  acBonus?: number;
  speedBonus?: number; // em metros
  initiativeBonus?: number;
  staminaBonus?: number;
  darkvision?: number; // em metros
  resistances?: DamageType[];
  skillProficiencies?: Skill[];
  weaponProficiencies?: string[];
  /** Vantagem em testes de resistência contra estas condições. */
  conditionAdvantage?: string[];
}

export interface Trait {
  key: string;
  label: string;
  description: string;
}

export interface RaceDef {
  key: string;
  label: string;
  description: string;
  lore: string;
  abilityBonuses: Partial<Record<Ability, number>>;
  /** Deslocamento em metros (1 quadrado = 1,5 m). */
  speed: number;
  traits: Trait[];
  mechanics: PassiveMechanics;
  /** Restringe quais divindades podem ser escolhidas no passo 2. */
  allowedDivinities?: string[];
}

export const RACES = {
  semideus: {
    key: 'semideus', label: 'Semideus',
    description: 'Filho(a) de um deus com um mortal. Monstros sentem seu cheiro de longe.',
    lore: 'Na mitologia grega, heróis como Héracles, Perseu e Teseu eram semideuses: metade mortais, metade divinos.',
    abilityBonuses: { constituicao: 1, carisma: 1 }, speed: 9,
    traits: [
      { key: 'sangue_divino', label: 'Sangue Divino', description: '+1 PV por nível. Curas divinas (Ambrosia, Néctar) funcionam em você.' },
      { key: 'reflexos_heroicos', label: 'Reflexos Heroicos', description: '+1 na iniciativa: o instinto de combate é herança do Olimpo.' },
      { key: 'aroma_mitico', label: 'Aroma Mítico', description: 'Monstros sabem onde você está. O Mestre pode usar isso contra você!' },
    ],
    mechanics: { hpBonusPerLevel: 1, initiativeBonus: 1 },
  },
  cacador_artemis: {
    key: 'cacador_artemis', label: 'Caçador(a) de Ártemis',
    description: 'Membro do séquito da deusa da caça. Jurou lealdade à Lua e à vida selvagem.',
    lore: 'Nos mitos, Ártemis caçava acompanhada de ninfas e companheiras juradas, como Calisto e Atalanta.',
    abilityBonuses: { destreza: 2, sabedoria: 1 }, speed: 10.5,
    traits: [
      { key: 'juramento_caca', label: 'Juramento da Caçada', description: 'Proficiência com arco curto e arco longo, e na perícia Sobrevivência.' },
      { key: 'passos_lua', label: 'Passos da Lua', description: '+1,5 m de deslocamento e visão no escuro de 18 m.' },
    ],
    mechanics: { weaponProficiencies: ['arco_curto', 'arco_longo'], skillProficiencies: ['sobrevivencia'], darkvision: 18 },
    allowedDivinities: ['artemis'],
  },
  satiro: {
    key: 'satiro', label: 'Sátiro',
    description: 'Meio humano, meio bode. Protetor dos bosques, músico nato e guia de heróis.',
    lore: 'Os sátiros acompanhavam Dionísio e Pã pelos campos da Grécia, entre vinho, música e dança.',
    abilityBonuses: { destreza: 1, carisma: 2 }, speed: 10.5,
    traits: [
      { key: 'flauta_silvestre', label: 'Flauta Silvestre', description: 'Proficiência em Atuação e Lidar com Animais.' },
      { key: 'cascos_firmes', label: 'Cascos Firmes', description: 'Vantagem para não cair em gelo ou óleo; +1,5 m de deslocamento.' },
      { key: 'empatia_natural', label: 'Empatia Natural', description: 'Percebe emoções de quem está perto (sabor narrativo para o Mestre).' },
    ],
    mechanics: { skillProficiencies: ['atuacao', 'lidar_animais'], conditionAdvantage: ['caido'] },
    allowedDivinities: ['pa', 'dionisio'],
  },
  ninfa: {
    key: 'ninfa', label: 'Ninfa',
    description: 'Espírito da natureza ligado a uma árvore, rio ou montanha.',
    lore: 'Dríades habitam árvores, náiades vivem em fontes e rios, oréades protegem as montanhas.',
    abilityBonuses: { sabedoria: 2, carisma: 1 }, speed: 9,
    traits: [
      { key: 'vinculo_natural', label: 'Vínculo Natural', description: 'Proficiência em Natureza e Medicina.' },
      { key: 'casca_viva', label: 'Casca Viva', description: '+1 na Classe de Armadura e resistência a veneno.' },
    ],
    mechanics: { skillProficiencies: ['natureza', 'medicina'], acBonus: 1, resistances: ['veneno'] },
    allowedDivinities: ['demeter', 'poseidon', 'artemis', 'pa', 'dionisio', 'zeus'],
  },
  legado: {
    key: 'legado', label: 'Legado',
    description: 'Mortal com uma gota distante de sangue divino. Versátil, mas não tolera alimento dos deuses.',
    lore: 'Muitas famílias gregas diziam descender de um deus: os Alcmeônidas, os Eácidas, os Heráclidas...',
    abilityBonuses: { inteligencia: 1, sabedoria: 1, forca: 1 }, speed: 9,
    traits: [
      { key: 'versatil', label: 'Versátil', description: '+1 em três atributos e proficiência em Intuição e Investigação.' },
      { key: 'sangue_diluido', label: 'Sangue Diluído', description: 'Ambrosia e Néctar são perigosos demais para você: itens bloqueados.' },
    ],
    mechanics: { skillProficiencies: ['intuicao', 'investigacao'] },
  },
  ciclope: {
    key: 'ciclope', label: 'Ciclope Jovem',
    description: 'Gigante de um só olho, forjador talentoso e mais gentil do que as lendas contam.',
    lore: 'Os ciclopes Brontes, Estéropes e Arges forjaram o raio de Zeus, o tridente de Poseidon e o elmo de Hades.',
    abilityBonuses: { forca: 2, constituicao: 1 }, speed: 9,
    traits: [
      { key: 'pele_de_forja', label: 'Pele de Forja', description: 'Resistência a fogo: você cresceu ao lado de fornalhas.' },
      { key: 'mestre_ferreiro', label: 'Mestre Ferreiro', description: 'Proficiência com Martelo de Guerra e Martelo da Forja Divina.' },
      { key: 'olho_unico', label: 'Olho Único', description: 'Visão no escuro de 18 m, mas desvantagem em ataques à distância contra alvos a mais de 15 m (narrativo).' },
    ],
    mechanics: { resistances: ['fogo'], weaponProficiencies: ['martelo_guerra', 'martelo_forja'], darkvision: 18, hpBonusPerLevel: 1 },
    allowedDivinities: ['poseidon', 'hefesto'],
  },
} as const satisfies Record<string, RaceDef>;

export type RaceKey = keyof typeof RACES;
export const RACE_KEYS = Object.keys(RACES) as RaceKey[];

export function getRace(key: string): RaceDef | undefined {
  return (RACES as Record<string, RaceDef>)[key];
}
