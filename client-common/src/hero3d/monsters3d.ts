/**
 * Bestiário 3D: cada espécie tem aparência fixa (como raças de monstros num RPG de PC).
 * Humanoides usam os esqueletos do KayKit com cores e adornos; feras são criaturas procedurais.
 */
import { MONSTERS, generateFigureRecipe, type FigureRecipe } from '@mesa/shared';
import { bullHead, cyclopsEye, featherTail, flameHair, glowingEyes, rigHorns, serpentTail, snakeHair, talons, tusks, wings } from './creatures';
import { buildRecipeCreature } from './creatureKit';
import { buildRigFigure, skinCells, type AtlasChange, type Figure, type ProcPart, type RigParts, type RigSpec } from './figure';

type Src = CanvasImageSource & { width: number; height: number };

/** Recolor padrão para corpos de aventureiro: pele, cabelo, olhos e roupa. */
function colors(o: { skin?: string; hair?: string; eyes?: string; outfit?: string; outfitCells?: [number, number][] }) {
  return (src: Src): AtlasChange[] => {
    const out: AtlasChange[] = [];
    if (o.skin) out.push({ cells: skinCells(src), color: o.skin });
    if (o.hair) out.push({ cells: [[1, 0]], color: o.hair });
    if (o.eyes) out.push({ cells: [[2, 0]], color: o.eyes });
    if (o.outfit && o.outfitCells) out.push({ cells: o.outfitCells, color: o.outfit });
    return out;
  };
}

const parts = (...fns: ((p: RigParts) => ProcPart | null | void)[]) => (p: RigParts) => fns.map((f) => f(p)).filter((x): x is ProcPart => !!x);

const RIG_MONSTERS: Record<string, RigSpec> = {
  esqueleto_spartoi: {
    body: 'skeleton_warrior', glowEyes: '#ff9a2a', headgear: true,
    weapons: { mainHand: 'espada_curta', shield: 'escudo_bronze' },
  },
  minotauro: {
    body: 'barbarian', headgear: false, scale: { h: 1.4, b: 1.15 }, style: 'brute',
    recolor: colors({ skin: '#6b4423', hair: '#2a1a10', eyes: '#3a0000', outfit: '#3a2a1a', outfitCells: [[0, 1], [1, 1], [2, 2]] }),
    weapons: { mainHand: 'machado_grande' },
    adorn: parts(bullHead, (p) => glowingEyes(p, '#ff3b1f')),
  },
  ciclope_selvagem: {
    body: 'barbarian', headgear: false, scale: { h: 1.65, b: 1.2 }, style: 'brute',
    hideEyes: true,
    recolor: colors({ skin: '#8a9bb0', hair: '#3a2a20', outfit: '#5a4a32', outfitCells: [[0, 1], [1, 1], [2, 2]] }),
    weapons: { mainHand: 'clava' },
    adorn: parts((p) => cyclopsEye(p, '#8a6a10')),
  },
  lestrigao: {
    body: 'barbarian', headgear: false, scale: { h: 1.5, b: 1.25 }, style: 'brute',
    recolor: colors({ skin: '#7d8b5a', hair: '#2a2416', eyes: '#2a0000', outfit: '#4a3a24', outfitCells: [[0, 1], [1, 1], [2, 2]] }),
    weapons: { mainHand: 'clava' },
    adorn: parts(tusks),
  },
  dracena: {
    body: 'rogue', headgear: false, hide: /_Leg/,
    recolor: colors({ skin: '#5f8f4e', hair: '#1f3d1a', eyes: '#d4a020', outfit: '#2e5a3a', outfitCells: [[0, 1], [1, 1], [1, 2]] }),
    weapons: { mainHand: 'lanca' },
    adorn: parts((p) => serpentTail(p, '#4f7a3a', { offsetX: -0.12, length: 1.8, thick: 0.17 }), (p) => serpentTail(p, '#4f7a3a', { offsetX: 0.12, length: 1.8, thick: 0.17 })),
  },
  empusa: {
    body: 'rogue', headgear: false, style: 'monk',
    recolor: colors({ skin: '#ece6f2', hair: '#ff7a1a', eyes: '#c00000', outfit: '#3a0d1a', outfitCells: [[0, 1], [1, 1], [1, 2]] }),
    adorn: parts(flameHair, (p) => glowingEyes(p, '#ff2a2a')),
  },
  gorgona: {
    body: 'mage', headgear: false, style: 'caster',
    recolor: colors({ skin: '#7fa36b', hair: '#2f4a22', eyes: '#d4a020', outfit: '#2e5e3a', outfitCells: [[0, 1], [1, 1], [7, 1]] }),
    weapons: { mainHand: 'adaga' },
    adorn: parts((p) => snakeHair(p, '#4f8a3a'), (p) => glowingEyes(p, '#ffd34d')),
  },
  erinia: {
    body: 'mage', headgear: false, style: 'caster',
    recolor: colors({ skin: '#5b4a6b', hair: '#1a1020', eyes: '#c00000', outfit: '#1c1022', outfitCells: [[0, 1], [1, 1], [7, 1]] }),
    adorn: parts((p) => wings(p, 'morcego', '#2a1f2f'), (p) => glowingEyes(p, '#ff2a2a')),
  },
  harpia: {
    body: 'rogue', headgear: false, style: 'monk',
    recolor: colors({ skin: '#d9b38c', hair: '#5a3a2a', eyes: '#d4a020', outfit: '#6b4f2a', outfitCells: [[0, 1], [1, 1], [1, 2]] }),
    adorn: parts((p) => wings(p, 'penas', '#8a6a4a', '#2e2014'), (p) => featherTail(p, '#7a5a3a'), (p) => talons(p)),
  },
  equidna: {
    body: 'mage', headgear: false, hide: /_Leg/, scale: { h: 1.35, b: 1.1 }, style: 'caster',
    recolor: colors({ skin: '#6f9a5a', hair: '#2b1a0f', eyes: '#d4a020', outfit: '#3d2b1a', outfitCells: [[0, 1], [1, 1], [7, 1]] }),
    adorn: parts((p) => serpentTail(p, '#4a6f3a', { length: 2.6, thick: 0.3, segments: 11 }), (p) => glowingEyes(p, '#ffd34d')),
  },
  procrustes: {
    body: 'knight', headgear: false, scale: { h: 1.35, b: 1.15 },
    recolor: colors({ skin: '#d6a98a', hair: '#3a2416', outfit: '#3f3f46', outfitCells: [[0, 1], [2, 2]] }),
    weapons: { mainHand: 'martelo_guerra' },
  },
  avatar_ares: {
    body: 'knight', headgear: true, scale: { h: 1.15, b: 1.08 },
    recolor: colors({ skin: '#c58c6a', hair: '#1d1410', eyes: '#ff2a00', outfit: '#7f1d1d', outfitCells: [[0, 1], [2, 2]] }),
    weapons: { mainHand: 'espada_longa+3', shield: 'escudo_bronze' },
    adorn: parts((p) => glowingEyes(p, '#ff3b00')),
  },
};

