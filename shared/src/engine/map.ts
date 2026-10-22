import type { Element } from '../content/divinities';
import type { DamageType } from '../content/items';
import { roll } from '../dice';
import type { EngineContext } from './context';
import { addCondition, damageToken, removeCondition, savingThrow, tokenAt } from './tokens';
import type { MapState, ObjectType, SurfaceType, TableState, TerrainType, Tile, Token } from './types';

// ───────────────────────────── Definições ─────────────────────────────

export interface TerrainDef {
  label: string;
  color: number;
  walkable: boolean;
  moveCost: number;
  blocksSight: boolean;
  elevation: number;
  liquid?: boolean;
  /** Dano ao terminar/entrar (ex.: lava). */
  hazard?: { damage: string; type: DamageType };
  maxHp?: number;
  destroyedInto?: TerrainType;
  flammable?: boolean;
  /** Ao queimar até o fim, vira este terreno. */
  burnsInto?: TerrainType;
}

export const TERRAIN: Record<TerrainType, TerrainDef> = {
  grama: { label: 'Grama', color: 0x5c9a3c, walkable: true, moveCost: 1, blocksSight: false, elevation: 0, flammable: true, burnsInto: 'terra' },
  terra: { label: 'Terra', color: 0x8a6a45, walkable: true, moveCost: 1, blocksSight: false, elevation: 0 },
  pedra: { label: 'Piso de Pedra', color: 0x6f6f78, walkable: true, moveCost: 1, blocksSight: false, elevation: 0 },
  areia: { label: 'Areia', color: 0xd8c28a, walkable: true, moveCost: 1, blocksSight: false, elevation: 0 },
  marmore: { label: 'Mármore', color: 0xe6e2d8, walkable: true, moveCost: 1, blocksSight: false, elevation: 0 },
  nuvem: { label: 'Nuvem Sólida', color: 0xf4f7fb, walkable: true, moveCost: 1, blocksSight: false, elevation: 0 },
  madeira: { label: 'Assoalho', color: 0x9b6b3c, walkable: true, moveCost: 1, blocksSight: false, elevation: 0, flammable: true, maxHp: 10, destroyedInto: 'escombros', burnsInto: 'escombros' },
  agua_rasa: { label: 'Água Rasa', color: 0x5ea7d6, walkable: true, moveCost: 2, blocksSight: false, elevation: 0, liquid: true },
  agua_profunda: { label: 'Água Profunda', color: 0x23628f, walkable: false, moveCost: 99, blocksSight: false, elevation: 0, liquid: true },
  lava: { label: 'Lava', color: 0xe2501d, walkable: false, moveCost: 99, blocksSight: false, elevation: 0, hazard: { damage: '6d10', type: 'fogo' } },
  abismo: { label: 'Abismo', color: 0x0d0d12, walkable: false, moveCost: 99, blocksSight: false, elevation: -9 },
  estige: { label: 'Rio Estige', color: 0x2e2445, walkable: false, moveCost: 99, blocksSight: false, elevation: 0, liquid: true, hazard: { damage: '4d6', type: 'necrotico' } },
  parede: { label: 'Parede', color: 0x3d3a40, walkable: false, moveCost: 99, blocksSight: true, elevation: 2, maxHp: 30, destroyedInto: 'escombros' },
  coluna: { label: 'Coluna', color: 0xcfc8b8, walkable: false, moveCost: 99, blocksSight: true, elevation: 2, maxHp: 25, destroyedInto: 'escombros' },
  arvore: { label: 'Árvore', color: 0x2f6b2a, walkable: false, moveCost: 99, blocksSight: true, elevation: 2, maxHp: 12, flammable: true, destroyedInto: 'toco', burnsInto: 'toco' },
  toco: { label: 'Toco', color: 0x6b4f2a, walkable: true, moveCost: 2, blocksSight: false, elevation: 0 },
  escombros: { label: 'Escombros', color: 0x7d746a, walkable: true, moveCost: 2, blocksSight: false, elevation: 0 },
  ponte: { label: 'Ponte de Madeira', color: 0xa77b47, walkable: true, moveCost: 1, blocksSight: false, elevation: 0, maxHp: 15, flammable: true, destroyedInto: 'agua_profunda', burnsInto: 'agua_profunda' },
  portao: { label: 'Portão', color: 0x7a5230, walkable: false, moveCost: 99, blocksSight: true, elevation: 1, maxHp: 18, flammable: true, destroyedInto: 'terra', burnsInto: 'terra' },
  elevado: { label: 'Plataforma Elevada', color: 0x9c9488, walkable: true, moveCost: 1, blocksSight: false, elevation: 1 },
};

