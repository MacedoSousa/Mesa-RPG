/**
 * Superfícies procedurais (pelo, escamas, penas, couro, pedra, bronze, osso, carapaça, lodo).
 * Cada uma é uma textura neutra (tons de cinza) + relevo; a cor vem do material ou das
 * cores por vértice (dorso escuro, barriga clara). Tudo desenhado por código e repetível.
 */
import * as THREE from 'three';
import type { Surface3D } from '@mesa/shared';

const SIZE = 256;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Desenha nas 9 posições (bordas emendam sem costura). */
function wrap(draw: (dx: number, dy: number) => void) {
  for (const dx of [-SIZE, 0, SIZE]) for (const dy of [-SIZE, 0, SIZE]) draw(dx, dy);
}

const gray = (v: number, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;

/** Células de Voronoi (pedra, carapaça): distância ao 1º e 2º ponto mais perto, com emenda. */
function voronoi(g: CanvasRenderingContext2D, n: number, seed: number, paint: (d1: number, d2: number, cell: number) => number) {
  const r = rng(seed);
  const pts: [number, number][] = Array.from({ length: n }, () => [r() * SIZE, r() * SIZE]);
  const shade = pts.map(() => r());
  const img = g.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let d1 = 1e9, d2 = 1e9, c = 0;
    for (let i = 0; i < n; i++) {
      let dx = Math.abs(x - pts[i][0]); dx = Math.min(dx, SIZE - dx);
      let dy = Math.abs(y - pts[i][1]); dy = Math.min(dy, SIZE - dy);
      const d = dx * dx + dy * dy;
      if (d < d1) { d2 = d1; d1 = d; c = i; } else if (d < d2) d2 = d;
    }
    const v = paint(Math.sqrt(d1), Math.sqrt(d2), shade[c]);
    const k = (y * SIZE + x) * 4;
    img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
    img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

const PAINTERS: Record<Surface3D, (g: CanvasRenderingContext2D, r: () => number) => void> = {
  pelo(g, r) {
    g.fillStyle = gray(200); g.fillRect(0, 0, SIZE, SIZE);
    g.lineCap = 'round';
    for (let i = 0; i < 3200; i++) {
      const x = r() * SIZE, y = r() * SIZE, len = 6 + r() * 12, a = Math.PI / 2 + (r() - 0.5) * 0.7;
      const v = 140 + r() * 115;
      g.strokeStyle = gray(v, 0.55); g.lineWidth = 0.8 + r() * 1.4;
      wrap((dx, dy) => { g.beginPath(); g.moveTo(x + dx, y + dy); g.lineTo(x + dx + Math.cos(a) * len, y + dy + Math.sin(a) * len); g.stroke(); });
    }
  },
  escamas(g) {
    g.fillStyle = gray(90); g.fillRect(0, 0, SIZE, SIZE);
    const s = 16;
    for (let row = -1; row <= SIZE / (s * 0.55) + 1; row++) {
      const y = row * s * 0.55;
      for (let col = -1; col <= SIZE / s + 1; col++) {
        const x = col * s + (row % 2 ? s / 2 : 0);
        wrap((dx, dy) => {
          const cx = x + dx, cy = y + dy;
          const grd = g.createRadialGradient(cx, cy - s * 0.15, 1, cx, cy, s * 0.62);
          grd.addColorStop(0, gray(255)); grd.addColorStop(0.65, gray(205)); grd.addColorStop(1, gray(120));
          g.fillStyle = grd;
          g.beginPath(); g.arc(cx, cy, s * 0.56, 0, Math.PI); g.closePath(); g.fill();
          g.strokeStyle = gray(70, 0.8); g.lineWidth = 1.2; g.stroke();
        });
      }
    }
  },
  couro(g, r) {
    g.fillStyle = gray(210); g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 260; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 4 + r() * 22;
      g.fillStyle = gray(r() < 0.5 ? 170 : 240, 0.18);
      wrap((dx, dy) => { g.beginPath(); g.arc(x + dx, y + dy, rad, 0, Math.PI * 2); g.fill(); });
    }
    g.strokeStyle = gray(120, 0.35); g.lineWidth = 1;
    for (let i = 0; i < 140; i++) {
      const x = r() * SIZE, y = r() * SIZE, l = 10 + r() * 30, a = r() * Math.PI;
      wrap((dx, dy) => { g.beginPath(); g.moveTo(x + dx, y + dy); g.quadraticCurveTo(x + dx + Math.cos(a) * l * 0.5 + 4, y + dy + Math.sin(a) * l * 0.5 - 4, x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l); g.stroke(); });
    }
  },
  penas(g, r) {
    g.fillStyle = gray(120); g.fillRect(0, 0, SIZE, SIZE);
    const w = 22, h = 34;
    for (let row = -1; row <= SIZE / (h * 0.5) + 1; row++) for (let col = -1; col <= SIZE / w + 1; col++) {
      const x = col * w + (row % 2 ? w / 2 : 0), y = row * h * 0.5;
      const v = 190 + r() * 60;
      wrap((dx, dy) => {
        const cx = x + dx, cy = y + dy;
        g.fillStyle = gray(v);
        g.beginPath(); g.ellipse(cx, cy, w * 0.55, h * 0.55, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = gray(110, 0.5); g.lineWidth = 1; g.stroke();
        g.strokeStyle = gray(150, 0.7); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(cx, cy - h * 0.5); g.lineTo(cx, cy + h * 0.5); g.stroke();
        g.strokeStyle = gray(160, 0.35); g.lineWidth = 0.6;
        for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(cx, cy + k * 4); g.lineTo(cx - w * 0.45, cy + k * 4 + 5); g.moveTo(cx, cy + k * 4); g.lineTo(cx + w * 0.45, cy + k * 4 + 5); g.stroke(); }
      });
    }
  },
  pedra(g, r) {
    voronoi(g, 22, 7, (d1, d2, c) => {
      const edge = d2 - d1;
      return edge < 2.2 ? 95 : 185 + c * 60 + (r() - 0.5) * 24;
    });
    for (let i = 0; i < 900; i++) { g.fillStyle = gray(r() < 0.5 ? 130 : 250, 0.25); g.fillRect(r() * SIZE, r() * SIZE, 2, 2); }
  },
  bronze(g, r) {
    g.fillStyle = gray(205); g.fillRect(0, 0, SIZE, SIZE);
    for (let y = 0; y < SIZE; y += 2) { g.fillStyle = gray(180 + r() * 60, 0.25); g.fillRect(0, y, SIZE, 1); }
    for (let i = 0; i < 500; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 3 + r() * 5;
      const grd = g.createRadialGradient(x - 1, y - 1, 0, x, y, rad);
      grd.addColorStop(0, gray(250, 0.5)); grd.addColorStop(1, gray(150, 0));
      g.fillStyle = grd;
      wrap((dx, dy) => { g.beginPath(); g.arc(x + dx, y + dy, rad, 0, Math.PI * 2); g.fill(); });
    }
    // Placas rebitadas
    g.strokeStyle = gray(110, 0.8); g.lineWidth = 2;
    for (let y = 0; y <= SIZE; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(SIZE, y); g.stroke(); }
    for (let y = 0; y < SIZE; y += 64) for (let x = 8; x < SIZE; x += 24) {
      g.fillStyle = gray(240); g.beginPath(); g.arc(x, y + 7, 2.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = gray(120); g.beginPath(); g.arc(x + 0.8, y + 7.8, 1.2, 0, Math.PI * 2); g.fill();
    }
  },
  osso(g, r) {
    g.fillStyle = gray(232); g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 1400; i++) { g.fillStyle = gray(150 + r() * 60, 0.35); g.beginPath(); g.arc(r() * SIZE, r() * SIZE, 0.6 + r() * 1.2, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = gray(160, 0.4); g.lineWidth = 0.8;
    for (let i = 0; i < 30; i++) {
      let x = r() * SIZE, y = r() * SIZE;
      g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 18; y += r() * 14; g.lineTo(x, y); }
      g.stroke();
    }
  },
  carapaca(g) {
    voronoi(g, 14, 11, (d1, d2, c) => {
      const edge = d2 - d1;
      if (edge < 3) return 40;
      // Cada placa com brilho no meio, como quitina polida
      return Math.min(255, 140 + c * 60 + Math.max(0, 40 - d1) * 1.6);
    });
  },
  lodo(g, r) {
    g.fillStyle = gray(170); g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < 90; i++) {
      const x = r() * SIZE, y = r() * SIZE, rad = 8 + r() * 30;
      const grd = g.createRadialGradient(x, y, 0, x, y, rad);
      const v = r() < 0.5 ? 230 : 120;
      grd.addColorStop(0, gray(v, 0.5)); grd.addColorStop(1, gray(v, 0));
      g.fillStyle = grd;
      wrap((dx, dy) => { g.beginPath(); g.arc(x + dx, y + dy, rad, 0, Math.PI * 2); g.fill(); });
    }
    for (let i = 0; i < 120; i++) { g.fillStyle = gray(255, 0.7); g.beginPath(); g.arc(r() * SIZE, r() * SIZE, 0.8 + r() * 1.8, 0, Math.PI * 2); g.fill(); }
  },
};

/** Ajustes de material de cada superfície (brilho, metal, relevo). */
export const SURFACE_LOOK: Record<Surface3D, { roughness: number; metalness: number; bump: number; repeat: number }> = {
  pelo: { roughness: 0.92, metalness: 0, bump: 0.035, repeat: 2.5 },
  escamas: { roughness: 0.45, metalness: 0.05, bump: 0.03, repeat: 3 },
  couro: { roughness: 0.75, metalness: 0, bump: 0.02, repeat: 2 },
  penas: { roughness: 0.85, metalness: 0, bump: 0.03, repeat: 2.5 },
  pedra: { roughness: 0.95, metalness: 0, bump: 0.05, repeat: 1.5 },
  bronze: { roughness: 0.38, metalness: 0.85, bump: 0.02, repeat: 1.5 },
  osso: { roughness: 0.7, metalness: 0, bump: 0.02, repeat: 1.5 },
  carapaca: { roughness: 0.35, metalness: 0.1, bump: 0.04, repeat: 1.5 },
  lodo: { roughness: 0.18, metalness: 0.05, bump: 0.025, repeat: 1.5 },
};

const texCache = new Map<string, THREE.CanvasTexture>();

/** Textura neutra da superfície (cache por superfície e repetição). */
export function surfaceTexture(surface: Surface3D, repeat = SURFACE_LOOK[surface].repeat): THREE.CanvasTexture {
  const key = `${surface}@${repeat}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  let base = texCache.get(`${surface}@base`);
  if (!base) {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    PAINTERS[surface](c.getContext('2d')!, rng(surface.length * 977 + 13));
    base = new THREE.CanvasTexture(c);
    texCache.set(`${surface}@base`, base);
  }
  const t = base.clone();
  t.needsUpdate = true;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Material com a superfície; com `vertexColors` a cor vem dos vértices (dorso/barriga). */
export function surfaceMat(surface: Surface3D, color: string, opts: { vertexColors?: boolean; repeat?: number; emissive?: string; emissiveIntensity?: number; transparent?: boolean; opacity?: number; side?: THREE.Side } = {}) {
  const look = SURFACE_LOOK[surface];
  const map = surfaceTexture(surface, opts.repeat ?? look.repeat);
  return new THREE.MeshStandardMaterial({
    color: opts.vertexColors ? '#ffffff' : color,
    map,
    bumpMap: map,
    bumpScale: look.bump,
    roughness: look.roughness,
    metalness: look.metalness,
    vertexColors: !!opts.vertexColors,
    flatShading: false,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

/**
 * Pinta os vértices: dorso na cor do corpo, barriga clara (contra-sombreamento, como nos
 * animais de verdade). `up` é o eixo "para cima" no espaço da geometria.
 */
export function shadeBelly(geo: THREE.BufferGeometry, top: string, belly: string, up: THREE.Vector3 = new THREE.Vector3(0, 1, 0), bias = 0.15) {
  const n = geo.getAttribute('normal') as THREE.BufferAttribute;
  const A = new THREE.Color(top), B = new THREE.Color(belly), tmp = new THREE.Color();
  const cols = new Float32Array(n.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i);
    const d = v.dot(up); // 1 = dorso, -1 = barriga
    const t = THREE.MathUtils.smoothstep(-d + bias, -0.1, 0.9);
    tmp.copy(A).lerp(B, t);
    // Dorso um pouco mais escuro: dá volume
    if (d > 0.6) tmp.multiplyScalar(0.88);
    cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  return geo;
}
