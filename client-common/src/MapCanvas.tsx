import 'pixi.js/unsafe-eval'; // compatível com a Content-Security-Policy do servidor (sem eval)
import { Application, Container, Graphics, Sprite, Text } from 'pixi.js';
import { useEffect, useRef } from 'react';
import {
  CONDITIONS, OBJECTS, SURFACES, TERRAIN, type ProjectedState, type Tile,
} from '@mesa/shared';
import { useTable, type FxEvent } from './stores';
import { artKeyFor, getArtTexture, onArtLoaded } from './tokenArt';

export interface Cell {
  x: number;
  y: number;
}

export interface Highlight extends Cell {
  color: number;
  alpha?: number;
}

export interface MapCanvasProps {
  state: ProjectedState;
  selectedTokenId?: string | null;
  highlights?: Highlight[];
  /** Centraliza a câmera neste token ao abrir (celular do jogador). */
  focusTokenId?: string | null;
  onCellClick?: (cell: Cell, tokenId: string | null) => void;
  onCellHover?: (cell: Cell | null) => void;
  /** Arrastar com o botão pressionado chama onCellClick a cada casa (pincel do editor). */
  paintMode?: boolean;
  className?: string;
}

const TILE = 48;

const OBJECT_ICONS: Record<string, string> = {
  barril_explosivo: '💥', barril_agua: '💧', barril_oleo: '🛢️', caixote: '📦', estatua: '🗿', braseiro: '🔥',
};

