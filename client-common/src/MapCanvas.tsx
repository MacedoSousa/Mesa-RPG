import 'pixi.js/unsafe-eval'; // compatível com a Content-Security-Policy do servidor (sem eval)
import { Application, Container, DisplacementFilter, Graphics, Sprite, Text } from 'pixi.js';
import { useEffect, useRef, useState } from 'react';
import { CONDITIONS, SURFACES, type ProjectedState } from '@mesa/shared';
import { useTable, type FxEvent } from './stores';
import { cx } from './ui';
import { artKeyFor, getArtTexture, isPainted, loadPaintedArt, onArtLoaded } from './tokenArt';
import { MOOD_STYLE, TILE, buildStaticLayers, glowTexture, noiseTexture, staticSignature, type Animated, type StaticLayers } from './mapRender';
import { loadMapArt, mapArtFor, mapArtTexture, onMapArt, paintedMapPreferred, setPaintedMapPreferred } from './mapArt';
import { getPortraitTexture, onPortraitLoaded } from './portrait';
import { AmbientLayer } from './ambient';
import { FigureLayer, figureMode, onFiguresPref, setFigureMode, ultraGraphics, type FigureMode } from './figureLayer';

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
  /** Linhas da grade tática (padrão: ligadas). */
  showGrid?: boolean;
  className?: string;
}

const DIVINITY_COLORS: Record<string, number> = {
  zeus: 0xfde047, poseidon: 0x38bdf8, hades: 0x8b5cf6, atena: 0xe5e7eb, apolo: 0xfbbf24, ares: 0xef4444, afrodite: 0xf472b6,
  hefesto: 0xf97316, hermes: 0x93c5fd, demeter: 0x84cc16, artemis: 0xe2e8f0, dionisio: 0xa855f7, hecate: 0xc084fc, hera: 0xfda4af,
};
function divinityColor(d?: string): number {
  return (d && DIVINITY_COLORS[d]) || 0xfff3b0;
}

interface LiveFx {
  node: Container;
  life: number;
  max: number;
  kind: 'float' | 'burst' | 'slash' | 'proj' | 'particle' | 'ring';
  /** Partículas: velocidade (px/ms) e gravidade. */
  vx?: number;
  vy?: number;
  g?: number;
  spin?: number;
  /** Espera antes de aparecer (ms): o número de dano surge no impacto do golpe. */
  delay?: number;
  from?: { x: number; y: number };
  to?: { x: number; y: number };
}

interface Layers {
  world: Container;
  ground: Container;
  water: Container;
  grid: Graphics;
  surfaces: Container;
  marks: Graphics;
  features: Container;
  objects: Container;
  /** Mapa repintado pela IA (substitui chão, água, terreno e copas). */
  painted: Container;
  tokens: Container;
  figs: FigureLayer;
  ambient: AmbientLayer;
  canopy: Container;
  dark: Graphics;
  lights: Container;
  fx: Container;
  disp: Sprite;
}

