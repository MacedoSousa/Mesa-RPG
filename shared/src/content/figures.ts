import { z } from 'zod';
import { seededRng, type Rng } from '../dice';

/**
 * Receita de boneco 3D (como a semente de um mapa gerado): base + partes + superfície + cores.
 * A mesma receita monta sempre o mesmo boneco. Serve para a Oficina de bonecos do Mestre,
 * para dar um visual próprio a uma espécie da campanha ou a um token só.
 */

export const FIGURE_BASES = {
  quadrupede: { label: 'Fera de quatro patas', hint: 'cães, leões, lobos, javalis' },
  serpente: { label: 'Serpente / dragão sem patas', hint: 'cobras gigantes, serpentes marinhas' },
  hidra: { label: 'Hidra (vários pescoços)', hint: 'hidras e dragões de muitas cabeças' },
  aranha: { label: 'Aranha / escorpião', hint: 'aranhas, escorpiões, autômatos' },
  ave: { label: 'Ave gigante', hint: 'grifos, aves de Estínfalo, harpias-fera' },
  marinho: { label: 'Criatura marinha', hint: 'telquines, focas, tritões' },
  golem: { label: 'Golem / autômato', hint: 'Talos de bronze, estátuas vivas' },
  humanoide: { label: 'Humanoide', hint: 'gigantes, ciclopes, guerreiros, espíritos' },
} as const;
export type FigureBase = keyof typeof FIGURE_BASES;
export const FIGURE_BASE_KEYS = Object.keys(FIGURE_BASES) as FigureBase[];

export const SURFACES_3D = {
  pelo: 'Pelo',
  escamas: 'Escamas',
  couro: 'Couro',
  penas: 'Penas',
  pedra: 'Pedra',
  bronze: 'Bronze',
  osso: 'Osso',
  carapaca: 'Carapaça',
  lodo: 'Lodo brilhante',
} as const;
export type Surface3D = keyof typeof SURFACES_3D;

export const FIGURE_OPTIONS = {
  horns: { nenhum: 'Sem chifres', chifres: 'Chifres curvos', bode: 'Chifres de bode', touro: 'Chifres de touro', coroa: 'Coroa de espinhos' },
  wings: { nenhuma: 'Sem asas', morcego: 'Asas de morcego', penas: 'Asas de penas', inseto: 'Asas de inseto' },
  tail: { nenhuma: 'Sem cauda', curta: 'Cauda curta', longa: 'Cauda longa', serpente: 'Cauda de serpente', escorpiao: 'Ferrão de escorpião', clava: 'Cauda com clava', chamas: 'Cauda de chamas' },
  aura: { nenhuma: 'Sem aura', brasas: 'Brasas', nevoa: 'Névoa', raios: 'Faíscas elétricas', bolhas: 'Bolhas' },
  head: { normal: 'Cabeça normal', touro: 'Cabeça de touro', ciclope: 'Um olho só (ciclope)', serpentes: 'Cabelo de serpentes', chamas: 'Cabelo de chamas', caveira: 'Caveira' },
  body: { barbarian: 'Bárbaro (forte)', knight: 'Cavaleiro', rogue: 'Ladino (ágil)', mage: 'Mago (manto)', skeleton_warrior: 'Esqueleto guerreiro', skeleton_minion: 'Esqueleto' },
  weapon: { nenhuma: 'Sem arma', clava: 'Clava', machado_grande: 'Machado grande', espada_longa: 'Espada', lanca: 'Lança', martelo_guerra: 'Martelo', adaga: 'Adaga', arco_longo: 'Arco' },
} as const;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const keysOf = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

export const figureRecipeSchema = z.object({
  v: z.literal(1).default(1),
  base: z.enum(keysOf(FIGURE_BASES)),
  seed: z.string().max(40).default(''),
  size: z.number().min(0.5).max(3).default(1),
  surface: z.enum(keysOf(SURFACES_3D)).default('pelo'),
  color: hex,
  accent: hex,
  belly: hex,
  eyes: hex,
  heads: z.number().int().min(1).max(9).default(1),
  horns: z.enum(keysOf(FIGURE_OPTIONS.horns)).default('nenhum'),
  wings: z.enum(keysOf(FIGURE_OPTIONS.wings)).default('nenhuma'),
  tail: z.enum(keysOf(FIGURE_OPTIONS.tail)).default('curta'),
  aura: z.enum(keysOf(FIGURE_OPTIONS.aura)).default('nenhuma'),
  spikes: z.boolean().default(false),
  mane: z.boolean().default(false),
  armor: z.boolean().default(false),
  glow: z.boolean().default(false),
  /** Aranha: 6 ou 8 patas; demais ignoram. */
  legs: z.number().int().min(4).max(8).default(8),
  // Só humanoides
  body: z.enum(keysOf(FIGURE_OPTIONS.body)).default('barbarian'),
  head: z.enum(keysOf(FIGURE_OPTIONS.head)).default('normal'),
  weapon: z.enum(keysOf(FIGURE_OPTIONS.weapon)).default('nenhuma'),
  shield: z.boolean().default(false),
  /** Metade de baixo de serpente (dracenas, Equidna). */
  serpentLegs: z.boolean().default(false),
});
export type FigureRecipe = z.infer<typeof figureRecipeSchema>;

