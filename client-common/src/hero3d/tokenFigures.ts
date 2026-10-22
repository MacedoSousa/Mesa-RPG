/** Liga tokens do mapa às figuras 3D (carregado sob demanda pelo MapCanvas). */
import type { Token } from '@mesa/shared';
import { isPortraitSpec } from '../portrait';
import { getFigureAtlas, webglOk, type FigureAtlas } from './figureBaker';
import type { Figure } from './figure';
import { buildHeroFigure } from './heroKit';
import { buildFigureFromRecipe, buildMonsterFigure } from './monsters3d';

export { BAKE_STATES } from './figureBaker';
export type { FigureAtlas } from './figureBaker';
export { webglOk };

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/** Chave (mesma aparência = mesma folha de sprites) e receita da figura do token. */
export function figureFor(t: Token): { key: string; make: () => Promise<Figure> } | null {
  // Visual próprio da Oficina de bonecos (vale para monstros e NPCs)
  if (t.figure) {
    const rec = t.figure;
    return { key: `f:${hash(JSON.stringify(rec))}`, make: () => buildFigureFromRecipe(rec) };
  }
  if (t.kind === 'monstro') {
    const k = t.monsterKey;
    if (!k) return null;
    return { key: `m:${k}`, make: () => buildMonsterFigure(k) };
  }
  const look = t.look3d;
  if (!look) return null;
  const portrait = isPortraitSpec(t.face) ? t.face : null;
  const key = `h:${hash(JSON.stringify({ look, portrait }))}`;
  return {
    key,
    make: () => buildHeroFigure({ classKey: look.classKey, race: look.race, divinity: look.divinity, portrait, equipment: look.equipment, inventory: look.inventory }),
  };
}

export function atlasFor(t: Token, unitPx: number): { key: string; atlas: Promise<FigureAtlas | null> } | null {
  const f = figureFor(t);
  if (!f) return null;
  return { key: f.key, atlas: getFigureAtlas(`${f.key}@${unitPx}`, f.make, unitPx) };
}
