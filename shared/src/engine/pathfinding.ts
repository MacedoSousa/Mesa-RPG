import { inBounds, isWalkableTile, moveCost, tileAt, tileBlocksSight } from './map';
import type { TableState } from './types';

export interface Point {
  x: number;
  y: number;
}

/** Distância em quadrados (regra padrão do 5e: diagonal custa 1). */
export function gridDistance(a: Point, b: Point): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

const DIRS: Point[] = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 },
];

function blockedByToken(state: TableState, x: number, y: number, moverId: string): boolean {
  return state.tokens.some((t) => !t.dead && t.id !== moverId && t.x === x && t.y === y);
}

function passable(state: TableState, x: number, y: number, moverId: string): boolean {
  const tile = tileAt(state.map, x, y);
  return !!tile && isWalkableTile(tile) && !blockedByToken(state, x, y, moverId);
}

export interface PathResult {
  path: Point[]; // inclui o destino, não inclui a origem
  cost: number;
}

/**
 * A* em grid de 8 direções. Diagonais não "cortam quinas" de casas bloqueadas.
 * Custo de cada passo = custo do terreno de destino (terreno difícil = 2).
 */
export function findPath(state: TableState, moverId: string, from: Point, to: Point, maxCost = Infinity): PathResult | null {
  const { map } = state;
  if (!inBounds(map, to.x, to.y)) return null;
  if (from.x === to.x && from.y === to.y) return { path: [], cost: 0 };
  if (!passable(state, to.x, to.y, moverId)) return null;

  const key = (p: Point) => p.y * map.width + p.x;
  const g = new Map<number, number>([[key(from), 0]]);
  const came = new Map<number, number>();
  const open: { k: number; f: number }[] = [{ k: key(from), f: gridDistance(from, to) }];
  const closed = new Set<number>();

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const { k } = open.shift()!;
    if (closed.has(k)) continue;
    closed.add(k);
    const cx = k % map.width;
    const cy = Math.floor(k / map.width);
    if (cx === to.x && cy === to.y) break;

    for (const d of DIRS) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if (!passable(state, nx, ny, moverId)) continue;
      if (d.x !== 0 && d.y !== 0) {
        // sem cortar quina: as duas casas ortogonais precisam ser transitáveis no terreno
        const a = tileAt(map, cx + d.x, cy);
        const b = tileAt(map, cx, cy + d.y);
        if (!a || !b || !isWalkableTile(a) || !isWalkableTile(b)) continue;
      }
      const nk = ny * map.width + nx;
      const cost = (g.get(k) ?? 0) + moveCost(tileAt(map, nx, ny)!);
      if (cost > maxCost) continue;
      if (cost < (g.get(nk) ?? Infinity)) {
        g.set(nk, cost);
        came.set(nk, k);
        open.push({ k: nk, f: cost + gridDistance({ x: nx, y: ny }, to) });
      }
    }
  }

  const target = key(to);
  if (!g.has(target)) return null;
  const path: Point[] = [];
  let cur = target;
  while (cur !== key(from)) {
    path.unshift({ x: cur % map.width, y: Math.floor(cur / map.width) });
    const prev = came.get(cur);
    if (prev === undefined) return null;
    cur = prev;
  }
  return { path, cost: g.get(target)! };
}

/** Todas as casas alcançáveis com o orçamento de movimento (para destacar na UI). */
export function reachableCells(state: TableState, moverId: string, from: Point, budget: number): Map<string, number> {
  const { map } = state;
  const best = new Map<string, number>([[`${from.x},${from.y}`, 0]]);
  const queue: { p: Point; c: number }[] = [{ p: from, c: 0 }];
  while (queue.length) {
    queue.sort((a, b) => a.c - b.c);
    const { p, c } = queue.shift()!;
    for (const d of DIRS) {
      const nx = p.x + d.x;
      const ny = p.y + d.y;
      if (!passable(state, nx, ny, moverId)) continue;
      if (d.x !== 0 && d.y !== 0) {
        const a = tileAt(map, p.x + d.x, p.y);
        const b = tileAt(map, p.x, p.y + d.y);
        if (!a || !b || !isWalkableTile(a) || !isWalkableTile(b)) continue;
      }
      const nc = c + moveCost(tileAt(map, nx, ny)!);
      if (nc > budget) continue;
      const k = `${nx},${ny}`;
      if (nc < (best.get(k) ?? Infinity)) {
        best.set(k, nc);
        queue.push({ p: { x: nx, y: ny }, c: nc });
      }
    }
  }
  best.delete(`${from.x},${from.y}`);
  return best;
}

/** Linha de visão (Bresenham) entre os centros de duas casas. */
export function hasLineOfSight(state: TableState, a: Point, b: Point): boolean {
  let x0 = a.x;
  let y0 = a.y;
  const dx = Math.abs(b.x - x0);
  const dy = -Math.abs(b.y - y0);
  const sx = x0 < b.x ? 1 : -1;
  const sy = y0 < b.y ? 1 : -1;
  let err = dx + dy;
  while (!(x0 === b.x && y0 === b.y)) {
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
    if (x0 === b.x && y0 === b.y) break;
    const tile = tileAt(state.map, x0, y0);
    if (!tile || tileBlocksSight(tile)) return false;
  }
  return true;
}
