/**
 * Renderização "RPG 2D" do mapa: texturas procedurais (geradas em Canvas2D, sem imagens externas),
 * bordas orgânicas entre terrenos (splatting por prioridade), paredes em perspectiva 3/4, árvores com copa
 * e sombra, água animada, objetos desenhados, luzes e ambiente por "mood".
 * A grade tática continua a mesma: cada casa = 1,5 m, e tudo é recalculado a partir do estado.
 */
import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { OBJECTS, cellHash, seededRng, valueNoise2D, fbm, type MapMood, type MapState, type TerrainType, type Tile } from '@mesa/shared';

export const TILE = 48;
const TEX = 64;
const SPLAT = 84; // textura com borda suave (sangra ~0,3 casa para os vizinhos)

// ───────────────────────────── Paletas ─────────────────────────────

type Rgb = [number, number, number];
const hex = (c: number): Rgb => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const css = ([r, g, b]: Rgb, a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c: Rgb, f: number): Rgb => [Math.min(255, c[0] * f), Math.min(255, c[1] * f), Math.min(255, c[2] * f)];

const PALETTE: Partial<Record<TerrainType, { a: number; b: number; detail: number }>> = {
  grama: { a: 0x4f8f34, b: 0x7cb342, detail: 0x2f6b22 },
  terra: { a: 0x7a5a3a, b: 0x9c7a52, detail: 0x5a3f27 },
  pedra: { a: 0x6c6c74, b: 0x8a8a92, detail: 0x4a4a52 },
  areia: { a: 0xd2b67c, b: 0xe8d6a0, detail: 0xb89a62 },
  marmore: { a: 0xdcd6ca, b: 0xf2eee6, detail: 0xa8a294 },
  nuvem: { a: 0xdfe8f3, b: 0xffffff, detail: 0xc4d2e4 },
  madeira: { a: 0x8a5a2e, b: 0xa8743f, detail: 0x5e3a1c },
  agua_rasa: { a: 0x3f8fc4, b: 0x6cc0e8, detail: 0xbfe8ff },
  agua_profunda: { a: 0x184f7a, b: 0x2a6fa0, detail: 0x6aa8d8 },
  estige: { a: 0x231a3a, b: 0x3a2a5c, detail: 0x8a6ad0 },
  lava: { a: 0xc2340f, b: 0xff7a1a, detail: 0xffe066 },
  abismo: { a: 0x05050a, b: 0x111120, detail: 0x6f6fa0 },
  escombros: { a: 0x7d746a, b: 0x958b80, detail: 0x5a524a },
  elevado: { a: 0x8f877b, b: 0xaaa296, detail: 0x6a6358 },
};

/** Terreno desenhado no chão sob elementos "altos" (árvore, parede…). */
function groundOf(t: TerrainType, mood?: MapMood): TerrainType {
  switch (t) {
    case 'arvore':
    case 'toco':
      return 'grama';
    case 'parede':
      return mood === 'olimpo' ? 'marmore' : 'pedra';
    case 'coluna':
      return mood === 'olimpo' ? 'marmore' : 'pedra';
    case 'portao':
      return 'terra';
    case 'ponte':
      return 'agua_profunda';
    case 'escombros':
      return 'terra';
    default:
      return t;
  }
}

/** Ordem de pintura: quem vem depois "sangra" por cima das bordas dos anteriores. */
const PRIORITY: TerrainType[] = ['abismo', 'agua_profunda', 'estige', 'agua_rasa', 'lava', 'areia', 'terra', 'pedra', 'grama', 'nuvem', 'escombros', 'elevado', 'madeira', 'marmore'];
const HARD_EDGE = new Set<TerrainType>(['madeira', 'marmore', 'abismo', 'elevado']);
const WATERY = new Set<TerrainType>(['agua_rasa', 'agua_profunda', 'estige']);

// ───────────────────────────── Texturas procedurais ─────────────────────────────

