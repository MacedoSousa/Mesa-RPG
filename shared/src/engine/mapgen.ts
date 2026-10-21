/**
 * Geração procedural de mapas (determinística por semente).
 * Técnicas: ruído fBm (valor suavizado), autômato celular para cavernas, BSP para interiores,
 * rios por caminhada com ruído e espalhamento tipo disco de Poisson para árvores e objetos.
 * O resultado é um MapState comum — o terreno continua destrutível e o grid tático não muda.
 */
import { seededRng, type Rng } from '../dice';
import { OBJECTS } from './map';
import type { MapMood, MapState, ObjectType, TerrainType, Tile } from './types';

export const MAP_KINDS = {
  floresta: { label: 'Floresta e clareira', mood: 'dia' },
  caverna: { label: 'Caverna', mood: 'caverna' },
  submundo: { label: 'Cavernas do Submundo (lava e Estige)', mood: 'submundo' },
  templo: { label: 'Templo nas nuvens', mood: 'olimpo' },
  rio: { label: 'Rio com pontes', mood: 'dia' },
  praia: { label: 'Praia e píer', mood: 'dia' },
  interior: { label: 'Interior (loja, casa, palácio)', mood: 'noite' },
  estrada: { label: 'Estrada e posto', mood: 'dia' },
} as const satisfies Record<string, { label: string; mood: MapMood }>;

export type MapKind = keyof typeof MAP_KINDS;
export const MAP_KIND_KEYS = Object.keys(MAP_KINDS) as MapKind[];

// ───────────── Ruído ─────────────

/** Ruído de valor 2D com interpolação suave, semeado. Retorna função (x,y) → [0,1]. */
export function valueNoise2D(rng: Rng, size = 256) {
  const perm = Array.from({ length: size }, (_, i) => i);
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const vals = Array.from({ length: size }, () => rng());
  const at = (x: number, y: number) => vals[perm[(perm[((x % size) + size) % size] + (((y % size) + size) % size)) % size]];
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = fade(x - xi);
    const ty = fade(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
}

/** fBm: soma de oitavas (frequência dobra, amplitude cai pela metade), normalizada para [0,1]. */
export function fbm(noise: (x: number, y: number) => number, x: number, y: number, octaves = 4) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

/** Hash determinístico de coordenadas (decoração, variações de textura). */
export function cellHash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ───────────── Utilidades de grade ─────────────

class Grid {
  tiles: Tile[];
  constructor(public w: number, public h: number, fill: TerrainType) {
    this.tiles = Array.from({ length: w * h }, () => ({ t: fill }));
  }
  in(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
  get(x: number, y: number) {
    return this.tiles[y * this.w + x];
  }
  set(x: number, y: number, t: TerrainType) {
    if (this.in(x, y)) this.tiles[y * this.w + x] = { t };
  }
  obj(x: number, y: number, type: ObjectType) {
    if (!this.in(x, y)) return;
    const tile = this.get(x, y);
    tile.o = { type, hp: OBJECTS[type].maxHp };
  }
  rect(x0: number, y0: number, x1: number, y1: number, t: TerrainType) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, t);
  }
}

const WALKABLE_GROUND: TerrainType[] = ['grama', 'terra', 'pedra', 'areia', 'marmore', 'nuvem', 'madeira', 'escombros', 'elevado'];

/** Espalha objetos/árvores com distância mínima (aproximação de disco de Poisson por grade jitterizada). */
function scatter(g: Grid, rng: Rng, spacing: number, accept: (x: number, y: number) => boolean, place: (x: number, y: number) => void) {
  const placed: { x: number; y: number }[] = [];
  for (let gy = 0; gy < g.h; gy += spacing) {
    for (let gx = 0; gx < g.w; gx += spacing) {
      const x = Math.min(g.w - 1, gx + Math.floor(rng() * spacing));
      const y = Math.min(g.h - 1, gy + Math.floor(rng() * spacing));
      if (!accept(x, y)) continue;
      if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < spacing * 0.8)) continue;
      placed.push({ x, y });
      place(x, y);
    }
  }
}