export interface SurfaceDef {
  label: string;
  color: number;
  alpha: number;
  duration: number;
  difficult?: boolean;
  blocksSight?: boolean;
  damage?: { formula: string; type: DamageType };
  /** Teste para evitar a condição ao entrar/começar o turno. */
  save?: { ability: 'destreza' | 'constituicao'; dc: number; condition: 'caido' | 'envenenado' | 'atordoado' };
  applies?: 'molhado';
  flammable?: boolean;
}

export const SURFACES: Record<SurfaceType, SurfaceDef> = {
  fogo: { label: 'Fogo', color: 0xff6a00, alpha: 0.55, duration: 3, damage: { formula: '1d4', type: 'fogo' } },
  agua: { label: 'Água', color: 0x4aa8ff, alpha: 0.4, duration: 5, applies: 'molhado' },
  agua_eletrificada: { label: 'Água Eletrificada', color: 0x8fe3ff, alpha: 0.6, duration: 2, damage: { formula: '1d6', type: 'eletrico' }, applies: 'molhado' },
  gelo: { label: 'Gelo', color: 0xc9f1ff, alpha: 0.6, duration: 4, difficult: true, save: { ability: 'destreza', dc: 10, condition: 'caido' } },
  oleo: { label: 'Óleo', color: 0x3a2f12, alpha: 0.55, duration: 6, difficult: true, flammable: true, save: { ability: 'destreza', dc: 10, condition: 'caido' } },
  veneno: { label: 'Névoa Venenosa', color: 0x7bd14a, alpha: 0.45, duration: 3, damage: { formula: '1d4', type: 'veneno' }, save: { ability: 'constituicao', dc: 11, condition: 'envenenado' } },
  vapor: { label: 'Vapor', color: 0xdddddd, alpha: 0.5, duration: 2, blocksSight: true },
};

export interface ObjectDef {
  label: string;
  color: number;
  maxHp: number;
  blocksMovement: boolean;
  blocksSight: boolean;
  /** O que acontece quando é destruído. */
  onDestroy?: { explode?: { radius: number; damage: string; type: DamageType }; surface?: { type: SurfaceType; radius: number }; terrain?: TerrainType };
  flammable?: boolean;
}

export const OBJECTS: Record<ObjectType, ObjectDef> = {
  barril_explosivo: { label: 'Barril de Pólvora Grega', color: 0xb3261e, maxHp: 4, blocksMovement: true, blocksSight: false, flammable: true, onDestroy: { explode: { radius: 1, damage: '3d6', type: 'fogo' }, surface: { type: 'fogo', radius: 1 } } },
  barril_agua: { label: 'Barril de Água', color: 0x2f7fc1, maxHp: 4, blocksMovement: true, blocksSight: false, onDestroy: { surface: { type: 'agua', radius: 1 } } },
  barril_oleo: { label: 'Barril de Óleo', color: 0x4a3b14, maxHp: 4, blocksMovement: true, blocksSight: false, flammable: true, onDestroy: { surface: { type: 'oleo', radius: 1 } } },
  caixote: { label: 'Caixote', color: 0xa0743c, maxHp: 8, blocksMovement: true, blocksSight: false, flammable: true },
  estatua: { label: 'Estátua', color: 0xd9d4c7, maxHp: 30, blocksMovement: true, blocksSight: true, onDestroy: { terrain: 'escombros' } },
  braseiro: { label: 'Braseiro', color: 0xffa040, maxHp: 10, blocksMovement: true, blocksSight: false, onDestroy: { surface: { type: 'fogo', radius: 0 } } },
  // Baús não quebram: o tesouro só sai abrindo (ação "Abrir baú" ao lado dele)
  bau: { label: 'Baú de Tesouro', color: 0x9a6b2f, maxHp: 999, blocksMovement: true, blocksSight: false },
  bau_aberto: { label: 'Baú Aberto', color: 0x5b4220, maxHp: 999, blocksMovement: true, blocksSight: false },
  // Espólio que um monstro derrotado deixa cair (some ao ser recolhido)
  espolio: { label: 'Espólio', color: 0x8a6a3a, maxHp: 999, blocksMovement: false, blocksSight: false },
};