const texCache = new Map<string, Texture>();

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/** Pinta a textura base de um terreno num canvas (tamanho size, variação v). */
function paintTerrain(ctx: CanvasRenderingContext2D, t: TerrainType, size: number, v: number) {
  const p = PALETTE[t] ?? PALETTE.pedra!;
  const A = hex(p.a);
  const B = hex(p.b);
  const D = hex(p.detail);
  const rng = seededRng(1000 + PRIORITY.indexOf(t) * 31 + v * 7);
  const noise = valueNoise2D(rng);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Ruído "contínuo nas bordas": amostra num toro (mistura de 4 cantos)
      const fx = x / size;
      const fy = y / size;
      const n = (fbm(noise, x / 9, y / 9, 3) * (1 - fx) * (1 - fy) + fbm(noise, (x + size) / 9, y / 9, 3) * fx * (1 - fy) +
        fbm(noise, x / 9, (y + size) / 9, 3) * (1 - fx) * fy + fbm(noise, (x + size) / 9, (y + size) / 9, 3) * fx * fy);
      let c = mix(A, B, Math.min(1, Math.max(0, (n - 0.25) * 1.6)));
      const grain = (rng() - 0.5) * 14;
      c = [c[0] + grain, c[1] + grain, c[2] + grain];
      const i = (y * size + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const s = size / 64;
  // Detalhes por terreno
  ctx.lineCap = 'round';
  switch (t) {
    case 'grama': {
      for (let i = 0; i < 40; i++) {
        const x = rng() * size;
        const y = rng() * size;
        ctx.strokeStyle = css(rng() < 0.5 ? D : shade(B, 1.15), 0.7);
        ctx.lineWidth = 1.2 * s;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rng() - 0.5) * 3 * s, y - (3 + rng() * 4) * s);
        ctx.stroke();
      }
      if (v % 3 === 0) {
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = rng() < 0.5 ? '#fff8d0' : rng() < 0.5 ? '#ffd24d' : '#f2a6d0';
          ctx.beginPath();
          ctx.arc(rng() * size, rng() * size, 1.6 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'terra':
    case 'escombros':
    case 'areia': {
      const count = t === 'areia' ? 10 : 16;
      for (let i = 0; i < count; i++) {
        ctx.fillStyle = css(rng() < 0.6 ? D : shade(B, 1.1), 0.75);
        ctx.beginPath();
        ctx.ellipse(rng() * size, rng() * size, (1 + rng() * 2) * s, (0.8 + rng() * 1.4) * s, rng() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (t === 'areia') {
        ctx.strokeStyle = css(shade(B, 1.05), 0.5);
        ctx.lineWidth = 1 * s;
        for (let i = 0; i < 3; i++) {
          const y = (0.2 + i * 0.3 + rng() * 0.1) * size;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(size * 0.3, y - 3 * s, size * 0.6, y + 3 * s, size, y);
          ctx.stroke();
        }
      }
      break;
    }
    case 'pedra':
    case 'elevado': {
      // Lajes irregulares com rejunte
      ctx.strokeStyle = css(D, 0.85);
      ctx.lineWidth = 1.6 * s;
      const mid = size * (0.4 + rng() * 0.2);
      ctx.strokeRect(1, 1, size - 2, size - 2);
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(size, mid + (rng() - 0.5) * 6 * s);
      ctx.moveTo(size * (0.3 + rng() * 0.4), 0);
      ctx.lineTo(size * (0.3 + rng() * 0.4), mid);
      ctx.moveTo(size * (0.2 + rng() * 0.6), mid);
      ctx.lineTo(size * (0.2 + rng() * 0.6), size);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(2, 2, size - 4, 3 * s);
      break;
    }
    case 'marmore': {
      ctx.strokeStyle = css(D, 0.45);
      ctx.lineWidth = 0.9 * s;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(rng() * size, 0);
        ctx.bezierCurveTo(rng() * size, size * 0.3, rng() * size, size * 0.7, rng() * size, size);
        ctx.stroke();
      }
      ctx.strokeStyle = css(shade(D, 0.9), 0.7);
      ctx.lineWidth = 1.4 * s;
      ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
      break;
    }
    case 'madeira': {
      const planks = 4;
      for (let i = 0; i < planks; i++) {
        const y = (i * size) / planks;
        ctx.fillStyle = css(shade(B, 0.92 + rng() * 0.14), 0.35);
        ctx.fillRect(0, y, size, size / planks);
        ctx.strokeStyle = css(D, 0.9);
        ctx.lineWidth = 1.4 * s;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        const seam = rng() * size;
        ctx.moveTo(seam, y);
        ctx.lineTo(seam, y + size / planks);
        ctx.stroke();
        ctx.strokeStyle = css(D, 0.25);
        ctx.lineWidth = 0.8 * s;
        ctx.beginPath();
        ctx.moveTo(0, y + size / planks / 2);
        ctx.bezierCurveTo(size * 0.3, y + 2 * s, size * 0.7, y + size / planks - 2 * s, size, y + size / planks / 2);
        ctx.stroke();
      }
      break;
    }
    case 'agua_rasa':
    case 'agua_profunda':
    case 'estige': {
      ctx.strokeStyle = css(D, t === 'agua_rasa' ? 0.35 : 0.22);
      ctx.lineWidth = 1.3 * s;
      for (let i = 0; i < 6; i++) {
        const x = rng() * size;
        const y = rng() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + 5 * s, y - 2.5 * s, x + 10 * s, y);
        ctx.stroke();
      }
      break;
    }
    case 'lava': {
      ctx.strokeStyle = css(D, 0.9);
      ctx.lineWidth = 2 * s;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(rng() * size, rng() * size);
        ctx.lineTo(rng() * size, rng() * size);
        ctx.lineTo(rng() * size, rng() * size);
        ctx.stroke();
      }
      break;
    }
    case 'nuvem': {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.arc(rng() * size, rng() * size, (6 + rng() * 8) * s, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'abismo': {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = `rgba(200,200,255,${0.2 + rng() * 0.5})`;
        ctx.fillRect(rng() * size, rng() * size, s, s);
      }
      break;
    }
  }
}

export function terrainTexture(t: TerrainType, v: number): Texture {
  const key = `t:${t}:${v}`;
  let tex = texCache.get(key);
  if (!tex) {
    const c = canvas(TEX);
    paintTerrain(c.getContext('2d')!, t, TEX, v);
    tex = Texture.from(c);
    texCache.set(key, tex);
  }
  return tex;
}

/** Mesma textura, com borda de alfa irregular para mesclar com o vizinho. */
export function splatTexture(t: TerrainType, v: number): Texture {
  const key = `s:${t}:${v}`;
  let tex = texCache.get(key);
  if (!tex) {
    const c = canvas(SPLAT);
    const ctx = c.getContext('2d')!;
    // Repete a textura base em 3x3 para preencher a margem
    const base = canvas(TEX);
    paintTerrain(base.getContext('2d')!, t, TEX, v);
    const off = (SPLAT - TEX) / 2;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ctx.drawImage(base, off + dx * TEX, off + dy * TEX);
    const img = ctx.getImageData(0, 0, SPLAT, SPLAT);
    const noise = valueNoise2D(seededRng(77 + v * 13 + PRIORITY.indexOf(t)));
    for (let y = 0; y < SPLAT; y++) {
      for (let x = 0; x < SPLAT; x++) {
        const nx = (x - SPLAT / 2) / (SPLAT / 2);
        const ny = (y - SPLAT / 2) / (SPLAT / 2);
        // Distância "arredondada" (superelipse) + ruído para bordas orgânicas
        const d = Math.pow(Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4), 0.25);
        const wobble = (fbm(noise, x / 7, y / 7, 2) - 0.5) * 0.28;
        const edge = TEX / SPLAT; // 0..1 onde a casa termina
        const a = Math.max(0, Math.min(1, (1.02 - d + wobble) / (1.02 - edge * 0.92)));
        img.data[(y * SPLAT + x) * 4 + 3] = Math.round(255 * Math.min(1, a * 1.25));
      }
    }
    ctx.putImageData(img, 0, 0);
    tex = Texture.from(c);
    texCache.set(key, tex);
  }
  return tex;
}

/** Gradiente radial branco (luzes e brilho). */
export function glowTexture(): Texture {
  let tex = texCache.get('glow');
  if (!tex) {
    const c = canvas(128);
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    tex = Texture.from(c);
    texCache.set('glow', tex);
  }
  return tex;
}

/** Ruído em tons de cinza (mapa de deslocamento da água). */
export function noiseTexture(): Texture {
  let tex = texCache.get('noise');
  if (!tex) {
    const size = 128;
    const c = canvas(size);
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const noise = valueNoise2D(seededRng(4242));
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const n = fbm(noise, x / 12, y / 12, 3) * 255;
      const i = (y * size + x) * 4;
      img.data[i] = n;
      img.data[i + 1] = fbm(noise, x / 12 + 40, y / 12 + 40, 3) * 255;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    tex = Texture.from(c);
    texCache.set('noise', tex);
  }
  return tex;
}

// ───────────────────────────── Camadas estáticas ─────────────────────────────

export interface Light {
  x: number;
  y: number;
  radius: number;
  color: number;
  flicker?: boolean;
}

export interface Animated {
  node: Container;
  kind: 'flicker' | 'pulse' | 'bob' | 'sway' | 'custom';
  phase: number;
  base: number;
  /** Animação própria (ex.: fogo): recebe o relógio em segundos. */
  update?: (clock: number) => void;
}

/** Gota de chama com a base em (0,0), subindo até -h. */
function flameShape(g: Graphics, w: number, h: number, color: number, alpha = 1) {
  g.moveTo(-w, 0)
    .bezierCurveTo(-w * 1.15, -h * 0.35, -w * 0.35, -h * 0.6, 0, -h)
    .bezierCurveTo(w * 0.35, -h * 0.6, w * 1.15, -h * 0.35, w, 0)
    .bezierCurveTo(w * 0.6, w * 0.5, -w * 0.6, w * 0.5, -w, 0)
    .fill({ color, alpha });
}

/**
 * Fogo do braseiro: três línguas de chama ancoradas na bacia, cada uma tremulando e
 * balançando no seu ritmo, com brilho pulsando e faíscas subindo.
 */
function buildFire(x: number, y: number, phase: number, animated: Animated[]): Container {
  const fire = new Container();
  fire.position.set(x, y);
  const glow = new Graphics().circle(0, -6, 17).fill({ color: 0xff8a2a, alpha: 0.22 }).circle(0, -5, 10).fill({ color: 0xffb04a, alpha: 0.25 });
  glow.blendMode = 'add';
  fire.addChild(glow);
  const tongues: { node: Graphics; ph: number; sp: number; base: number }[] = [];
  const specs: [number, number, number, number][] = [
    // dx, largura, altura, cor
    [-5, 4.5, 13, 0xe8461a],
    [5, 4.5, 12, 0xe8461a],
    [0, 7, 20, 0xff6a14],
    [0, 5, 15, 0xffa12a],
    [0, 3, 9, 0xffe27a],
  ];
  specs.forEach(([dx, w, h, color], i) => {
    const t = new Graphics();
    flameShape(t, w, h, color, i < 2 ? 0.9 : 1);
    t.position.set(dx, 0);
    fire.addChild(t);
    tongues.push({ node: t, ph: phase + i * 1.7, sp: 9 + i * 2.3, base: dx });
  });
  // Faíscas que sobem, somem e recomeçam
  const sparks: { node: Graphics; off: number; dx: number; sp: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const sp = new Graphics().circle(0, 0, 1.2).fill(0xffd27a);
    sp.blendMode = 'add';
    fire.addChild(sp);
    sparks.push({ node: sp, off: (phase + i * 0.27) % 1, dx: (i - 1.5) * 3, sp: 0.55 + i * 0.12 });
  }
  animated.push({
    node: fire, kind: 'custom', phase, base: 1,
    update: (clock) => {
      for (const tg of tongues) {
        const n = Math.sin(clock * tg.sp + tg.ph) * 0.5 + Math.sin(clock * tg.sp * 1.9 + tg.ph * 2) * 0.3;
        tg.node.scale.y = 1 + n * 0.22;
        tg.node.scale.x = 1 - n * 0.08;
        tg.node.skew.x = Math.sin(clock * 2.1 + tg.ph) * 0.12 + Math.sin(clock * 5.3 + tg.ph) * 0.05;
        tg.node.x = tg.base + Math.sin(clock * 3.7 + tg.ph) * 0.6;
      }
      glow.alpha = 0.8 + Math.sin(clock * 7 + phase) * 0.12 + Math.sin(clock * 13 + phase) * 0.08;
      for (const s of sparks) {
        const t = (clock * s.sp + s.off) % 1;
        s.node.position.set(s.dx + Math.sin(t * 9 + s.off * 20) * 3, -6 - t * 24);
        s.node.alpha = t < 0.15 ? t / 0.15 : 1 - t;
      }
    },
  });
  return fire;
}

export interface StaticLayers {
  ground: Container;
  water: Container;
  features: Container;
  /** Barris, baús, estátuas…: ficam por cima do mapa pintado pela IA. */
  objects: Container;
  canopy: Container;
  canopyByCell: Map<string, Container>;
  lights: Light[];
  animated: Animated[];
}

const variantOf = (x: number, y: number, n = 4) => Math.floor(cellHash(x, y, 9) * n);

export function buildStaticLayers(map: MapState): StaticLayers {
  const ground = new Container();
  const water = new Container();
  const features = new Container();
  const objects = new Container();
  const canopy = new Container();
  const canopyByCell = new Map<string, Container>();
  const lights: Light[] = [];
  const animated: Animated[] = [];
  const mood = map.mood;
  const at = (x: number, y: number): Tile | undefined => (x >= 0 && y >= 0 && x < map.width && y < map.height ? map.tiles[y * map.width + x] : undefined);

  // Chão: uma camada sólida de base + "splats" por prioridade para bordas orgânicas
  const byGround = new Map<TerrainType, { x: number; y: number }[]>();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const g = groundOf(at(x, y)!.t, mood);
      if (!byGround.has(g)) byGround.set(g, []);
      byGround.get(g)!.push({ x, y });
    }
  }
  for (const t of PRIORITY) {
    const cells = byGround.get(t);
    if (!cells) continue;
    const target = WATERY.has(t) ? water : ground;
    for (const { x, y } of cells) {
      const v = variantOf(x, y);
      // Base sólida (garante que não sobra buraco) …
      const base = new Sprite(terrainTexture(t, v));
      base.position.set(x * TILE, y * TILE);
      base.width = base.height = TILE;
      target.addChild(base);
    }
  }
  for (const t of PRIORITY) {
    const cells = byGround.get(t);
    if (!cells || HARD_EDGE.has(t) || WATERY.has(t)) continue;
    for (const { x, y } of cells) {
      // … e o splat só onde a vizinhança é diferente (economiza sprites)
      const differs = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const n = at(x + dx, y + dy);
        return n && groundOf(n.t, mood) !== t && PRIORITY.indexOf(groundOf(n.t, mood)) < PRIORITY.indexOf(t);
      });
      if (!differs) continue;
      const sp = new Sprite(splatTexture(t, variantOf(x, y)));
      sp.anchor.set(0.5);
      sp.position.set(x * TILE + TILE / 2, y * TILE + TILE / 2);
      sp.width = sp.height = (TILE * SPLAT) / TEX;
      ground.addChild(sp);
    }
  }

  // Espuma nas margens da água
  const foam = new Graphics();
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const t = groundOf(at(x, y)!.t, mood);
      if (!WATERY.has(t)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const n = at(x + dx, y + dy);
        if (!n || WATERY.has(groundOf(n.t, mood))) continue;
        const px = x * TILE + (dx === 1 ? TILE - 3 : dx === -1 ? 0 : 4);
        const py = y * TILE + (dy === 1 ? TILE - 3 : dy === -1 ? 0 : 4);
        foam.rect(px, py, dx ? 3 : TILE - 8, dy ? 3 : TILE - 8).fill({ color: 0xffffff, alpha: t === 'estige' ? 0.12 : 0.35 });
      }
    }
  }
  ground.addChild(foam);

  // Lava brilha (luz + pulso)
  for (const { x, y } of byGround.get('lava') ?? []) {
    if (cellHash(x, y, 3) < 0.5) lights.push({ x: x + 0.5, y: y + 0.5, radius: 2.4, color: 0xff6a1a, flicker: true });
  }

  // Elementos altos e objetos
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = at(x, y)!;
      const px = x * TILE;
      const py = y * TILE;
      const h = cellHash(x, y, 5);
      switch (tile.t) {
        case 'parede': {
          const g = new Graphics();
          const south = at(x, y + 1);
          const top = mood === 'olimpo' ? 0xd9d2c4 : mood === 'submundo' ? 0x2c2833 : 0x5d5a63;
          const face = mood === 'olimpo' ? 0xa79f90 : mood === 'submundo' ? 0x1a1720 : 0x3b3940;
          if (!south || south.t !== 'parede') {
            g.rect(px, py + TILE, TILE, 8).fill({ color: 0x000000, alpha: 0.28 }); // sombra
            g.rect(px, py + TILE - 12, TILE, 12).fill(face); // face frontal
            for (let i = 0; i < 3; i++) g.rect(px + 4 + i * 15, py + TILE - 10, 1.5, 8).fill({ color: 0x000000, alpha: 0.25 });
          }
          g.rect(px, py - 6, TILE, TILE - 6).fill(top);
          // tijolos no topo
          for (let r = 0; r < 3; r++) {
            const yy = py - 6 + r * ((TILE - 6) / 3);
            g.moveTo(px, yy).lineTo(px + TILE, yy).stroke({ width: 1, color: 0x000000, alpha: 0.18 });
            const off = r % 2 ? TILE / 2 : TILE / 4;
            g.moveTo(px + off, yy).lineTo(px + off, yy + (TILE - 6) / 3).stroke({ width: 1, color: 0x000000, alpha: 0.18 });
          }
          g.rect(px, py - 6, TILE, 2).fill({ color: 0xffffff, alpha: 0.12 });
          features.addChild(g);
          break;
        }
        case 'coluna': {
          const g = new Graphics();
          const col = mood === 'submundo' ? 0x3a3540 : 0xe6e0d4;
          g.ellipse(px + TILE / 2 + 6, py + TILE - 6, TILE * 0.32, 7).fill({ color: 0x000000, alpha: 0.3 });
          g.rect(px + TILE * 0.28, py - 10, TILE * 0.44, TILE + 2).fill(col);
          g.rect(px + TILE * 0.28, py - 10, TILE * 0.1, TILE + 2).fill({ color: 0xffffff, alpha: 0.25 });
          g.rect(px + TILE * 0.62, py - 10, TILE * 0.1, TILE + 2).fill({ color: 0x000000, alpha: 0.15 });
          g.rect(px + TILE * 0.18, py - 14, TILE * 0.64, 6).fill(col).stroke({ width: 1, color: 0x000000, alpha: 0.25 });
          g.rect(px + TILE * 0.2, py + TILE - 10, TILE * 0.6, 6).fill(col).stroke({ width: 1, color: 0x000000, alpha: 0.25 });
          features.addChild(g);
          break;
        }
        case 'arvore': {
          const trunk = new Graphics();
          trunk.ellipse(px + TILE / 2 + 7, py + TILE - 6, TILE * 0.42, 9).fill({ color: 0x000000, alpha: 0.32 });
          trunk.rect(px + TILE / 2 - 3, py + TILE * 0.45, 6, TILE * 0.45).fill(0x5b3a1e);
          features.addChild(trunk);
          const c = new Container();
          const g = new Graphics();
          const base = mood === 'submundo' ? 0x2b3a2a : h < 0.5 ? 0x2f6b2a : 0x3a7d2e;
          const dark = 0x1f4a1c;
          const r = TILE * (0.42 + h * 0.12);
          const cx = px + TILE / 2;
          const cy = py + TILE * 0.32;
          g.circle(cx, cy + 3, r).fill(dark);
          g.circle(cx - r * 0.35, cy, r * 0.7).fill(base);
          g.circle(cx + r * 0.35, cy - 2, r * 0.68).fill(base);
          g.circle(cx, cy - r * 0.35, r * 0.62).fill(base);
          g.circle(cx - r * 0.2, cy - r * 0.45, r * 0.3).fill({ color: 0xffffff, alpha: 0.12 });
          c.addChild(g);
          // Gira em torno do tronco: a copa balança com o vento
          const baseY = py + TILE * 0.85;
          c.pivot.set(cx, baseY);
          c.position.set(cx, baseY);
          canopy.addChild(c);
          canopyByCell.set(`${x},${y}`, c);
          animated.push({ node: c, kind: 'sway', phase: h * 6.28 + x * 0.35, base: baseY });
          break;
        }
        case 'toco': {
          const g = new Graphics();
          g.ellipse(px + TILE / 2 + 3, py + TILE * 0.62, 12, 5).fill({ color: 0x000000, alpha: 0.25 });
          g.circle(px + TILE / 2, py + TILE / 2, 10).fill(0x7a5230).stroke({ width: 2, color: 0x4a301a });
          g.circle(px + TILE / 2, py + TILE / 2, 5).stroke({ width: 1, color: 0x4a301a, alpha: 0.7 });
          features.addChild(g);
          break;
        }
        case 'escombros': {
          const g = new Graphics();
          for (let i = 0; i < 5; i++) {
            const rx = px + 6 + cellHash(x, y, i) * (TILE - 12);
            const ry = py + 6 + cellHash(x, y, i + 9) * (TILE - 12);
            g.ellipse(rx + 2, ry + 3, 6, 3).fill({ color: 0x000000, alpha: 0.2 });
            g.poly([rx - 5, ry + 2, rx - 2, ry - 4, rx + 4, ry - 3, rx + 6, ry + 2, rx, ry + 4]).fill(0x8d847a).stroke({ width: 1, color: 0x4e4740 });
          }
          features.addChild(g);
          break;
        }
        case 'ponte': {
          const g = new Graphics();
          g.rect(px, py + 4, TILE, TILE - 8).fill(0x9a6c3a);
          for (let i = 0; i < 4; i++) g.rect(px + i * (TILE / 4) + 1, py + 4, 1.5, TILE - 8).fill({ color: 0x000000, alpha: 0.3 });
          g.rect(px, py + 2, TILE, 3).fill(0x6b4523);
          g.rect(px, py + TILE - 5, TILE, 3).fill(0x6b4523);
          g.rect(px, py + TILE - 2, TILE, 4).fill({ color: 0x000000, alpha: 0.25 });
          if (tile.hp !== undefined) g.moveTo(px + 10, py + 10).lineTo(px + 24, py + 30).stroke({ width: 2, color: 0x2a1a0a });
          features.addChild(g);
          break;
        }
        case 'portao': {
          const g = new Graphics();
          g.rect(px + 2, py - 4, TILE - 4, TILE).fill(0x7a5230).stroke({ width: 2, color: 0x3e2914 });
          g.rect(px + 2, py + 6, TILE - 4, 4).fill(0x4a4a4a);
          g.rect(px + 2, py + TILE - 16, TILE - 4, 4).fill(0x4a4a4a);
          g.circle(px + TILE - 12, py + TILE / 2, 3).fill(0xd4af37);
          g.rect(px, py + TILE - 4, TILE, 6).fill({ color: 0x000000, alpha: 0.25 });
          features.addChild(g);
          break;
        }
        case 'elevado': {
          const g = new Graphics();
          const south = at(x, y + 1);
          if (!south || south.t !== 'elevado') {
            g.rect(px, py + TILE - 8, TILE, 8).fill({ color: 0x4a443c, alpha: 0.95 });
            g.rect(px, py + TILE, TILE, 6).fill({ color: 0x000000, alpha: 0.25 });
          }
          g.rect(px, py, TILE, 2).fill({ color: 0xffffff, alpha: 0.25 });
          features.addChild(g);
          break;
        }
      }

      if (tile.o) objects.addChild(drawObject(tile, px, py, animated, lights, x, y));
    }
  }

  return { ground, water, features, objects, canopy, canopyByCell, lights, animated };
}