// ───────────── Gerador (como o gerador de mapas: mesma semente = mesmo boneco) ─────────────

function strSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pick = <T>(r: Rng, arr: readonly T[]) => arr[Math.floor(r() * arr.length) % arr.length];
const chance = (r: Rng, p: number) => r() < p;

/** Paletas que combinam (corpo, detalhe, barriga, olhos), por "família" de criatura. */
const PALETTES: [string, string, string, string][] = [
  ['#1c1a1f', '#2c2930', '#4a3f46', '#ff3a1a'], // infernal
  ['#3f6a3a', '#2a4a28', '#c8c27a', '#ffe066'], // pântano
  ['#7a4a22', '#4a2c14', '#d9b07a', '#ffb000'], // fera do deserto
  ['#5a6f80', '#3d4f5e', '#c9d6dc', '#9be7ff'], // marinho
  ['#8a2a1a', '#5a1a10', '#e0a070', '#ffd34d'], // dragão vermelho
  ['#2a3f6a', '#1a2a4a', '#9ab0d8', '#bfe9ff'], // gelo
  ['#4a3a5a', '#2a1f36', '#b8a6c8', '#e879f9'], // sombra arcana
  ['#b8862e', '#7a5a1c', '#e8c98a', '#3bd6ff'], // bronze
  ['#8a8a80', '#5a5a54', '#c8c6b8', '#9be7ff'], // pedra
  ['#d8cfb8', '#a89f88', '#f4efe0', '#ff4040'], // osso
  ['#6b4f2a', '#3e2c16', '#d4b48a', '#ffcf40'], // terra
  ['#2f6a5a', '#1f4a3e', '#a8d8c0', '#7fffd4'], // jade
];

const SURFACE_BY_BASE: Record<FigureBase, Surface3D[]> = {
  quadrupede: ['pelo', 'pelo', 'pelo', 'escamas', 'couro', 'pedra'],
  serpente: ['escamas', 'escamas', 'lodo', 'couro'],
  hidra: ['escamas', 'escamas', 'lodo', 'carapaca'],
  aranha: ['carapaca', 'carapaca', 'bronze', 'pelo'],
  ave: ['penas', 'penas', 'penas', 'bronze'],
  marinho: ['couro', 'escamas', 'lodo'],
  golem: ['pedra', 'bronze', 'bronze', 'osso'],
  humanoide: ['couro', 'escamas', 'pedra', 'osso'],
};