export function isChest(type: ObjectType | undefined): boolean {
  return type === 'bau' || type === 'bau_aberto' || type === 'espolio';
}

// ───────────────────────────── Acesso ao grid ─────────────────────────────

export function inBounds(map: MapState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

export function tileAt(map: MapState, x: number, y: number): Tile | undefined {
  return inBounds(map, x, y) ? map.tiles[y * map.width + x] : undefined;
}

export function createBlankMap(width: number, height: number, terrain: TerrainType = 'grama', name = 'Mapa em branco'): MapState {
  return { id: null, name, preset: null, width, height, tiles: Array.from({ length: width * height }, () => ({ t: terrain })) };
}

/** Água profunda congelada vira caminho (como no BG3). */
export function isWalkableTile(tile: Tile): boolean {
  const def = TERRAIN[tile.t];
  // Objeto escondido não bloqueia (senão os jogadores descobririam esbarrando nele)
  if (tile.o && !tile.o.hidden && OBJECTS[tile.o.type].blocksMovement) return false;
  if (!def.walkable) return def.liquid === true && tile.s?.type === 'gelo';
  return true;
}

export function moveCost(tile: Tile): number {
  let cost = TERRAIN[tile.t].moveCost;
  if (!TERRAIN[tile.t].walkable && tile.s?.type === 'gelo') cost = 2;
  if (tile.s && SURFACES[tile.s.type].difficult) cost = Math.max(cost, 2);
  return cost;
}

export function tileBlocksSight(tile: Tile): boolean {
  if (TERRAIN[tile.t].blocksSight) return true;
  if (tile.o && OBJECTS[tile.o.type].blocksSight) return true;
  if (tile.s && SURFACES[tile.s.type].blocksSight) return true;
  return false;
}

export function elevationAt(map: MapState, x: number, y: number): number {
  const tile = tileAt(map, x, y);
  return tile ? TERRAIN[tile.t].elevation : 0;
}

export function cellsInRadius(map: MapState, cx: number, cy: number, radius: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) if (inBounds(map, x, y)) out.push({ x, y });
  }
  return out;
}

// ───────────────────────────── Superfícies e elementos ─────────────────────────────

export interface ElementResult {
  surface: SurfaceType | null;
  ignite?: boolean;
  terrain?: TerrainType;
}

/**
 * Tabela de interações (inspirada nas reações de superfície do BG3):
 *  fogo + água = vapor · fogo + gelo = água · fogo + óleo/veneno = explosão de fogo
 *  raio + água = água eletrificada · gelo + água = gelo · água + fogo = vapor
 *  água sobre lava = vapor e a lava esfria em pedra
 */