function drawObject(tile: Tile, px: number, py: number, animated: Animated[], lights: Light[], x: number, y: number): Container {
  const o = tile.o!;
  const c = new Container();
  const g = new Graphics();
  c.addChild(g);
  const cx = px + TILE / 2;
  const cy = py + TILE / 2;
  g.ellipse(cx + 4, py + TILE - 8, TILE * 0.3, 6).fill({ color: 0x000000, alpha: 0.3 });
  switch (o.type) {
    case 'barril_explosivo':
    case 'barril_agua':
    case 'barril_oleo': {
      const body = o.type === 'barril_explosivo' ? 0xb3261e : o.type === 'barril_agua' ? 0x2f7fc1 : 0x5a4515;
      g.roundRect(cx - 11, cy - 14, 22, 28, 7).fill(body).stroke({ width: 2, color: 0x2a1a0a });
      g.rect(cx - 11, cy - 7, 22, 3).fill(0x3a3a3a);
      g.rect(cx - 11, cy + 5, 22, 3).fill(0x3a3a3a);
      g.rect(cx - 7, cy - 13, 3, 26).fill({ color: 0xffffff, alpha: 0.18 });
      if (o.type === 'barril_explosivo') {
        g.poly([cx, cy - 4, cx + 4, cy + 2, cx - 4, cy + 2]).fill(0xffd24d);
      } else if (o.type === 'barril_agua') g.circle(cx, cy, 3).fill(0xbfe8ff);
      break;
    }
    case 'caixote':
      g.rect(cx - 13, cy - 12, 26, 24).fill(0xa0743c).stroke({ width: 2, color: 0x5a3b1a });
      g.moveTo(cx - 13, cy - 12).lineTo(cx + 13, cy + 12).moveTo(cx + 13, cy - 12).lineTo(cx - 13, cy + 12).stroke({ width: 2, color: 0x5a3b1a });
      break;
    case 'estatua':
      g.rect(cx - 13, cy + 6, 26, 8).fill(0xbfb8aa).stroke({ width: 1, color: 0x6a6458 });
      g.roundRect(cx - 7, cy - 10, 14, 18, 5).fill(0xd9d4c7).stroke({ width: 1, color: 0x6a6458 });
      g.circle(cx, cy - 15, 6).fill(0xd9d4c7).stroke({ width: 1, color: 0x6a6458 });
      break;
    case 'braseiro': {
      // Tripé e bacia de bronze
      g.moveTo(cx - 9, cy + 15).lineTo(cx - 5, cy + 5).moveTo(cx + 9, cy + 15).lineTo(cx + 5, cy + 5).moveTo(cx, cy + 16).lineTo(cx, cy + 6).stroke({ width: 2.5, color: 0x3a2a14 });
      g.poly([cx - 13, cy - 1, cx + 13, cy - 1, cx + 8, cy + 7, cx - 8, cy + 7]).fill(0x7a5a30).stroke({ width: 1.5, color: 0x2a1a08 });
      g.rect(cx - 13, cy - 2, 26, 3).fill(0x9a7440);
      // Brasas na bacia
      for (let k = 0; k < 5; k++) g.circle(cx - 8 + k * 4, cy - 2 + (k % 2), 2.6).fill(k % 2 ? 0xff7a1a : 0xc2410c);
      c.addChild(buildFire(cx, cy - 2, cellHash(x, y, 1) * 6.28, animated));
      lights.push({ x: x + 0.5, y: y + 0.5, radius: 3.2, color: 0xffa040, flicker: true });
      break;
    }
    case 'bau':
    case 'bau_aberto': {
      const open = o.type === 'bau_aberto';
      g.rect(cx - 15, cy - 4, 30, 16).fill(0x8a5a2b).stroke({ width: 2, color: 0x3e2410 });
      if (open) {
        g.poly([cx - 15, cy - 4, cx + 15, cy - 4, cx + 12, cy - 16, cx - 12, cy - 16]).fill(0x6e4520).stroke({ width: 2, color: 0x3e2410 });
        g.rect(cx - 13, cy - 4, 26, 4).fill(0x1a1208);
      } else {
        g.roundRect(cx - 15, cy - 14, 30, 11, 5).fill(0x9a6630).stroke({ width: 2, color: 0x3e2410 });
        g.rect(cx - 15, cy - 5, 30, 3).fill(0xd4af37);
        g.rect(cx - 3, cy - 7, 6, 8).fill(o.locked || o.lockDc ? 0x9ca3af : 0xd4af37).stroke({ width: 1, color: 0x3e2410 });
        const shine = new Graphics().circle(cx + 8, cy - 10, 2).fill(0xfff6c0);
        c.addChild(shine);
        animated.push({ node: shine, kind: 'pulse', phase: cellHash(x, y, 2) * 6.28, base: 1 });
      }
      break;
    }
    case 'espolio': {
      // Sacola de couro amarrada, com moedas espalhadas e um brilho
      g.ellipse(cx, cy + 9, 13, 4).fill({ color: 0x000000, alpha: 0.3 });
      g.poly([cx - 11, cy + 8, cx - 12, cy - 2, cx - 6, cy - 9, cx + 6, cy - 9, cx + 12, cy - 2, cx + 11, cy + 8]).fill(0x8a6a3a).stroke({ width: 2, color: 0x3e2a10 });
      g.rect(cx - 6, cy - 12, 12, 4).fill(0x6e5028).stroke({ width: 1.5, color: 0x3e2a10 });
      g.circle(cx - 13, cy + 8, 3).fill(0xd4af37).stroke({ width: 1, color: 0x7a5a10 });
      g.circle(cx + 14, cy + 6, 2.5).fill(0xd4af37).stroke({ width: 1, color: 0x7a5a10 });
      const glint = new Graphics().star(cx + 5, cy - 3, 4, 4, 1.5).fill(0xfff6c0);
      c.addChild(glint);
      animated.push({ node: glint, kind: 'pulse', phase: cellHash(x, y, 3) * 6.28, base: 1 });
      break;
    }
  }
  // Rachaduras quando danificado
  const def = OBJECTS[o.type];
  if (o.hp < def.maxHp && def.maxHp < 900) g.moveTo(cx - 6, cy - 8).lineTo(cx, cy).lineTo(cx + 5, cy + 7).stroke({ width: 2, color: 0x111111, alpha: 0.6 });
  if (o.hidden) {
    // Só o Mestre recebe objetos escondidos: desenha translúcido com um olho
    c.alpha = 0.45;
    const eye = new Graphics();
    eye.circle(px + TILE - 9, py + 9, 7).fill({ color: 0x1e1b4b, alpha: 0.9 }).stroke({ width: 1.5, color: 0xc4b5fd });
    eye.ellipse(px + TILE - 9, py + 9, 4.5, 2.6).stroke({ width: 1.2, color: 0xe9d5ff });
    eye.circle(px + TILE - 9, py + 9, 1.3).fill(0xe9d5ff);
    c.addChild(eye);
  }
  return c;
}