/** Caminho sinuoso de um lado ao outro (trilha, estrada ou rio). */
function carve(g: Grid, rng: Rng, opts: { vertical?: boolean; width: number; terrain: TerrainType; edge?: TerrainType; wander: number; keep?: (t: TerrainType) => boolean }) {
  const len = opts.vertical ? g.h : g.w;
  const span = opts.vertical ? g.w : g.h;
  const noise = valueNoise2D(rng);
  let pos = span * (0.35 + rng() * 0.3);
  const path: number[] = [];
  for (let i = 0; i < len; i++) {
    pos += (noise(i * 0.15, 3.7) - 0.5) * opts.wander;
    pos = Math.max(opts.width + 1, Math.min(span - opts.width - 2, pos));
    path.push(pos);
    for (let k = -opts.width - 1; k <= opts.width + 1; k++) {
      const p = Math.round(pos + k);
      const [x, y] = opts.vertical ? [p, i] : [i, p];
      if (!g.in(x, y)) continue;
      const inside = Math.abs(k) <= opts.width;
      if (opts.keep && opts.keep(g.get(x, y).t)) continue;
      if (inside) g.set(x, y, opts.terrain);
      else if (opts.edge && g.get(x, y).t !== opts.terrain) g.set(x, y, opts.edge);
    }
  }
  return path;
}

function floodLargest(g: Grid, isOpen: (t: TerrainType) => boolean, closeWith: TerrainType) {
  const seen = new Uint8Array(g.w * g.h);
  let best: number[] = [];
  for (let i = 0; i < g.tiles.length; i++) {
    if (seen[i] || !isOpen(g.tiles[i].t)) continue;
    const region: number[] = [];
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      region.push(c);
      const x = c % g.w;
      const y = Math.floor(c / g.w);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (!g.in(nx, ny)) continue;
        const ni = ny * g.w + nx;
        if (seen[ni] || !isOpen(g.tiles[ni].t)) continue;
        seen[ni] = 1;
        stack.push(ni);
      }
    }
    if (region.length > best.length) best = region;
  }
  const keep = new Set(best);
  for (let i = 0; i < g.tiles.length; i++) if (isOpen(g.tiles[i].t) && !keep.has(i)) g.tiles[i] = { t: closeWith };
  return best;
}

// ───────────── Receitas ─────────────

function forest(g: Grid, rng: Rng) {
  const elev = valueNoise2D(rng);
  const moist = valueNoise2D(rng);
  const cx = g.w / 2;
  const cy = g.h / 2;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const e = fbm(elev, x / 9, y / 9);
      const m = fbm(moist, x / 7 + 50, y / 7 + 50);
      const clearing = Math.hypot(x - cx, y - cy) < Math.min(g.w, g.h) * 0.22;
      if (e < 0.3 && !clearing) g.set(x, y, e < 0.24 ? 'agua_profunda' : 'agua_rasa');
      else g.set(x, y, m < 0.38 ? 'terra' : 'grama');
    }
  }
  carve(g, rng, { width: 0, terrain: 'terra', wander: 1.6, keep: (t) => t === 'agua_profunda' });
  scatter(g, rng, 2, (x, y) => {
    const t = g.get(x, y).t;
    const clearing = Math.hypot(x - cx, y - cy) < Math.min(g.w, g.h) * 0.24;
    return t === 'grama' && !clearing && fbm(moist, x / 7 + 50, y / 7 + 50) > 0.45;
  }, (x, y) => g.set(x, y, 'arvore'));
  // Fogueira e caixotes na clareira
  g.obj(Math.floor(cx), Math.floor(cy), 'braseiro');
  scatter(g, rng, 6, (x, y) => g.get(x, y).t === 'terra' && !g.get(x, y).o && rng() < 0.35, (x, y) => g.obj(x, y, rng() < 0.5 ? 'caixote' : 'barril_agua'));
}