export function elementReaction(tile: Tile, element: Element): ElementResult {
  const current = tile.s?.type ?? null;
  const def = TERRAIN[tile.t];

  switch (element) {
    case 'fogo':
      if (current === 'agua' || current === 'agua_eletrificada') return { surface: 'vapor' };
      if (current === 'gelo') return { surface: 'agua' };
      if (current === 'oleo' || current === 'veneno') return { surface: 'fogo', ignite: true };
      if (current === 'vapor') return { surface: 'vapor' };
      if (def.liquid) return { surface: 'vapor' };
      return { surface: 'fogo' };
    case 'agua':
      if (tile.t === 'lava') return { surface: 'vapor', terrain: 'pedra' };
      if (current === 'fogo') return { surface: 'vapor' };
      if (current === 'agua_eletrificada') return { surface: 'agua_eletrificada' };
      return { surface: 'agua' };
    case 'raio':
      if (current === 'agua' || current === 'agua_eletrificada' || (def.liquid && !current)) return { surface: 'agua_eletrificada' };
      return { surface: current };
    case 'gelo':
      if (current === 'fogo') return { surface: null };
      if (current === 'vapor') return { surface: null };
      if (tile.t === 'lava') return { surface: null, terrain: 'pedra' };
      return { surface: 'gelo' };
    case 'veneno':
      if (current === 'fogo') return { surface: 'fogo', ignite: true };
      if (def.liquid || current === 'agua') return { surface: 'veneno' };
      return { surface: 'veneno' };
    case 'oleo':
      if (current === 'fogo') return { surface: 'fogo', ignite: true };
      if (def.liquid && !TERRAIN[tile.t].walkable) return { surface: current };
      return { surface: 'oleo' };
  }
}

function setSurface(tile: Tile, type: SurfaceType | null) {
  tile.s = type ? { type, rounds: SURFACES[type].duration } : null;
}

/** Aplica um elemento numa área: reage com superfícies, terreno, objetos e tokens. */
export function applyElementArea(
  ctx: EngineContext,
  cx: number,
  cy: number,
  radius: number,
  element: Element,
  opts: { damage?: string; damageType?: DamageType; saveDc?: number; source?: string; depth?: number } = {},
) {
  const { state } = ctx;
  const map = state.map;
  const depth = opts.depth ?? 0;
  const cells = cellsInRadius(map, cx, cy, radius);
  const ignitions: { x: number; y: number }[] = [];

  for (const { x, y } of cells) {
    const tile = tileAt(map, x, y)!;
    const res = elementReaction(tile, element);
    if (res.terrain) {
      tile.t = res.terrain;
      delete tile.hp;
    }
    setSurface(tile, res.surface);
    if (res.ignite) ignitions.push({ x, y });

    // Fogo queima terreno/objetos inflamáveis
    if (element === 'fogo') {
      if (TERRAIN[tile.t].flammable && TERRAIN[tile.t].maxHp) damageTile(ctx, x, y, 6, 'fogo', depth + 1);
      if (tile.o && OBJECTS[tile.o.type].flammable) damageObject(ctx, x, y, 6, 'fogo', depth + 1);
    }
  }
  ctx.emit({ type: 'superficie', x: cx, y: cy, radius, surface: element === 'raio' ? 'agua_eletrificada' : (tileAt(map, cx, cy)?.s?.type ?? null) });

  // Dano direto do elemento nos tokens da área (com teste de DES para metade)
  if (opts.damage) {
    const dmgType = opts.damageType ?? elementDamageType(element);
    for (const { x, y } of cells) {
      const t = tokenAt(state, x, y);
      if (!t) continue;
      const r = roll(opts.damage, ctx.rng).total;
      const saved = opts.saveDc ? savingThrow(ctx, t, 'destreza', opts.saveDc) : false;
      const dealt = damageToken(ctx, t, saved ? Math.floor(r / 2) : r, dmgType, opts.source ?? element);
      ctx.log(`${t.name} sofre ${dealt} de dano (${dmgType})${saved ? ' — passou no teste, metade' : ''}`, { type: 'combate' });
    }
  }

  // Ao pisar na nova superfície, tokens recebem a condição (água → molhado)
  for (const { x, y } of cells) {
    const t = tokenAt(state, x, y);
    if (t) applySurfaceStatus(ctx, t, tileAt(map, x, y)!);
  }

  // Óleo/veneno em chamas explodem (em cadeia, com limite de profundidade)
  if (ignitions.length && depth < 4) {
    for (const p of ignitions) {
      explode(ctx, p.x, p.y, 1, '2d6', 'fogo', 'Combustão', depth + 1);
    }
  }
}

