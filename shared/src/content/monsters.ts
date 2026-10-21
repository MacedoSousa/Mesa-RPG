import type { AbilityScores } from '../rules/abilities';
import type { DamageType } from './items';

export interface AttackDef {
  name: string;
  toHit: number;
  damage: string;
  damageType: DamageType;
  /** Alcance em quadrados (1 = corpo a corpo). */
  range: number;
  longRange?: number;
  bonusVsMonsters?: string;
  /** Ataque à distância (sofre desvantagem com inimigo adjacente). */
  ranged?: boolean;
}

export interface MonsterDef {
  key: string;
  label: string;
  description: string;
  lore: string;
  size: 'pequeno' | 'medio' | 'grande' | 'enorme';
  ac: number;
  hp: string; // fórmula
  speed: number; // metros
  abilities: AbilityScores;
  attacks: AttackDef[];
  resistances?: DamageType[];
  cr: string;
  xp: number;
  traits?: string[];
}

const ab = (forca: number, destreza: number, constituicao: number, inteligencia: number, sabedoria: number, carisma: number): AbilityScores => ({
  forca, destreza, constituicao, inteligencia, sabedoria, carisma,
});

/** Monstros de domínio público da mitologia grega (estatísticas originais do Mesa RPG). */
export const MONSTERS: Record<string, MonsterDef> = {
  harpia: {
    key: 'harpia', label: 'Harpia', size: 'medio', ac: 11, hp: '7d8', speed: 12, cr: '1', xp: 200,
    description: 'Mulher-pássaro de garras afiadas e canto enlouquecedor.',
    lore: 'As harpias atormentaram o rei Fineu roubando sua comida até serem expulsas pelos Argonautas.',
    abilities: ab(12, 13, 10, 7, 10, 13),
    attacks: [{ name: 'Garras', toHit: 3, damage: '2d4+1', damageType: 'cortante', range: 1 }],
    traits: ['Voa: ignora terreno difícil'],
  },
  cao_infernal: {
    key: 'cao_infernal', label: 'Cão do Submundo', size: 'grande', ac: 13, hp: '6d10+12', speed: 15, cr: '2', xp: 450,
    description: 'Cão negro do tamanho de um touro, com olhos vermelhos como brasas.',
    lore: 'Parentes de Cérbero, guardam as fronteiras do reino de Hades.',
    abilities: ab(17, 14, 14, 3, 13, 6),
    attacks: [{ name: 'Mordida', toHit: 5, damage: '2d6+3', damageType: 'perfurante', range: 1 }],
    resistances: ['fogo', 'necrotico'],
  },
  minotauro: {
    key: 'minotauro', label: 'Minotauro', size: 'grande', ac: 14, hp: '9d10+27', speed: 12, cr: '3', xp: 700,
    description: 'Homem com cabeça de touro, furioso e quase impossível de derrubar.',
    lore: 'Filho de Pasífae, preso no Labirinto de Creta e derrotado por Teseu.',
    abilities: ab(18, 11, 16, 6, 16, 9),
    attacks: [
      { name: 'Machado Grande', toHit: 6, damage: '2d12+4', damageType: 'cortante', range: 1 },
      { name: 'Chifrada', toHit: 6, damage: '2d8+4', damageType: 'perfurante', range: 1 },
    ],
    traits: ['Investida: o Mestre pode narrar empurrões ao avançar'],
  },
  ciclope_selvagem: {
    key: 'ciclope_selvagem', label: 'Ciclope Selvagem', size: 'enorme', ac: 14, hp: '12d12+60', speed: 12, cr: '6', xp: 2300,
    description: 'Gigante de um olho que arremessa rochas do tamanho de carroças.',
    lore: 'Polifemo, filho de Poseidon, prendeu Odisseu em sua caverna até ser cegado.',
    abilities: ab(22, 11, 20, 8, 6, 10),
    attacks: [
      { name: 'Clava Gigante', toHit: 9, damage: '3d8+6', damageType: 'concussao', range: 1 },
      { name: 'Arremessar Rocha', toHit: 9, damage: '4d10+6', damageType: 'concussao', range: 20, ranged: true },
    ],
  },
  dracena: {
    key: 'dracena', label: 'Dracena', size: 'medio', ac: 13, hp: '5d8+5', speed: 9, cr: '1', xp: 200,
    description: 'Mulher-serpente com dois rabos de cobra no lugar das pernas.',
    lore: 'Seres-serpente citados por Heródoto nas lendas da Cítia.',
    abilities: ab(14, 14, 12, 9, 11, 10),
    attacks: [
      { name: 'Lança', toHit: 4, damage: '1d8+2', damageType: 'perfurante', range: 1 },
      { name: 'Mordida Venenosa', toHit: 4, damage: '1d4+2', damageType: 'veneno', range: 1 },
    ],
  },
  empusa: {
    key: 'empusa', label: 'Empusa', size: 'medio', ac: 13, hp: '8d8+8', speed: 12, cr: '2', xp: 450,
    description: 'Vampira de cabelos em chamas, com uma perna de bronze e outra de burro.',
    lore: 'Servas de Hécate que, segundo os antigos, seduziam viajantes nas estradas.',
    abilities: ab(12, 15, 12, 13, 12, 17),
    attacks: [{ name: 'Garras', toHit: 4, damage: '2d6+2', damageType: 'cortante', range: 1 }],
    resistances: ['fogo'],
  },
  esqueleto_spartoi: {
    key: 'esqueleto_spartoi', label: 'Guerreiro Spartoi', size: 'medio', ac: 15, hp: '4d8+4', speed: 9, cr: '1/2', xp: 100,
    description: 'Soldado de ossos nascido de dentes de dragão semeados na terra.',
    lore: 'Cadmo semeou os dentes do dragão de Ares e deles brotaram os guerreiros Spartoi.',
    abilities: ab(13, 14, 12, 6, 8, 5),
    attacks: [
      { name: 'Espada Curta', toHit: 4, damage: '1d6+2', damageType: 'perfurante', range: 1 },
      { name: 'Arco Curto', toHit: 4, damage: '1d6+2', damageType: 'perfurante', range: 16, ranged: true },
    ],
    resistances: ['veneno'],
  },
  quimera: {
    key: 'quimera', label: 'Quimera', size: 'grande', ac: 14, hp: '12d10+48', speed: 9, cr: '6', xp: 2300,
    description: 'Leão, cabra e serpente num só corpo, cuspindo fogo.',
    lore: 'Filha de Tifão e Equidna, abatida pelo herói Belerofonte montado em Pégaso.',
    abilities: ab(19, 11, 19, 3, 14, 10),
    attacks: [
      { name: 'Mordida', toHit: 7, damage: '2d6+4', damageType: 'perfurante', range: 1 },
      { name: 'Sopro de Fogo', toHit: 5, damage: '4d8', damageType: 'fogo', range: 3, ranged: true },
    ],
    resistances: ['fogo'],
  },
  hidra_jovem: {
    key: 'hidra_jovem', label: 'Hidra Jovem', size: 'enorme', ac: 15, hp: '10d12+40', speed: 9, cr: '5', xp: 1800,
    description: 'Serpente de muitas cabeças. Corte uma e duas crescem no lugar.',
    lore: 'A Hidra de Lerna foi o segundo trabalho de Héracles, vencida com fogo nas feridas.',
    abilities: ab(20, 12, 18, 2, 10, 7),
    attacks: [{ name: 'Mordidas', toHit: 8, damage: '3d10+5', damageType: 'perfurante', range: 2 }],
    traits: ['Regenera 10 PV por rodada, a menos que tenha sofrido dano de fogo (narrativo)'],
  },
  gorgona: {
    key: 'gorgona', label: 'Górgona', size: 'medio', ac: 15, hp: '15d8+30', speed: 9, cr: '6', xp: 2300,
    description: 'Cabelos de serpentes vivas e um olhar que transforma em pedra.',
    lore: 'Medusa, Esteno e Euríale. Perseu decapitou Medusa usando um escudo como espelho.',
    abilities: ab(10, 15, 14, 12, 13, 15),
    attacks: [
      { name: 'Serpentes', toHit: 5, damage: '1d4+2', damageType: 'veneno', range: 1 },
      { name: 'Arco Curto', toHit: 5, damage: '1d6+2', damageType: 'perfurante', range: 16, ranged: true },
    ],
    traits: ['Olhar petrificante: o Mestre pode pedir teste de CON CD 14'],
  },
  lestrigao: {
    key: 'lestrigao', label: 'Lestrigão', size: 'grande', ac: 12, hp: '8d10+24', speed: 12, cr: '3', xp: 700,
    description: 'Gigante canibal que arremessa pedras em navios.',
    lore: 'Destruíram quase toda a frota de Odisseu no porto de Telépilo.',
    abilities: ab(20, 8, 17, 7, 9, 8),
    attacks: [
      { name: 'Porrete', toHit: 7, damage: '2d8+5', damageType: 'concussao', range: 1 },
      { name: 'Pedra', toHit: 7, damage: '2d10+5', damageType: 'concussao', range: 12, ranged: true },
    ],
  },
  telquine: {
    key: 'telquine', label: 'Telquine', size: 'medio', ac: 13, hp: '6d8+6', speed: 9, cr: '1', xp: 200,
    description: 'Criatura marinha com corpo de foca e mãos humanas, ferreira de magia sombria.',
    lore: 'Os Telquines de Rodes eram feiticeiros e ferreiros, acusados de envenenar campos.',
    abilities: ab(14, 12, 12, 14, 11, 9),
    attacks: [{ name: 'Adaga Forjada', toHit: 4, damage: '1d6+2', damageType: 'cortante', range: 1 }],
    resistances: ['frio'],
  },
};

export type MonsterKey = keyof typeof MONSTERS;

export function getMonster(key: string): MonsterDef | undefined {
  return MONSTERS[key];
}