/** Receita fixa de cada fera do bestiário (mesmo gerador da Oficina de bonecos). */
const R = (base: FigureRecipe['base'], o: Partial<FigureRecipe>): FigureRecipe => ({ ...generateFigureRecipe(base, 'bestiario'), aura: 'nenhuma', spikes: false, mane: false, armor: false, wings: 'nenhuma', horns: 'nenhum', ...o });
const CREATURES: Record<string, { recipe: FigureRecipe; extras?: { goatHead?: boolean } }> = {
  cao_infernal: { recipe: R('quadrupede', { surface: 'pelo', color: '#1c1a1f', accent: '#2c2930', belly: '#3a3236', eyes: '#ff2a00', size: 1.15, glow: true, aura: 'brasas', tail: 'longa', heads: 1 }) },
  cerbero: { recipe: R('quadrupede', { surface: 'pelo', color: '#141216', accent: '#26222a', belly: '#2e2830', eyes: '#3bff8a', size: 1.9, glow: true, aura: 'brasas', tail: 'serpente', heads: 3, spikes: false, mane: true }) },
  quimera: { recipe: R('quadrupede', { surface: 'pelo', color: '#b88a4a', accent: '#7a4a1a', belly: '#e0c08a', eyes: '#ffb000', size: 1.45, glow: false, mane: true, tail: 'serpente', heads: 1 }), extras: { goatHead: true } },
  hidra_jovem: { recipe: R('hidra', { surface: 'escamas', color: '#3f7a4a', accent: '#2a4a2e', belly: '#c8c27a', eyes: '#ffe066', heads: 5, size: 1.25, spikes: true, tail: 'longa', glow: false }) },
  aranha_automato: { recipe: R('aranha', { surface: 'bronze', color: '#b8862e', accent: '#8a6420', belly: '#e8c98a', eyes: '#3bd6ff', size: 0.85, armor: true, tail: 'nenhuma', legs: 8, glow: true }) },
  telquine: { recipe: R('marinho', { surface: 'couro', color: '#5a6f80', accent: '#3d4f5e', belly: '#c9d6dc', eyes: '#9be7ff', size: 1.1, spikes: true, tail: 'longa', glow: false }) },
};