/** Gera um boneco coerente a partir da base e da semente. */
export function generateFigureRecipe(base: FigureBase, seed: string): FigureRecipe {
  const r = seededRng(strSeed(`${base}:${seed}`));
  const surface = pick(r, SURFACE_BY_BASE[base]);
  let [color, accent, belly, eyes] = pick(r, PALETTES);
  if (surface === 'bronze') [color, accent, belly] = ['#b8862e', '#7a5a1c', '#e8c98a'];
  if (surface === 'pedra') [color, accent, belly] = ['#8a8a80', '#5a5a54', '#a8a69a'];
  if (surface === 'osso') [color, accent, belly] = ['#d8cfb8', '#a89f88', '#f4efe0'];
  const rec: FigureRecipe = {
    v: 1, base, seed, size: 1, surface, color, accent, belly, eyes,
    heads: 1, horns: 'nenhum', wings: 'nenhuma', tail: 'curta', aura: 'nenhuma',
    spikes: false, mane: false, armor: false, glow: chance(r, 0.5), legs: 8,
    body: 'barbarian', head: 'normal', weapon: 'nenhuma', shield: false, serpentLegs: false,
  };
  switch (base) {
    case 'quadrupede':
      rec.size = 0.9 + r() * 0.9;
      rec.heads = chance(r, 0.15) ? 3 : chance(r, 0.1) ? 2 : 1;
      rec.horns = pick(r, ['nenhum', 'nenhum', 'chifres', 'bode', 'touro'] as const);
      rec.mane = surface === 'pelo' && chance(r, 0.4);
      rec.spikes = surface !== 'pelo' && chance(r, 0.5);
      rec.tail = pick(r, ['curta', 'longa', 'longa', 'serpente', 'clava', 'chamas'] as const);
      rec.wings = chance(r, 0.2) ? pick(r, ['morcego', 'penas'] as const) : 'nenhuma';
      rec.armor = chance(r, 0.15);
      break;
    case 'serpente':
      rec.size = 1 + r() * 1.2;
      rec.heads = chance(r, 0.2) ? 2 : 1;
      rec.horns = pick(r, ['nenhum', 'nenhum', 'chifres', 'coroa'] as const);
      rec.spikes = chance(r, 0.5);
      rec.wings = chance(r, 0.15) ? 'penas' : 'nenhuma';
      rec.tail = 'nenhuma';
      break;
    case 'hidra':
      rec.size = 1.1 + r() * 0.8;
      rec.heads = 3 + Math.floor(r() * 5);
      rec.spikes = chance(r, 0.6);
      rec.horns = pick(r, ['nenhum', 'chifres', 'coroa'] as const);
      rec.tail = pick(r, ['longa', 'serpente', 'clava'] as const);
      break;
    case 'aranha':
      rec.size = 0.7 + r() * 0.9;
      rec.legs = chance(r, 0.25) ? 6 : 8;
      rec.tail = chance(r, 0.35) ? 'escorpiao' : 'nenhuma';
      rec.armor = surface === 'bronze' || chance(r, 0.2);
      rec.spikes = chance(r, 0.3);
      break;
    case 'ave':
      rec.size = 0.9 + r() * 0.9;
      rec.wings = 'penas';
      rec.tail = 'longa';
      rec.horns = chance(r, 0.2) ? 'coroa' : 'nenhum';
      rec.armor = surface === 'bronze';
      break;
    case 'marinho':
      rec.size = 0.8 + r() * 0.8;
      rec.tail = 'longa';
      rec.spikes = chance(r, 0.4);
      rec.horns = chance(r, 0.2) ? 'coroa' : 'nenhum';
      break;
    case 'golem':
      rec.size = 1.2 + r() * 1.1;
      rec.tail = 'nenhuma';
      rec.armor = true;
      rec.glow = true;
      rec.spikes = chance(r, 0.3);
      break;
    case 'humanoide':
      rec.size = 0.9 + r() * 0.8;
      rec.body = pick(r, ['barbarian', 'barbarian', 'knight', 'rogue', 'mage', 'skeleton_warrior'] as const);
      rec.head = pick(r, ['normal', 'normal', 'touro', 'ciclope', 'serpentes', 'chamas', 'caveira'] as const);
      rec.horns = rec.head === 'normal' ? pick(r, ['nenhum', 'chifres', 'bode'] as const) : 'nenhum';
      rec.wings = chance(r, 0.25) ? pick(r, ['morcego', 'penas'] as const) : 'nenhuma';
      rec.tail = chance(r, 0.25) ? pick(r, ['serpente', 'curta', 'chamas'] as const) : 'nenhuma';
      rec.serpentLegs = rec.tail === 'serpente' && chance(r, 0.5);
      rec.weapon = pick(r, ['clava', 'machado_grande', 'espada_longa', 'lanca', 'martelo_guerra', 'adaga', 'nenhuma'] as const);
      rec.shield = rec.weapon === 'espada_longa' || rec.weapon === 'lanca' ? chance(r, 0.6) : false;
      // Pele: tons de pele humanos ou monstruosos
      rec.color = pick(r, ['#c58c6a', '#8a5a3a', '#e0b090', '#7fa36b', '#8a9bb0', '#5b4a6b', '#6b4423', color]);
      rec.accent = pick(r, ['#3a2a1a', '#7f1d1d', '#2e5a3a', '#3f3f46', '#1c1022', accent]);
      rec.belly = pick(r, ['#2a1a10', '#1d1410', '#f1d38a', '#3a2416', '#ff7a1a']);
      break;
  }
  if (rec.glow && rec.aura === 'nenhuma' && chance(r, 0.4)) rec.aura = pick(r, ['brasas', 'nevoa', 'raios', 'bolhas'] as const);
  rec.size = Math.round(rec.size * 100) / 100;
  return rec;
}

/** Semente aleatória curta e legível (como as dos mapas). */
export function randomFigureSeed(rng: Rng = Math.random): string {
  const syl = ['ka', 'lo', 'mi', 'tor', 'ze', 'ra', 'phi', 'dos', 'ne', 'ur', 'ax', 'the', 'bo', 'ly', 'kro'];
  return Array.from({ length: 3 }, () => syl[Math.floor(rng() * syl.length)]).join('') + Math.floor(rng() * 90 + 10);
}

export function parseFigureRecipe(x: unknown): FigureRecipe | null {
  const r = figureRecipeSchema.safeParse(x);
  return r.success ? r.data : null;
}