function shade(color: number, factor: number) {
  const r = Math.min(255, Math.max(0, Math.round(((color >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((color >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((color & 255) * factor)));
  return (r << 16) | (g << 8) | b;
}

function drawTile(g: Graphics, tile: Tile, x: number, y: number) {
  const def = TERRAIN[tile.t];
  const px = x * TILE;
  const py = y * TILE;
  g.rect(px, py, TILE, TILE).fill(def.color);

  switch (tile.t) {
    case 'parede':
    case 'portao':
      g.rect(px + 2, py + 2, TILE - 4, TILE - 4).stroke({ width: 3, color: shade(def.color, 0.6) });
      if (tile.t === 'portao') g.rect(px + TILE / 2 - 2, py + 6, 4, TILE - 12).fill(shade(def.color, 0.6));
      break;
    case 'coluna':
      g.circle(px + TILE / 2, py + TILE / 2, TILE * 0.34).fill(shade(def.color, 1.1)).stroke({ width: 2, color: shade(def.color, 0.7) });
      break;
    case 'arvore':
      g.rect(px, py, TILE, TILE).fill(0x4a7f33);
      g.circle(px + TILE / 2, py + TILE / 2, TILE * 0.42).fill(def.color).stroke({ width: 2, color: shade(def.color, 0.7) });
      break;
    case 'agua_rasa':
    case 'agua_profunda':
    case 'estige':
      for (let i = 1; i <= 2; i++) {
        g.moveTo(px + 8, py + (TILE * i) / 3).lineTo(px + TILE - 8, py + (TILE * i) / 3).stroke({ width: 1, color: shade(def.color, 1.3), alpha: 0.5 });
      }
      break;
    case 'lava':
      g.circle(px + TILE * 0.3, py + TILE * 0.35, 4).fill(0xffc04d);
      g.circle(px + TILE * 0.7, py + TILE * 0.65, 3).fill(0xffc04d);
      break;
    case 'elevado':
      g.rect(px + 3, py + 3, TILE - 6, TILE - 6).stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
      break;
    case 'ponte':
    case 'madeira':
      for (let i = 1; i < 4; i++) g.moveTo(px, py + (TILE * i) / 4).lineTo(px + TILE, py + (TILE * i) / 4).stroke({ width: 1, color: shade(def.color, 0.7) });
      break;
    case 'escombros':
    case 'toco':
      g.circle(px + TILE * 0.3, py + TILE * 0.6, 5).fill(shade(def.color, 0.7));
      g.circle(px + TILE * 0.65, py + TILE * 0.35, 4).fill(shade(def.color, 0.8));
      break;
    case 'nuvem':
      g.circle(px + TILE * 0.35, py + TILE * 0.5, TILE * 0.2).fill({ color: 0xffffff, alpha: 0.6 });
      g.circle(px + TILE * 0.62, py + TILE * 0.45, TILE * 0.24).fill({ color: 0xffffff, alpha: 0.6 });
      break;
  }

  // Rachaduras em terreno danificado
  if (def.maxHp && tile.hp !== undefined && tile.hp < def.maxHp) {
    const k = 1 - tile.hp / def.maxHp;
    g.moveTo(px + 6, py + 8).lineTo(px + TILE / 2, py + TILE / 2).lineTo(px + TILE - 10, py + TILE * k + 6).stroke({ width: 2, color: 0x111111, alpha: 0.6 });
  }
  g.rect(px, py, TILE, TILE).stroke({ width: 1, color: 0x000000, alpha: 0.12 });
}

interface LiveFx {
  node: Container;
  life: number;
  max: number;
  kind: 'float' | 'burst';
}

export function MapCanvas({ state, selectedTokenId, highlights, focusTokenId, onCellClick, onCellHover, paintMode, className }: MapCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const layers = useRef<{ world: Container; tiles: Graphics; surfaces: Graphics; marks: Graphics; objects: Container; tokens: Container; fx: Container } | null>(null);
  const liveFx = useRef<LiveFx[]>([]);
  const props = useRef({ onCellClick, onCellHover, paintMode, state });
  props.current = { onCellClick, onCellHover, paintMode, state };
  const focused = useRef(false);
  const fxQueue = useTable((s) => s.fx);
  const consumeFx = useTable((s) => s.consumeFx);

  // ───── Inicialização do Pixi + câmera ─────
  useEffect(() => {
    const el = host.current!;
    let cancelled = false;
    const app = new Application();
    const cleanup: (() => void)[] = [];

    void app.init({ resizeTo: el, background: 0x0b1020, antialias: true, autoDensity: true, resolution: Math.min(2, window.devicePixelRatio || 1) }).then(() => {
      if (cancelled) {
        app.destroy(true);
        return;
      }
      el.appendChild(app.canvas);
      app.canvas.style.touchAction = 'none';
      const world = new Container();
      const tiles = new Graphics();
      const surfaces = new Graphics();
      const marks = new Graphics();
      const objects = new Container();
      const tokens = new Container();
      const fx = new Container();
      world.addChild(tiles, surfaces, marks, objects, tokens, fx);
      app.stage.addChild(world);
      appRef.current = app;
      layers.current = { world, tiles, surfaces, marks, objects, tokens, fx };

      // Encaixa o mapa na tela
      const { width, height } = props.current.state.map;
      const scale = Math.min(el.clientWidth / (width * TILE), el.clientHeight / (height * TILE), 1.6);
      world.scale.set(Math.max(0.35, scale));
      world.position.set((el.clientWidth - width * TILE * world.scale.x) / 2, (el.clientHeight - height * TILE * world.scale.y) / 2);

      // Animações de efeitos
      app.ticker.add((t) => {
        for (const f of liveFx.current) {
          f.life -= t.deltaMS;
          const p = 1 - f.life / f.max;
          if (f.kind === 'float') {
            f.node.y -= t.deltaMS * 0.03;
            f.node.alpha = 1 - p;
          } else {
            f.node.scale.set(0.4 + p * 0.9);
            f.node.alpha = 1 - p;
          }
        }
        for (const f of liveFx.current.filter((x) => x.life <= 0)) f.node.destroy();
        liveFx.current = liveFx.current.filter((x) => x.life > 0);
      });

      // ───── Interação: clique, arrastar (pan), roda/pinça (zoom) ─────
      const pointers = new Map<number, { x: number; y: number }>();
      let downAt: { x: number; y: number } | null = null;
      let moved = false;
      let pinchDist = 0;
      let lastPaint = '';

      const cellAt = (clientX: number, clientY: number): Cell | null => {
        const rect = app.canvas.getBoundingClientRect();
        const wx = (clientX - rect.left - world.x) / world.scale.x;
        const wy = (clientY - rect.top - world.y) / world.scale.y;
        const cx = Math.floor(wx / TILE);
        const cy = Math.floor(wy / TILE);
        const m = props.current.state.map;
        return cx >= 0 && cy >= 0 && cx < m.width && cy < m.height ? { x: cx, y: cy } : null;
      };
      const click = (cell: Cell) => {
        const tok = props.current.state.tokens.find((t) => t.x === cell.x && t.y === cell.y && !t.dead) ?? null;
        props.current.onCellClick?.(cell, tok?.id ?? null);
      };
      const zoomAt = (sx: number, sy: number, factor: number) => {
        const next = Math.min(3, Math.max(0.25, world.scale.x * factor));
        const k = next / world.scale.x;
        world.position.set(sx - (sx - world.x) * k, sy - (sy - world.y) * k);
        world.scale.set(next);
      };

      const onDown = (e: PointerEvent) => {
        app.canvas.setPointerCapture(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        downAt = { x: e.clientX, y: e.clientY };
        moved = false;
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        }
        if (props.current.paintMode && e.button === 0 && pointers.size === 1) {
          const c = cellAt(e.clientX, e.clientY);
          if (c) {
            lastPaint = `${c.x},${c.y}`;
            click(c);
            moved = true;
          }
        }
      };
      const onMove = (e: PointerEvent) => {
        const prev = pointers.get(e.pointerId);
        const cell = cellAt(e.clientX, e.clientY);
        props.current.onCellHover?.(cell);
        if (!prev) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const [a, b] = [...pointers.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const rect = app.canvas.getBoundingClientRect();
          if (pinchDist) zoomAt((a.x + b.x) / 2 - rect.left, (a.y + b.y) / 2 - rect.top, d / pinchDist);
          pinchDist = d;
          moved = true;
          return;
        }
        if (props.current.paintMode && e.buttons === 1) {
          if (cell && `${cell.x},${cell.y}` !== lastPaint) {
            lastPaint = `${cell.x},${cell.y}`;
            click(cell);
          }
          return;
        }
        if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) moved = true;
        if (moved) world.position.set(world.x + e.clientX - prev.x, world.y + e.clientY - prev.y);
      };
      const onUp = (e: PointerEvent) => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) pinchDist = 0;
        if (!moved && downAt && pointers.size === 0) {
          const c = cellAt(e.clientX, e.clientY);
          if (c) click(c);
        }
        if (pointers.size === 0) downAt = null;
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const rect = app.canvas.getBoundingClientRect();
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.12 : 1 / 1.12);
      };
      const onLeave = () => props.current.onCellHover?.(null);
      app.canvas.addEventListener('pointerdown', onDown);
      app.canvas.addEventListener('pointermove', onMove);
      app.canvas.addEventListener('pointerup', onUp);
      app.canvas.addEventListener('pointercancel', onUp);
      app.canvas.addEventListener('pointerleave', onLeave);
      app.canvas.addEventListener('wheel', onWheel, { passive: false });
      app.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      cleanup.push(() => {
        app.canvas.removeEventListener('pointerdown', onDown);
        app.canvas.removeEventListener('pointermove', onMove);
        app.canvas.removeEventListener('pointerup', onUp);
        app.canvas.removeEventListener('pointercancel', onUp);
        app.canvas.removeEventListener('pointerleave', onLeave);
        app.canvas.removeEventListener('wheel', onWheel);
      });
      draw();
    });

    return () => {
      cancelled = true;
      for (const c of cleanup) c();
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        layers.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───── Desenho ─────
  function draw() {
    const L = layers.current;
    if (!L) return;
    const { map, tokens, combat } = state;
    L.tiles.clear();
    L.surfaces.clear();
    L.marks.clear();
    for (const c of L.objects.removeChildren()) c.destroy();
    for (const c of L.tokens.removeChildren()) c.destroy({ children: true });

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y * map.width + x];
        drawTile(L.tiles, tile, x, y);
        if (tile.s) {
          const s = SURFACES[tile.s.type];
          L.surfaces.rect(x * TILE, y * TILE, TILE, TILE).fill({ color: s.color, alpha: s.alpha });
          if (tile.s.type === 'agua_eletrificada') {
            L.surfaces.moveTo(x * TILE + 10, y * TILE + 12).lineTo(x * TILE + 24, y * TILE + 26).lineTo(x * TILE + 18, y * TILE + 28).lineTo(x * TILE + 34, y * TILE + 40).stroke({ width: 2, color: 0xffff66 });
          }
        }
        if (tile.o) {
          const def = OBJECTS[tile.o.type];
          const bg = new Graphics().roundRect(x * TILE + 8, y * TILE + 8, TILE - 16, TILE - 16, 6).fill({ color: def.color, alpha: 0.85 });
          const icon = new Text({ text: OBJECT_ICONS[tile.o.type] ?? '?', style: { fontSize: 20 } });
          icon.anchor.set(0.5);
          icon.position.set(x * TILE + TILE / 2, y * TILE + TILE / 2);
          L.objects.addChild(bg, icon);
        }
      }
    }

    for (const h of highlights ?? []) {
      L.marks.rect(h.x * TILE + 2, h.y * TILE + 2, TILE - 4, TILE - 4).fill({ color: h.color, alpha: h.alpha ?? 0.3 }).stroke({ width: 2, color: h.color, alpha: 0.8 });
    }

    const currentId = combat?.currentTokenId ?? null;
    for (const t of tokens) {
      const c = new Container();
      c.position.set(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2);
      const color = parseInt((t.color ?? '#888888').replace('#', ''), 16);
      const g = new Graphics();
      if (t.id === currentId) g.circle(0, 0, TILE * 0.47).stroke({ width: 4, color: 0xffd34d, alpha: 0.9 });
      if (t.id === selectedTokenId) g.circle(0, 0, TILE * 0.44).stroke({ width: 3, color: 0x7cf3ff });
      g.circle(0, 0, TILE * 0.36).fill(t.dead ? 0x555555 : color).stroke({ width: 2, color: t.kind === 'monstro' ? 0x2a0000 : 0xffffff });
      c.addChild(g);
      // Ícone do token (classe do herói ou silhueta do monstro); iniciais enquanto a arte carrega
      const tex = getArtTexture(artKeyFor(t));
      if (tex && !t.dead) {
        const icon = new Sprite(tex);
        icon.anchor.set(0.5);
        icon.width = icon.height = TILE * 0.56;
        c.addChild(icon);
      } else {
        const label = new Text({ text: t.dead ? '✖' : t.name.slice(0, 2).toUpperCase(), style: { fontSize: 15, fontWeight: '700', fill: 0xffffff, stroke: { color: 0x000000, width: 3 } } });
        label.anchor.set(0.5);
        c.addChild(label);
      }
      // Emblema do pai olímpico no canto
      if (t.emblem && !t.dead) {
        const badge = new Graphics().circle(TILE * 0.3, -TILE * 0.3, 9).fill(0x0b1020).stroke({ width: 1.5, color: 0xffd34d });
        const sym = new Text({ text: t.emblem, style: { fontSize: 11 } });
        sym.anchor.set(0.5);
        sym.position.set(TILE * 0.3, -TILE * 0.3);
        c.addChild(badge, sym);
      }

      // Barra de vida (aliados) ou anel de estado (monstros para jogadores)
      const hp = typeof t.hp === 'number' && typeof t.maxHp === 'number' ? t.hp / Math.max(1, t.maxHp) : null;
      if (hp !== null && !t.dead) {
        const bar = new Graphics().rect(-TILE * 0.38, TILE * 0.36, TILE * 0.76, 5).fill(0x220000).rect(-TILE * 0.38, TILE * 0.36, TILE * 0.76 * hp, 5).fill(hp > 0.5 ? 0x4cd964 : hp > 0.25 ? 0xffcc00 : 0xff3b30);
        c.addChild(bar);
      } else if ('hpStatus' in t && !t.dead) {
        const status = (t as { hpStatus: string }).hpStatus;
        const ring = status === 'ileso' ? 0x4cd964 : status === 'ferido' ? 0xffcc00 : 0xff3b30;
        c.addChild(new Graphics().circle(0, 0, TILE * 0.4).stroke({ width: 2, color: ring, alpha: 0.9 }));
      }
      if (t.conditions.length) {
        const icons = new Text({ text: t.conditions.slice(0, 3).map((k) => CONDITIONS[k]?.icon ?? '').join(''), style: { fontSize: 11 } });
        icons.anchor.set(0.5, 1);
        icons.position.set(0, -TILE * 0.36);
        c.addChild(icons);
      }
      if (t.hidden) c.alpha = 0.45;
      L.tokens.addChild(c);
    }

    // Foco inicial no token do jogador
    if (!focused.current && focusTokenId && appRef.current) {
      const t = tokens.find((x) => x.id === focusTokenId);
      if (t) {
        const view = appRef.current.screen;
        L.world.scale.set(Math.max(L.world.scale.x, 1));
        L.world.position.set(view.width / 2 - (t.x * TILE + TILE / 2) * L.world.scale.x, view.height / 2 - (t.y * TILE + TILE / 2) * L.world.scale.y);
        focused.current = true;
      }
    }
  }

  useEffect(() => {
    draw();
  });

  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const off = onArtLoaded(() => drawRef.current());
    return () => {
      off();
    };
  }, []);

  // ───── Efeitos visuais vindos do servidor ─────
  useEffect(() => {
    const L = layers.current;
    if (!L || !fxQueue.length) return;
    const used: number[] = [];
    const spawn = (node: Container, kind: LiveFx['kind'], ms: number) => {
      L.fx.addChild(node);
      liveFx.current.push({ node, kind, life: ms, max: ms });
    };
    const tokenPos = (id: string) => state.tokens.find((t) => t.id === id);
    for (const { id, fx } of fxQueue as FxEvent[]) {
      used.push(id);
      if (fx.type === 'explosao' || fx.type === 'destruicao') {
        const r = fx.type === 'explosao' ? (fx.radius + 0.5) * TILE : TILE * 0.6;
        const g = new Graphics().circle(0, 0, r).fill({ color: fx.type === 'explosao' ? 0xff7b00 : 0xb8a58a, alpha: 0.7 });
        g.position.set(fx.x * TILE + TILE / 2, fx.y * TILE + TILE / 2);
        spawn(g, 'burst', 700);
      } else if (fx.type === 'dano' || fx.type === 'cura' || fx.type === 'errou') {
        const t = tokenPos(fx.tokenId);
        if (!t) continue;
        const text = fx.type === 'dano' ? `-${fx.amount}` : fx.type === 'cura' ? `+${fx.amount}` : 'Errou!';
        const fill = fx.type === 'dano' ? 0xff4d4d : fx.type === 'cura' ? 0x5cff8a : 0xdddddd;
        const label = new Text({ text, style: { fontSize: 20, fontWeight: '800', fill, stroke: { color: 0x000000, width: 4 } } });
        label.anchor.set(0.5);
        label.position.set(t.x * TILE + TILE / 2, t.y * TILE);
        spawn(label, 'float', 1200);
      }
    }
    consumeFx(used);
  }, [fxQueue, consumeFx, state.tokens]);

  return <div ref={host} className={className ?? 'h-full w-full'} />;
}