// ───────────────────────────── Ambiente ─────────────────────────────

export const MOOD_STYLE: Record<MapMood, { darkness: number; tint: number; vignette: number }> = {
  dia: { darkness: 0, tint: 0x000000, vignette: 0.25 },
  noite: { darkness: 0.5, tint: 0x0a1030, vignette: 0.45 },
  caverna: { darkness: 0.55, tint: 0x05060c, vignette: 0.5 },
  submundo: { darkness: 0.45, tint: 0x14051a, vignette: 0.55 },
  olimpo: { darkness: 0.06, tint: 0xffe8b0, vignette: 0.2 },
};

/** Fingerprint barato do que é estático (terreno + objetos), para cachear as camadas. */
/** Só o terreno (sem objetos): o mapa pintado pela IA continua válido quando um baú abre. */
export function terrainSignature(map: { width: number; height: number; tiles: { t: string }[] }): string {
  let h = 2166136261;
  const s = `${map.width}x${map.height}|${map.tiles.map((t) => t.t).join(',')}`;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

export function staticSignature(map: MapState): string {
  let h = 2166136261;
  const push = (s: string) => {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  };
  push(`${map.width}x${map.height}:${map.mood ?? ''}`);
  for (const t of map.tiles) push(`${t.t}${t.hp ?? ''}${t.o ? `${t.o.type}${t.o.hp}${t.o.locked || t.o.lockDc ? 'L' : ''}${t.o.hidden ? 'H' : ''}` : ''}|`);
  return String(h >>> 0);
}