function cave(g: Grid, rng: Rng, underworld: boolean) {
  for (let i = 0; i < g.tiles.length; i++) g.tiles[i] = { t: rng() < 0.47 ? 'parede' : 'pedra' };
  const wallsAround = (x: number, y: number, r: number) => {
    let n = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (!g.in(nx, ny) || g.get(nx, ny).t === 'parede') n++;
    }
    return n;
  };
  // Regra 4-5 com segundo raio nas primeiras iterações (evita salões gigantes vazios)
  for (let it = 0; it < 5; it++) {
    const next = g.tiles.map((t) => ({ ...t }));
    for (let y = 0; y < g.h; y++) {
      for (let x = 0; x < g.w; x++) {
        const r1 = wallsAround(x, y, 1);
        const r2 = wallsAround(x, y, 2);
        const wall = it < 3 ? r1 >= 5 || r2 <= 2 : r1 >= 5;
        next[y * g.w + x] = { t: wall ? 'parede' : 'pedra' };
      }
    }
    g.tiles = next;
  }
  for (let x = 0; x < g.w; x++) {
    g.set(x, 0, 'parede');
    g.set(x, g.h - 1, 'parede');
  }
  for (let y = 0; y < g.h; y++) {
    g.set(0, y, 'parede');
    g.set(g.w - 1, y, 'parede');
  }
  floodLargest(g, (t) => t !== 'parede', 'parede');
  const pools = valueNoise2D(rng);
  for (let y = 1; y < g.h - 1; y++) {
    for (let x = 1; x < g.w - 1; x++) {
      if (g.get(x, y).t !== 'pedra') continue;
      const n = fbm(pools, x / 6, y / 6, 3);
      if (underworld) {
        if (n > 0.72) g.set(x, y, 'lava');
        else if (n < 0.2) g.set(x, y, 'estige');
      } else if (n > 0.74) g.set(x, y, 'agua_rasa');
      else if (n < 0.18) g.set(x, y, 'escombros');
    }
  }
  floodLargest(g, (t) => WALKABLE_GROUND.includes(t) || t === 'agua_rasa', underworld ? 'lava' : 'parede');
  // Pilares de rocha quebram os salões grandes (cobertura tática)
  scatter(g, rng, 5, (x, y) => {
    if (g.get(x, y).t !== 'pedra') return false;
    let open = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (g.in(x + dx, y + dy) && g.get(x + dx, y + dy).t === 'pedra') open++;
    return open >= 24 && rng() < 0.6;
  }, (x, y) => {
    g.set(x, y, 'parede');
    if (rng() < 0.5 && g.in(x + 1, y) && g.get(x + 1, y).t === 'pedra') g.set(x + 1, y, 'parede');
  });
  scatter(g, rng, 7, (x, y) => g.get(x, y).t === 'pedra' && !g.get(x, y).o, (x, y) => g.obj(x, y, underworld ? 'braseiro' : rng() < 0.5 ? 'caixote' : 'braseiro'));
  if (underworld) scatter(g, rng, 6, (x, y) => g.get(x, y).t === 'pedra' && !g.get(x, y).o && rng() < 0.4, (x, y) => g.set(x, y, 'coluna'));
}

function temple(g: Grid, rng: Rng) {
  const cx = g.w / 2;
  const cy = g.h / 2;
  const noise = valueNoise2D(rng);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const d = Math.hypot((x - cx) / (g.w / 2), (y - cy) / (g.h / 2));
      const e = fbm(noise, x / 6, y / 6) - d * 0.7;
      g.set(x, y, e > 0.05 ? 'marmore' : e > -0.08 ? 'nuvem' : 'abismo');
    }
  }
  // Salão com colunas
  const hw = Math.floor(g.w * 0.28);
  const hh = Math.floor(g.h * 0.28);
  const x0 = Math.floor(cx - hw);
  const x1 = Math.floor(cx + hw);
  const y0 = Math.floor(cy - hh);
  const y1 = Math.floor(cy + hh);
  g.rect(x0 - 1, y0 - 1, x1 + 1, y1 + 3, 'marmore');
  for (let x = x0; x <= x1; x += 2) {
    g.set(x, y0, 'coluna');
    g.set(x, y1, 'coluna');
  }
  g.rect(Math.floor(cx) - 1, y0 + 1, Math.floor(cx) + 1, y0 + 2, 'elevado');
  g.obj(x0 + 1, y0 + 2, 'estatua');
  g.obj(x1 - 1, y0 + 2, 'estatua');
  g.obj(Math.floor(cx) - 2, y1 - 1, 'braseiro');
  g.obj(Math.floor(cx) + 2, y1 - 1, 'braseiro');
  // Ponte de nuvem até a borda de baixo
  for (let y = y1 + 1; y < g.h; y++) g.set(Math.floor(cx), y, g.get(Math.floor(cx), y).t === 'abismo' ? 'nuvem' : g.get(Math.floor(cx), y).t);
}