export function elementDamageType(element: Element): DamageType {
  switch (element) {
    case 'fogo': return 'fogo';
    case 'raio': return 'eletrico';
    case 'gelo': return 'frio';
    case 'veneno': return 'veneno';
    case 'agua': return 'concussao';
    case 'oleo': return 'concussao';
  }
}

/** Condições "passivas" de estar sobre uma superfície (sem dano). */
export function applySurfaceStatus(ctx: EngineContext, t: Token, tile: Tile) {
  const s = tile.s ? SURFACES[tile.s.type] : null;
  if (s?.applies === 'molhado') addCondition(t, 'molhado');
  if (tile.s?.type === 'fogo') removeCondition(t, 'molhado');
  void ctx;
}

/** Efeitos ao entrar numa casa ou começar o turno nela. Retorna true se o token caiu (interrompe movimento). */
export function surfaceEffects(ctx: EngineContext, t: Token, reason: 'entrar' | 'inicio_turno'): boolean {
  const tile = tileAt(ctx.state.map, t.x, t.y);
  if (!tile) return false;
  let fell = false;

  const hazard = TERRAIN[tile.t].hazard;
  if (hazard) {
    const dmg = roll(hazard.damage, ctx.rng).total;
    const dealt = damageToken(ctx, t, dmg, hazard.type, TERRAIN[tile.t].label);
    ctx.log(`${t.name} sofre ${dealt} de dano por ${TERRAIN[tile.t].label}!`, { type: 'combate' });
  }

  if (tile.s) {
    const def = SURFACES[tile.s.type];
    applySurfaceStatus(ctx, t, tile);
    if (def.damage) {
      const dmg = roll(def.damage.formula, ctx.rng).total;
      const dealt = damageToken(ctx, t, dmg, def.damage.type, def.label);
      ctx.log(`${t.name} sofre ${dealt} de dano (${def.label})`, { type: 'combate' });
    }
    if (def.save && !t.dead) {
      const ok = savingThrow(ctx, t, def.save.ability, def.save.dc, def.save.condition);
      if (!ok) {
        addCondition(t, def.save.condition);
        if (def.save.condition === 'caido') fell = true;
        ctx.log(`${t.name} ${def.save.condition === 'caido' ? 'escorrega e cai' : `fica ${def.save.condition}`} (${def.label})`, { type: 'combate' });
      }
    }
  }
  void reason;
  return fell;
}

/** Fim de rodada: superfícies perdem duração; fogo consome terreno inflamável. */
export function decaySurfaces(ctx: EngineContext) {
  const map = ctx.state.map;
  for (let i = 0; i < map.tiles.length; i++) {
    const tile = map.tiles[i];
    if (!tile.s) continue;
    tile.s.rounds -= 1;
    if (tile.s.rounds <= 0) {
      const wasFire = tile.s.type === 'fogo';
      tile.s = null;
      const def = TERRAIN[tile.t];
      if (wasFire && def.flammable && def.burnsInto && !def.maxHp) tile.t = def.burnsInto;
    }
  }
}

// ───────────────────────────── Destruição ─────────────────────────────

const TERRAIN_IMMUNE: DamageType[] = ['veneno', 'psiquico', 'necrotico', 'radiante'];

/** Causa dano a um terreno destrutível (parede, árvore, ponte...). Retorna true se destruiu. */
export function damageTile(ctx: EngineContext, x: number, y: number, amount: number, type: DamageType, depth = 0): boolean {
  const map = ctx.state.map;
  const tile = tileAt(map, x, y);
  if (!tile) return false;
  if (tile.o) return damageObject(ctx, x, y, amount, type, depth);

  const def = TERRAIN[tile.t];
  if (!def.maxHp) return false;
  if (TERRAIN_IMMUNE.includes(type)) return false;
  if (type === 'fogo' && !def.flammable) return false;

  const dmg = type === 'fogo' && def.flammable ? amount * 2 : amount;
  tile.hp = (tile.hp ?? def.maxHp) - dmg;
  if (tile.hp > 0) return false;

  const before = def.label;
  tile.t = def.destroyedInto ?? 'escombros';
  delete tile.hp;
  if (type === 'fogo' && def.flammable) setSurface(tile, TERRAIN[tile.t].liquid ? 'vapor' : 'fogo');
  ctx.emit({ type: 'destruicao', x, y });
  ctx.log(`${before} em (${x}, ${y}) foi destruída e virou ${TERRAIN[tile.t].label}!`, { type: 'mapa' });

  // Quem estava sobre a ponte cai na água
  const t = tokenAt(ctx.state, x, y);
  if (t && !isWalkableTile(tile)) fallInto(ctx, t, tile);
  return true;
}