export function MapCanvas({ state, selectedTokenId, highlights, focusTokenId, onCellClick, onCellHover, paintMode, showGrid = true, className }: MapCanvasProps) {
  const host = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const layers = useRef<Layers | null>(null);
  const staticRef = useRef<{ sig: string; layers: StaticLayers } | null>(null);
  const paintedUrl = useRef('');
  const animRef = useRef<Animated[]>([]);
  const lightNodes = useRef<{ node: Sprite; base: number; flicker: boolean; phase: number }[]>([]);
  const liveFx = useRef<LiveFx[]>([]);
  const props = useRef({ onCellClick, onCellHover, paintMode, state });
  props.current = { onCellClick, onCellHover, paintMode, state };
  const focused = useRef(false);
  const shake = useRef({ t: 0, mag: 0 });
  const [mode, setMode] = useState<FigureMode>(figureMode);
  const figMode = mode !== 'fichas';
  const figModeRef = useRef(figMode);
  figModeRef.current = figMode;
  const fxQueue = useTable((s) => s.fx);
  const consumeFx = useTable((s) => s.consumeFx);

  // ───── Inicialização do Pixi + câmera ─────
  useEffect(() => {
    const el = host.current!;
    let cancelled = false;
    const app = new Application();
    const cleanup: (() => void)[] = [];

    void app.init({ resizeTo: el, background: 0x0b1020, antialias: true, autoDensity: true, resolution: ultraGraphics() ? Math.min(3, (window.devicePixelRatio || 1) * 1.5) : Math.min(2, window.devicePixelRatio || 1) }).then(() => {
      if (cancelled) {
        app.destroy(true);
        return;
      }
      el.appendChild(app.canvas);
      app.canvas.style.touchAction = 'none';
      // Contexto gráfico perdido (pouca memória de vídeo): ao voltar, refaz tudo que vem de canvas
      const onLost = (e: Event) => { e.preventDefault(); console.warn('Mapa: contexto WebGL perdido'); };
      const onRestored = () => {
        console.warn('Mapa: contexto WebGL restaurado');
        staticRef.current = null;
        layers.current?.figs.reset();
        drawRef.current();
      };
      app.canvas.addEventListener('webglcontextlost', onLost);
      app.canvas.addEventListener('webglcontextrestored', onRestored);
      cleanup.push(() => {
        app.canvas.removeEventListener('webglcontextlost', onLost);
        app.canvas.removeEventListener('webglcontextrestored', onRestored);
      });
      const world = new Container();
      const ground = new Container();
      const water = new Container();
      const grid = new Graphics();
      const surfaces = new Container();
      const marks = new Graphics();
      const features = new Container();
      const objects = new Container();
      const painted = new Container();
      const tokens = new Container();
      const figs = new FigureLayer(() => drawRef.current());
      const ambient = new AmbientLayer();
      const canopy = new Container();
      const dark = new Graphics();
      const lights = new Container();
      const fx = new Container();
      // Água ondulando: mapa de deslocamento com ruído, rolado no ticker
      const noise = noiseTexture();
      noise.source.addressMode = 'repeat';
      const disp = new Sprite(noise);
      disp.width = disp.height = 512;
      disp.alpha = 0;
      water.filters = [new DisplacementFilter({ sprite: disp, scale: 6 })];
      lights.blendMode = 'add';
      world.addChild(water, ground, painted, grid, surfaces, marks, features, objects, tokens, figs.container, canopy, ambient.container, dark, lights, ambient.glow, fx, disp);
      app.stage.addChild(world);
      appRef.current = app;
      layers.current = { world, ground, water, painted, grid, surfaces, marks, features, objects, tokens, figs, ambient, canopy, dark, lights, fx, disp };
      cleanup.push(() => figs.destroy(), () => ambient.destroy());

      // Encaixa o mapa na tela
      const { width, height } = props.current.state.map;
      const scale = Math.min(el.clientWidth / (width * TILE), el.clientHeight / (height * TILE), 1.6);
      world.scale.set(Math.max(0.35, scale));
      world.position.set((el.clientWidth - width * TILE * world.scale.x) / 2, (el.clientHeight - height * TILE * world.scale.y) / 2);

      // Animações de efeitos
      let clock = 0;
      app.ticker.add((t) => {
        clock += t.deltaMS / 1000;
        figs.tick(t.deltaMS);
        ambient.tick(t.deltaMS, clock);
        // Tremor de tela nos golpes fortes (mexe no pivô para não atrapalhar o arrasto)
        if (shake.current.t > 0) {
          shake.current.t -= t.deltaMS;
          const m = shake.current.mag * Math.max(0, shake.current.t / 260);
          world.pivot.set((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
        } else if (world.pivot.x || world.pivot.y) world.pivot.set(0, 0);
        disp.x = (clock * 14) % 256;
        disp.y = (clock * 9) % 256;
        for (const a of animRef.current) {
          if (a.node.destroyed) continue;
          if (a.update) {
            a.update(clock);
          } else if (a.kind === 'flicker') {
            a.node.scale.y = 0.85 + Math.sin(clock * 11 + a.phase) * 0.12 + Math.sin(clock * 23 + a.phase) * 0.05;
            a.node.alpha = 0.85 + Math.sin(clock * 17 + a.phase) * 0.15;
          } else if (a.kind === 'pulse') {
            a.node.alpha = 0.4 + (Math.sin(clock * 3 + a.phase) + 1) * 0.3;
          } else if (a.kind === 'bob') {
            a.node.y = Math.sin(clock * 0.9 + a.phase) * 0.8;
          } else if (a.kind === 'sway') {
            // Vento: rajadas lentas que passam pelo mapa da esquerda para a direita
            const gust = 0.5 + 0.5 * Math.sin(clock * 0.35 - a.phase * 0.2);
            a.node.rotation = Math.sin(clock * 1.4 + a.phase) * (0.012 + gust * 0.03);
            a.node.y = a.base + Math.sin(clock * 0.9 + a.phase) * 0.6;
          }
        }
        for (const l of lightNodes.current) {
          if (l.node.destroyed) continue;
          l.node.alpha = l.flicker ? l.base * (0.85 + Math.sin(clock * 9 + l.phase) * 0.1 + Math.sin(clock * 21 + l.phase) * 0.05) : l.base;
        }
        for (const f of liveFx.current) {
          if (f.delay && f.delay > 0) {
            f.delay -= t.deltaMS;
            f.node.visible = false;
            continue;
          }
          f.node.visible = true;
          f.life -= t.deltaMS;
          const p = 1 - f.life / f.max;
          if (f.kind === 'proj' && f.from && f.to) {
            // Projétil em arco até o alvo
            f.node.position.set(f.from.x + (f.to.x - f.from.x) * p, f.from.y + (f.to.y - f.from.y) * p - Math.sin(p * Math.PI) * TILE * 0.5);
            f.node.alpha = 1;
          } else if (f.kind === 'slash') {
            f.node.scale.set(0.7 + p * 0.5);
            f.node.alpha = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
          } else if (f.kind === 'float') {
            f.node.y -= t.deltaMS * 0.03;
            f.node.alpha = 1 - p;
          } else if (f.kind === 'particle') {
            f.vy = (f.vy ?? 0) + (f.g ?? 0) * t.deltaMS;
            f.node.x += (f.vx ?? 0) * t.deltaMS;
            f.node.y += (f.vy ?? 0) * t.deltaMS;
            f.node.rotation += (f.spin ?? 0) * t.deltaMS;
            f.node.alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
          } else if (f.kind === 'ring') {
            f.node.scale.set(0.15 + p * 1.0);
            f.node.alpha = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
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
        staticRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───── Desenho ─────
  function draw() {
    const L = layers.current;
    if (!L) return;
    const { map, tokens, combat } = state;
    const mood = map.mood ?? 'dia';

    // Camadas estáticas (chão, água, paredes, árvores, objetos): só refaz quando o mapa muda
    const sig = staticSignature(map);
    if (staticRef.current?.sig !== sig) {
      for (const layer of [L.ground, L.water, L.features, L.objects, L.canopy]) for (const c of layer.removeChildren()) c.destroy({ children: true });
      const built = buildStaticLayers(map);
      L.ground.addChild(built.ground);
      L.water.addChild(built.water);
      L.features.addChild(built.features);
      L.objects.addChild(built.objects);
      L.canopy.addChild(built.canopy);
      staticRef.current = { sig, layers: built };
      paintedUrl.current = '';
      // Ambiente (escuridão) e luzes
      const style = MOOD_STYLE[mood];
      L.dark.clear();
      if (style.darkness > 0) L.dark.rect(0, 0, map.width * TILE, map.height * TILE).fill({ color: style.tint, alpha: style.darkness });
      // Vinheta nas bordas do mapa
      const v = Math.min(map.width, map.height) * TILE * 0.18;
      for (let i = 0; i < 6; i++) {
        const k = i / 6;
        L.dark.rect(k * v, k * v, map.width * TILE - 2 * k * v, map.height * TILE - 2 * k * v).stroke({ width: v / 6, color: 0x000000, alpha: style.vignette * (1 - k) * 0.35 });
      }
      // Grade tática
      L.grid.clear();
      for (let x = 0; x <= map.width; x++) L.grid.moveTo(x * TILE, 0).lineTo(x * TILE, map.height * TILE);
      for (let y = 0; y <= map.height; y++) L.grid.moveTo(0, y * TILE).lineTo(map.width * TILE, y * TILE);
      L.grid.stroke({ width: 1, color: 0x000000, alpha: 0.14 });
    }

    // Mapa pintado pela IA: vale enquanto o terreno for o mesmo que foi pintado
    const art = paintedMapPreferred() ? mapArtFor(useTable.getState().campaignId, map) : null;
    const tex = art ? mapArtTexture(art) : null;
    const usePaint = !!tex;
    L.ground.visible = L.water.visible = L.features.visible = L.canopy.visible = !usePaint;
    L.painted.visible = usePaint;
    if (usePaint && paintedUrl.current !== art!.url) {
      for (const c of L.painted.removeChildren()) c.destroy();
      const sp = new Sprite(tex!);
      sp.width = map.width * TILE;
      sp.height = map.height * TILE;
      L.painted.addChild(sp);
      paintedUrl.current = art!.url;
    }
    L.grid.visible = showGrid;
    L.ambient.setup(map.width, map.height, mood, map.tiles.some((t) => t.t === 'arvore'));
    const built = staticRef.current!.layers;

    // Superfícies (dinâmicas): fogo, água, gelo, óleo, veneno, vapor
    for (const c of L.surfaces.removeChildren()) c.destroy({ children: true });
    const anim: Animated[] = [...built.animated];
    const lightList = [...built.lights];
    const sg = new Graphics();
    L.surfaces.addChild(sg);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y * map.width + x];
        if (!tile.s) continue;
        const s = SURFACES[tile.s.type];
        const px = x * TILE;
        const py = y * TILE;
        sg.roundRect(px + 2, py + 2, TILE - 4, TILE - 4, 10).fill({ color: s.color, alpha: s.alpha });
        if (tile.s.type === 'fogo') {
          const f = new Graphics();
          for (let i = 0; i < 3; i++) {
            const fx = px + 10 + i * 13;
            f.ellipse(fx, py + TILE * 0.62, 6, 13).fill({ color: 0xff5a1a, alpha: 0.85 });
            f.ellipse(fx, py + TILE * 0.68, 3, 7).fill({ color: 0xffe066, alpha: 0.95 });
          }
          f.pivot.set(0, py + TILE * 0.8);
          f.y = py + TILE * 0.8;
          L.surfaces.addChild(f);
          anim.push({ node: f, kind: 'flicker', phase: (x * 7 + y * 3) % 6, base: 1 });
          lightList.push({ x: x + 0.5, y: y + 0.5, radius: 2.2, color: 0xff7a1a, flicker: true });
        } else if (tile.s.type === 'agua_eletrificada') {
          const z = new Graphics().moveTo(px + 10, py + 12).lineTo(px + 24, py + 26).lineTo(px + 18, py + 28).lineTo(px + 34, py + 40).stroke({ width: 2, color: 0xffff66 });
          L.surfaces.addChild(z);
          anim.push({ node: z, kind: 'pulse', phase: x + y, base: 1 });
          lightList.push({ x: x + 0.5, y: y + 0.5, radius: 1.4, color: 0x8fe3ff, flicker: true });
        } else if (tile.s.type === 'gelo') {
          sg.moveTo(px + 8, py + 30).lineTo(px + 22, py + 16).moveTo(px + 26, py + 38).lineTo(px + 40, py + 24).stroke({ width: 2, color: 0xffffff, alpha: 0.7 });
        } else if (tile.s.type === 'veneno' || tile.s.type === 'vapor') {
          const cloud = new Graphics();
          for (let i = 0; i < 3; i++) cloud.circle(px + 12 + i * 12, py + 20 + (i % 2) * 10, 11).fill({ color: s.color, alpha: 0.35 });
          L.surfaces.addChild(cloud);
          anim.push({ node: cloud, kind: 'pulse', phase: x * 2 + y, base: 1 });
        } else if (tile.s.type === 'oleo') {
          sg.ellipse(px + 18, py + 18, 6, 3).fill({ color: 0xffffff, alpha: 0.18 });
        }
      }
    }

    // Destaques (alcance, alvos)
    L.marks.clear();
    for (const h of highlights ?? []) {
      L.marks.roundRect(h.x * TILE + 3, h.y * TILE + 3, TILE - 6, TILE - 6, 8).fill({ color: h.color, alpha: h.alpha ?? 0.3 }).stroke({ width: 2, color: h.color, alpha: 0.85 });
    }

    // Tokens: bonecos 3D pré-renderizados (quando prontos) ou fichas redondas
    for (const c of L.tokens.removeChildren()) c.destroy({ children: true });
    const currentId = combat?.currentTokenId ?? null;
    L.figs.container.visible = figModeRef.current;
    const asFigures = figModeRef.current ? L.figs.sync(tokens, { currentId, selectedId: selectedTokenId }) : new Set<string>();
    const sorted = [...tokens].sort((a, b) => a.y - b.y);
    for (const t of sorted) {
      // Em lugares escuros, heróis carregam uma tocha
      if (t.kind !== 'monstro' && !t.dead && MOOD_STYLE[mood].darkness > 0.2) lightList.push({ x: t.x + 0.5, y: t.y + 0.5, radius: 3, color: 0xffd9a0, flicker: true });
      if (asFigures.has(t.id)) continue;
      const c = new Container();
      c.position.set(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2);
      const color = parseInt((t.color ?? '#888888').replace('#', ''), 16);
      const g = new Graphics();
      g.ellipse(3, TILE * 0.36, TILE * 0.36, TILE * 0.12).fill({ color: 0x000000, alpha: 0.35 });
      if (t.id === currentId) g.circle(0, 0, TILE * 0.49).stroke({ width: 4, color: 0xffd34d, alpha: 0.95 });
      if (t.id === selectedTokenId) g.circle(0, 0, TILE * 0.46).stroke({ width: 3, color: 0x7cf3ff });
      g.circle(0, 0, TILE * 0.4).fill(t.dead ? 0x444444 : color).stroke({ width: 3, color: t.kind === 'monstro' ? 0x2a0000 : 0xffffff });
      c.addChild(g);
      const face = t.kind === 'personagem' && !t.dead ? getPortraitTexture(t.face) : null;
      const tex = face ?? (t.dead ? null : getArtTexture(artKeyFor(t)));
      const painted = !face && !t.dead && isPainted(artKeyFor(t));
      if (tex) {
        const icon = new Sprite(tex);
        icon.anchor.set(0.5);
        icon.width = icon.height = face ? TILE * 0.74 : painted ? TILE * 0.8 : TILE * 0.56;
        c.addChild(icon);
        if (painted) {
          // Pintura recortada no círculo do token, com aro escuro de monstro
          const mask = new Graphics().circle(0, 0, TILE * 0.38).fill(0xffffff);
          c.addChild(mask);
          icon.mask = mask;
          c.addChild(new Graphics().circle(0, 0, TILE * 0.39).stroke({ width: 3, color: t.kind === 'monstro' ? 0x7a1010 : 0xffffff }));
        }
        // Herói com rosto: ícone da classe pequeno no canto
        if (face) {
          const cls = getArtTexture(artKeyFor({ ...t, portrait: t.portrait }));
          if (cls) {
            const badge = new Graphics().circle(-TILE * 0.3, TILE * 0.28, 8).fill(color).stroke({ width: 1.5, color: 0xffffff });
            const ci = new Sprite(cls);
            ci.anchor.set(0.5);
            ci.width = ci.height = 12;
            ci.position.set(-TILE * 0.3, TILE * 0.28);
            c.addChild(badge, ci);
          }
        }
      } else {
        const label = new Text({ text: t.dead ? '✖' : t.name.slice(0, 2).toUpperCase(), style: { fontSize: 15, fontWeight: '700', fill: 0xffffff, stroke: { color: 0x000000, width: 3 } } });
        label.anchor.set(0.5);
        c.addChild(label);
      }
      if (t.emblem && !t.dead) {
        const badge = new Graphics().circle(TILE * 0.3, -TILE * 0.3, 9).fill(0x0b1020).stroke({ width: 1.5, color: 0xffd34d });
        const sym = new Text({ text: t.emblem, style: { fontSize: 11 } });
        sym.anchor.set(0.5);
        sym.position.set(TILE * 0.3, -TILE * 0.3);
        c.addChild(badge, sym);
      }
      const hp = typeof t.hp === 'number' && typeof t.maxHp === 'number' ? t.hp / Math.max(1, t.maxHp) : null;
      if (hp !== null && !t.dead) {
        c.addChild(new Graphics().roundRect(-TILE * 0.38, TILE * 0.4, TILE * 0.76, 6, 3).fill(0x220000).roundRect(-TILE * 0.38, TILE * 0.4, TILE * 0.76 * hp, 6, 3).fill(hp > 0.5 ? 0x4cd964 : hp > 0.25 ? 0xffcc00 : 0xff3b30));
      } else if ('hpStatus' in t && !t.dead) {
        const status = (t as { hpStatus: string }).hpStatus;
        const ring = status === 'ileso' ? 0x4cd964 : status === 'ferido' ? 0xffcc00 : 0xff3b30;
        c.addChild(new Graphics().circle(0, 0, TILE * 0.43).stroke({ width: 2, color: ring, alpha: 0.9 }));
      }
      if (t.conditions.length) {
        const icons = new Text({ text: t.conditions.slice(0, 3).map((k) => CONDITIONS[k]?.icon ?? '').join(''), style: { fontSize: 11 } });
        icons.anchor.set(0.5, 1);
        icons.position.set(0, -TILE * 0.4);
        c.addChild(icons);
      }
      if (t.hidden) c.alpha = 0.45;
      L.tokens.addChild(c);
    }

    // Copas das árvores ficam transparentes sobre tokens
    for (const [k, node] of built.canopyByCell) {
      const [x, y] = k.split(',').map(Number);
      node.alpha = tokens.some((t) => !t.dead && Math.abs(t.x - x) <= 0 && (t.y === y || t.y === y - 1)) ? 0.35 : 0.95;
    }

    // Luzes (brilho aditivo)
    for (const c of L.lights.removeChildren()) c.destroy();
    lightNodes.current = [];
    const strength = MOOD_STYLE[mood].darkness > 0.2 ? 0.55 : 0.22;
    for (const l of lightList) {
      const sp = new Sprite(glowTexture());
      sp.anchor.set(0.5);
      sp.position.set(l.x * TILE, l.y * TILE);
      sp.width = sp.height = l.radius * 2 * TILE;
      sp.tint = l.color;
      sp.alpha = strength;
      L.lights.addChild(sp);
      lightNodes.current.push({ node: sp, base: strength, flicker: !!l.flicker, phase: (l.x * 13 + l.y * 7) % 6 });
    }
    animRef.current = anim;

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
    const off2 = onPortraitLoaded(() => drawRef.current());
    void loadPaintedArt();
    return () => {
      off();
      off2();
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
    // Golpes e projéteis: o dano aparece no impacto
    const attacks = (fxQueue as FxEvent[]).filter((e) => e.fx.type === 'ataque');
    const impactDelay = (tokenId: string) => (attacks.some((a) => a.fx.type === 'ataque' && a.fx.targetId === tokenId) ? 280 : 0);
    const center = (t: { x: number; y: number }) => ({ x: t.x * TILE + TILE / 2, y: t.y * TILE + TILE / 2 });
    for (const { id, fx } of fxQueue as FxEvent[]) {
      used.push(id);
      if (fx.type === 'movimento') L.figs.onMove(fx.tokenId, fx.path);
      if (fx.type === 'ataque') {
        L.figs.onAttack(fx.tokenId, fx.targetId);
        const a = tokenPos(fx.tokenId);
        const b = tokenPos(fx.targetId);
        if (a && b) {
          const A = center(a), B = center(b);
          const ang = Math.atan2(B.y - A.y, B.x - A.x);
          if (Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1) {
            // Corpo a corpo: corte (heróis) ou garras (monstros)
            const g = new Graphics();
            if (a.kind === 'monstro') {
              for (let k = -1; k <= 1; k++) g.moveTo(-14, k * 8 - 10).lineTo(14, k * 8 + 10).stroke({ width: 3, color: 0xff5a5a, alpha: 0.95 });
            } else {
              g.arc(0, 0, TILE * 0.42, -1.1, 1.1).stroke({ width: 5, color: 0xffffff, alpha: 0.95 });
              g.arc(0, 0, TILE * 0.34, -0.9, 0.9).stroke({ width: 2, color: 0xfff3b0, alpha: 0.8 });
            }
            g.rotation = ang;
            g.position.set(B.x - Math.cos(ang) * 6, B.y - Math.sin(ang) * 6 - TILE * 0.2);
            L.fx.addChild(g);
            liveFx.current.push({ node: g, kind: 'slash', life: 320, max: 320, delay: 140 });
          } else {
            // À distância: flecha (heróis) ou bola de energia (monstros)
            const g = new Graphics();
            if (a.kind === 'monstro') g.circle(0, 0, 7).fill({ color: 0xff7a2a, alpha: 0.95 }).circle(0, 0, 4).fill(0xfff0a0);
            else g.moveTo(-12, 0).lineTo(10, 0).stroke({ width: 2.5, color: 0xe8d8b0 }).poly([10, -4, 16, 0, 10, 4]).fill(0xd0d0d0);
            g.rotation = ang;
            L.fx.addChild(g);
            liveFx.current.push({ node: g, kind: 'proj', life: 280, max: 280, from: { x: A.x, y: A.y - TILE * 0.3 }, to: { x: B.x, y: B.y - TILE * 0.3 } });
          }
        }
      }
      if (fx.type === 'dano') {
        L.figs.onHit(fx.tokenId, impactDelay(fx.tokenId));
        if (fx.amount >= 10) setTimeout(() => { shake.current = { t: 260, mag: Math.min(10, 3 + fx.amount / 4) }; }, impactDelay(fx.tokenId));
      }
      if (fx.type === 'explosao') shake.current = { t: 320, mag: 8 };
      if (fx.type === 'bau' || fx.type === 'revelar' || fx.type === 'poder') {
        const at = fx.type === 'poder' ? { x: fx.x ?? tokenPos(fx.tokenId)?.x ?? 0, y: fx.y ?? tokenPos(fx.tokenId)?.y ?? 0 } : fx;
        const cxp = at.x * TILE + TILE / 2;
        const cyp = at.y * TILE + TILE / 2;
        const color = fx.type === 'bau' ? 0xffd34d : fx.type === 'revelar' ? 0xc4b5fd : divinityColor(fx.divinity);
        const radius = fx.type === 'poder' ? ((fx.radius ?? 0) + 0.6) * TILE : TILE * 0.9;
        // Anel de luz que se expande
        const ring = new Graphics().circle(0, 0, radius).stroke({ width: 6, color, alpha: 0.95 }).circle(0, 0, radius * 0.75).stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
        ring.position.set(cxp, cyp);
        ring.blendMode = 'add';
        L.fx.addChild(ring);
        liveFx.current.push({ node: ring, kind: 'ring', life: 750, max: 750 });
        if (fx.type === 'poder') {
          const glow = new Graphics().circle(0, 0, radius).fill({ color, alpha: 0.35 });
          glow.position.set(cxp, cyp);
          glow.blendMode = 'add';
          spawn(glow, 'burst', 900);
          shake.current = { t: 260, mag: 5 };
          // Feixe do herói até o ponto
          const caster = tokenPos(fx.tokenId);
          if (caster) {
            const beam = new Graphics().moveTo(caster.x * TILE + TILE / 2, caster.y * TILE + TILE / 2 - TILE * 0.4).lineTo(cxp, cyp).stroke({ width: 5, color, alpha: 0.85 });
            beam.blendMode = 'add';
            L.fx.addChild(beam);
            liveFx.current.push({ node: beam, kind: 'float', life: 380, max: 380 });
          }
        }
        // Partículas: moedas (baú), estrelinhas (revelar), faíscas (poder)
        const n = fx.type === 'bau' ? 18 : fx.type === 'revelar' ? 14 : 26;
        for (let k = 0; k < n; k++) {
          const part = new Graphics();
          if (fx.type === 'bau') part.circle(0, 0, 3.5).fill(0xffd34d).stroke({ width: 1, color: 0x8a5a00 });
          else if (fx.type === 'revelar') part.star(0, 0, 4, 5, 2).fill(0xf5f3ff);
          else part.circle(0, 0, 2.6).fill(color);
          part.position.set(cxp + (Math.random() - 0.5) * 10, cyp - (fx.type === 'bau' ? 6 : 0));
          part.blendMode = fx.type === 'bau' ? 'normal' : 'add';
          const ang = fx.type === 'bau' ? -Math.PI / 2 + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2;
          const sp = fx.type === 'bau' ? 0.16 + Math.random() * 0.12 : 0.05 + Math.random() * (fx.type === 'poder' ? 0.22 : 0.09);
          L.fx.addChild(part);
          liveFx.current.push({
            node: part, kind: 'particle', life: 900 + Math.random() * 500, max: 1300,
            vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: fx.type === 'bau' ? 0.0006 : fx.type === 'revelar' ? -0.00005 : 0, spin: (Math.random() - 0.5) * 0.02,
          });
        }
      }
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
        const label = new Text({ text, style: { fontSize: fx.type === 'dano' && fx.amount >= 10 ? 26 : 20, fontWeight: '800', fill, stroke: { color: 0x000000, width: 4 } } });
        label.anchor.set(0.5);
        label.position.set(t.x * TILE + TILE / 2, t.y * TILE - (figModeRef.current ? TILE * 0.5 : 0));
        L.fx.addChild(label);
        liveFx.current.push({ node: label, kind: 'float', life: 1200, max: 1200, delay: fx.type === 'cura' ? 0 : impactDelay(fx.tokenId) });
      }
    }
    consumeFx(used);
  }, [fxQueue, consumeFx, state.tokens]);

  // Mapa pintado pela IA: carrega ao entrar e redesenha quando muda
  const campaignId = useTable((s) => s.campaignId);
  const [, bumpArt] = useState(0);
  useEffect(() => {
    if (campaignId) void loadMapArt(campaignId);
    return onMapArt(() => { bumpArt((n) => n + 1); drawRef.current(); });
  }, [campaignId]);
  const hasArt = !!mapArtFor(campaignId, state.map);
  const showPaint = hasArt && paintedMapPreferred();

  useEffect(() => {
    const off = onFiguresPref(() => { const m = figureMode(); layers.current?.figs.setMode(m); setMode(m); });
    return () => {
      off();
    };
  }, []);

  return (
    <div className={cx('relative', className ?? 'h-full w-full')}>
      <div ref={host} className="absolute inset-0" />
      <button
        type="button"
        onClick={() => setFigureMode(mode === 'ultra' ? 'alta' : mode === 'alta' ? 'leve' : mode === 'leve' ? 'fichas' : 'ultra')}
        title="Alternar: bonecos (alta) → bonecos (leve, para celular fraco) → fichas redondas"
        className="absolute bottom-2 right-2 z-10 rounded-full bg-slate-950/80 px-3 py-1.5 text-xs text-slate-100 ring-1 ring-white/15 hover:bg-slate-800"
      >
        {mode === 'ultra' ? '💎 Bonecos · ultra' : mode === 'alta' ? '🧍 Bonecos · alta' : mode === 'leve' ? '🧍 Bonecos · leve' : '⚪ Fichas'}
      </button>
      {hasArt && (
        <button
          type="button"
          onClick={() => setPaintedMapPreferred(!showPaint)}
          title="Mapa pintado pela IA do Mestre ou o desenho original"
          className="absolute bottom-2 right-40 z-10 rounded-full bg-slate-950/80 px-3 py-1.5 text-xs text-slate-100 ring-1 ring-white/15 hover:bg-slate-800"
        >
          {showPaint ? '🎨 Mapa pintado' : '🗺️ Mapa desenhado'}
        </button>
      )}
    </div>
  );
}