/** Espécies com modelo 3D próprio (as demais usam um esqueleto genérico). */
export const MONSTER_3D_KEYS = [...Object.keys(RIG_MONSTERS), ...Object.keys(CREATURES)];

/** Boneco humanoide montado pela receita (esqueleto KayKit + adornos). */
function rigFromRecipe(rec: FigureRecipe): RigSpec {
  const outfitCells: [number, number][] = rec.body === 'mage' ? [[0, 1], [1, 1], [7, 1]] : rec.body === 'knight' ? [[0, 1], [2, 2]] : [[0, 1], [1, 1], [2, 2]];
  const skeleton = rec.body.startsWith('skeleton') || rec.head === 'caveira';
  const adorn: ((p: RigParts) => ProcPart | null | void)[] = [];
  if (rec.head === 'touro') adorn.push(bullHead);
  if (rec.head === 'ciclope') adorn.push((p) => cyclopsEye(p, rec.eyes));
  if (rec.head === 'serpentes') adorn.push((p) => snakeHair(p, rec.accent));
  if (rec.head === 'chamas') adorn.push(flameHair);
  if (rec.horns !== 'nenhum' && rec.head !== 'touro') adorn.push((p) => rigHorns(p, rec.horns as 'chifres', rec.surface === 'bronze' ? '#d4a020' : '#e4d8bc'));
  if (rec.wings === 'morcego' || rec.wings === 'penas') adorn.push((p) => wings(p, rec.wings as 'morcego', rec.accent, rec.belly));
  if (rec.serpentLegs) adorn.push((p) => serpentTail(p, rec.color, { length: 2.4, thick: 0.28, segments: 10, belly: rec.belly }));
  else if (rec.tail === 'serpente') adorn.push((p) => serpentTail(p, rec.accent, { length: 1.4, thick: 0.1, segments: 8 }));
  else if (rec.tail === 'curta' || rec.tail === 'longa') adorn.push((p) => featherTail(p, rec.accent));
  if (rec.glow || skeleton) adorn.push((p) => glowingEyes(p, rec.eyes));
  return {
    body: skeleton ? (rec.body === 'skeleton_minion' ? 'skeleton_minion' : 'skeleton_warrior') : rec.body,
    headgear: false,
    hideEyes: rec.head === 'ciclope',
    hide: rec.serpentLegs ? /_Leg/ : undefined,
    scale: { h: rec.size, b: rec.size * (rec.body === 'barbarian' ? 1.1 : 1) },
    style: rec.body === 'mage' ? 'caster' : rec.body === 'rogue' ? 'monk' : rec.body === 'barbarian' ? 'brute' : undefined,
    recolor: skeleton ? undefined : colors({ skin: rec.color, hair: rec.belly, eyes: rec.eyes, outfit: rec.accent, outfitCells }),
    weapons: { mainHand: rec.weapon === 'nenhuma' ? null : rec.weapon, shield: rec.shield ? 'escudo_bronze' : null },
    adorn: parts(...adorn),
  } as RigSpec;
}

/** Monta qualquer receita da Oficina de bonecos. */
export async function buildFigureFromRecipe(rec: FigureRecipe): Promise<Figure> {
  if (rec.base === 'humanoide') return buildRigFigure(rigFromRecipe(rec));
  return buildRecipeCreature(rec);
}

/** Receita para começar a editar a partir de uma espécie do bestiário. */
export function defaultRecipeFor(key: string): FigureRecipe | null {
  return CREATURES[key]?.recipe ?? null;
}

export async function buildMonsterFigure(key: string): Promise<Figure> {
  if (CREATURES[key]) return buildRecipeCreature(CREATURES[key].recipe, CREATURES[key].extras);
  const spec = RIG_MONSTERS[key];
  if (spec) return buildRigFigure(spec);
  // Monstro sem visual próprio: esqueleto genérico, maior conforme o tamanho
  const size = MONSTERS[key]?.size;
  const s = size === 'enorme' ? 1.6 : size === 'grande' ? 1.3 : size === 'pequeno' ? 0.8 : 1;
  return buildRigFigure({ body: 'skeleton_minion', glowEyes: '#ff4040', scale: { h: s, b: s } });
}