function river(g: Grid, rng: Rng) {
  forest(g, rng);
  for (const t of g.tiles) if (t.t === 'agua_profunda' || t.t === 'agua_rasa') t.t = 'grama';
  const path = carve(g, rng, { vertical: true, width: 1, terrain: 'agua_profunda', edge: 'areia', wander: 2.2 });
  // Margens rasas
  for (let y = 0; y < g.h; y++) {
    const p = Math.round(path[y]);
    for (const k of [-2, 2]) if (g.in(p + k, y) && g.get(p + k, y).t === 'areia' && rng() < 0.7) g.set(p + k, y, 'agua_rasa');
  }
  // Duas pontes
  for (const frac of [0.3, 0.72]) {
    const y = Math.floor(g.h * frac);
    const p = Math.round(path[y]);
    for (let x = p - 3; x <= p + 3; x++) if (g.in(x, y)) g.set(x, y, 'ponte');
  }
  scatter(g, rng, 7, (x, y) => g.get(x, y).t === 'areia' && !g.get(x, y).o, (x, y) => g.obj(x, y, rng() < 0.4 ? 'barril_oleo' : 'caixote'));
}

function beach(g: Grid, rng: Rng) {
  const noise = valueNoise2D(rng);
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const shore = g.w * 0.38 + (fbm(noise, y / 5, 1.3) - 0.5) * 6;
      const d = x - shore;
      g.set(x, y, d < -3 ? 'agua_profunda' : d < 0 ? 'agua_rasa' : d < 5 ? 'areia' : 'grama');
    }
  }
  // Píer
  const py = Math.floor(g.h * (0.3 + rng() * 0.4));
  const shoreX = Math.floor(g.w * 0.38);
  for (let x = Math.max(1, shoreX - 8); x <= shoreX + 2; x++) {
    g.set(x, py, 'ponte');
    g.set(x, py + 1, 'ponte');
  }
  scatter(g, rng, 3, (x, y) => g.get(x, y).t === 'areia' && rng() < 0.25, (x, y) => g.set(x, y, 'arvore'));
  scatter(g, rng, 3, (x, y) => g.get(x, y).t === 'grama' && rng() < 0.3, (x, y) => g.set(x, y, 'arvore'));
  g.obj(shoreX + 1, py - 1, 'barril_explosivo');
  g.obj(shoreX + 2, py + 2, 'caixote');
}