export function damageObject(ctx: EngineContext, x: number, y: number, amount: number, type: DamageType, depth = 0): boolean {
  const tile = tileAt(ctx.state.map, x, y);
  if (!tile?.o) return false;
  const def = OBJECTS[tile.o.type];
  if (isChest(tile.o.type)) return false;
  if (type === 'fogo' && !def.flammable && tile.o.type !== 'braseiro') return false;
  tile.o.hp -= amount;
  if (tile.o.hp > 0) return false;

  tile.o = null;
  ctx.emit({ type: 'destruicao', x, y });
  ctx.log(`${def.label} em (${x}, ${y}) foi destruído!`, { type: 'mapa' });
  const d = def.onDestroy;
  if (d?.terrain) tile.t = d.terrain;
  if (d?.surface) {
    for (const c of cellsInRadius(ctx.state.map, x, y, d.surface.radius)) {
      const ct = tileAt(ctx.state.map, c.x, c.y)!;
      if (TERRAIN[ct.t].walkable || TERRAIN[ct.t].liquid) setSurface(ct, d.surface.type);
    }
    ctx.emit({ type: 'superficie', x, y, radius: d.surface.radius, surface: d.surface.type });
  }
  if (d?.explode && depth < 5) explode(ctx, x, y, d.explode.radius, d.explode.damage, d.explode.type, def.label, depth + 1);
  return true;
}

/** Explosão: dano em tokens, terreno e objetos (reação em cadeia de barris). */
export function explode(ctx: EngineContext, cx: number, cy: number, radius: number, damage: string, type: DamageType, source: string, depth = 0) {
  ctx.emit({ type: 'explosao', x: cx, y: cy, radius });
  ctx.log(`💥 Explosão (${source}) em (${cx}, ${cy})!`, { type: 'mapa' });
  const total = roll(damage, ctx.rng).total;
  for (const { x, y } of cellsInRadius(ctx.state.map, cx, cy, radius)) {
    const t = tokenAt(ctx.state, x, y);
    if (t) {
      const saved = savingThrow(ctx, t, 'destreza', 13);
      const dealt = damageToken(ctx, t, saved ? Math.floor(total / 2) : total, type, source);
      ctx.log(`${t.name} sofre ${dealt} de dano da explosão${saved ? ' (metade)' : ''}`, { type: 'combate' });
    }
    if (x === cx && y === cy) continue;
    const tile = tileAt(ctx.state.map, x, y)!;
    if (tile.o) damageObject(ctx, x, y, total, type, depth + 1);
    else damageTile(ctx, x, y, Math.ceil(total / 2), 'concussao', depth + 1);
  }
}

/** Token empurrado ou com o chão destruído cai em água/lava/abismo. */
export function fallInto(ctx: EngineContext, t: Token, tile: Tile) {
  const def = TERRAIN[tile.t];
  if (tile.t === 'abismo') {
    const dmg = roll('6d6', ctx.rng).total;
    ctx.log(`${t.name} despenca no abismo!`, { type: 'combate' });
    damageToken(ctx, t, dmg, 'concussao', 'Queda');
    return;
  }
  if (def.hazard) {
    const dmg = roll(def.hazard.damage, ctx.rng).total;
    ctx.log(`${t.name} cai em ${def.label}!`, { type: 'combate' });
    damageToken(ctx, t, dmg, def.hazard.type, def.label);
    return;
  }
  if (def.liquid) {
    addCondition(t, 'molhado');
    addCondition(t, 'caido');
    ctx.log(`${t.name} cai na ${def.label} e sai encharcado!`, { type: 'combate' });
  }
}