function interior(g: Grid, rng: Rng) {
  g.tiles = g.tiles.map(() => ({ t: 'terra' as TerrainType }));
  const bx0 = 1;
  const by0 = 1;
  const bx1 = g.w - 2;
  const by1 = g.h - 2;
  g.rect(bx0, by0, bx1, by1, 'parede');
  const floor: TerrainType = rng() < 0.5 ? 'madeira' : 'pedra';
  // BSP
  const rooms: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const split = (x0: number, y0: number, x1: number, y1: number, depth: number) => {
    const w = x1 - x0;
    const h = y1 - y0;
    if (depth === 0 || (w < 10 && h < 8)) {
      rooms.push({ x0, y0, x1, y1 });
      return;
    }
    if (w > h) {
      const sx = Math.floor(x0 + w * (0.35 + rng() * 0.3));
      split(x0, y0, sx, y1, depth - 1);
      split(sx, y0, x1, y1, depth - 1);
    } else {
      const sy = Math.floor(y0 + h * (0.35 + rng() * 0.3));
      split(x0, y0, x1, sy, depth - 1);
      split(x0, sy, x1, y1, depth - 1);
    }
  };
  split(bx0, by0, bx1, by1, 3);
  for (const r of rooms) g.rect(r.x0 + 1, r.y0 + 1, r.x1 - 1, r.y1 - 1, floor);
  // Portas entre salas vizinhas
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];
      if (a.x1 === b.x0 || b.x1 === a.x0) {
        const x = a.x1 === b.x0 ? a.x1 : a.x0;
        const lo = Math.max(a.y0, b.y0) + 1;
        const hi = Math.min(a.y1, b.y1) - 1;
        if (hi >= lo) g.set(x, Math.floor((lo + hi) / 2), floor);
      } else if (a.y1 === b.y0 || b.y1 === a.y0) {
        const y = a.y1 === b.y0 ? a.y1 : a.y0;
        const lo = Math.max(a.x0, b.x0) + 1;
        const hi = Math.min(a.x1, b.x1) - 1;
        if (hi >= lo) g.set(Math.floor((lo + hi) / 2), y, floor);
      }
    }
  }
  // Entrada com portão
  g.set(Math.floor(g.w / 2), by1, 'portao');
  for (const r of rooms) {
    scatter(g, rng, 3, (x, y) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1 && g.get(x, y).t === floor && rng() < 0.18, (x, y) => {
      const roll = rng();
      g.obj(x, y, roll < 0.45 ? 'caixote' : roll < 0.65 ? 'estatua' : roll < 0.8 ? 'braseiro' : 'barril_oleo');
    });
  }
}

function road(g: Grid, rng: Rng) {
  forest(g, rng);
  for (const t of g.tiles) {
    if (t.t === 'agua_profunda' || t.t === 'agua_rasa') t.t = 'grama';
    if (t.o?.type === 'braseiro') t.o = null;
  }
  const y0 = Math.floor(g.h / 2) - 1;
  for (let x = 0; x < g.w; x++) {
    for (let y = y0 - 1; y <= y0 + 2; y++) g.set(x, y, y === y0 - 1 || y === y0 + 2 ? 'terra' : 'pedra');
  }
  // Posto/loja
  const sx = Math.floor(g.w * (0.2 + rng() * 0.5));
  const sy = Math.max(1, y0 - 7);
  if (y0 - sy >= 6) {
    g.rect(sx, sy, sx + 7, sy + 4, 'parede');
    g.rect(sx + 1, sy + 1, sx + 6, sy + 3, 'madeira');
    g.set(sx + 3, sy + 4, 'portao');
    g.obj(sx + 2, sy + 2, 'caixote');
    g.obj(sx + 5, sy + 2, 'barril_oleo');
    g.obj(sx + 8, sy + 5, 'barril_explosivo');
  }
}

/** Gera um mapa jogável. A mesma (tipo, tamanho, semente) gera sempre o mesmo mapa. */
export function generateMap(kind: MapKind, width: number, height: number, seed: string): MapState {
  const rng = seededRng(seedFrom(`${kind}:${width}x${height}:${seed}`));
  const g = new Grid(width, height, 'grama');
  switch (kind) {
    case 'floresta': forest(g, rng); break;
    case 'caverna': cave(g, rng, false); break;
    case 'submundo': cave(g, rng, true); break;
    case 'templo': temple(g, rng); break;
    case 'rio': river(g, rng); break;
    case 'praia': beach(g, rng); break;
    case 'interior': interior(g, rng); break;
    case 'estrada': road(g, rng); break;
  }
  return {
    id: null,
    name: `${MAP_KINDS[kind].label} #${seed}`,
    preset: null,
    width,
    height,
    tiles: g.tiles,
    mood: MAP_KINDS[kind].mood,
    seed,
    kind,
  };
}
