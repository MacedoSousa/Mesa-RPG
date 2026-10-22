/**
 * Heróis em 3D e o palco do criador de personagem (three.js).
 *
 * Modelos: KayKit Adventurers (CC0, Kay Lousberg). O núcleo (carregar, recolorir,
 * armas, animações) está em figure.ts e vale também para os monstros (monsters3d.ts).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ultraGraphics } from '../figureLayer';
import { DIVINITIES, baseItemKey } from '@mesa/shared';
import type { BodyKey, HeroLook, PortraitSpec } from '../index';
import { buildRigFigure, markOwn, mat, mix, skinCells, type AtlasChange, type Figure, type HeadMetrics, type HeroAction, type RigSpec } from './figure';
import { cyclopsEyeMesh } from './creatures';
import { buildMonsterFigure } from './monsters3d';

export type { HeroAction } from './figure';

export const CLASS_BODY: Record<string, BodyKey> = {
  barbaro: 'barbarian', guerreiro: 'knight', paladino: 'knight', clerigo: 'knight',
  mago: 'mage', feiticeiro: 'mage', bruxo: 'mage', druida: 'mage',
  ladino: 'rogue_hooded', patrulheiro: 'rogue_hooded', bardo: 'rogue', monge: 'rogue',
};

export const DIVINE_COLOR: Record<string, string> = {
  nao_reclamado: '#cbd5e1', zeus: '#7fd4ff', poseidon: '#22c1c3', hades: '#8b5cf6', atena: '#d6d3c4', ares: '#ef4444',
  apolo: '#fbbf24', artemis: '#c7d2fe', hefesto: '#fb7a1a', afrodite: '#f472b6', hermes: '#a3e635', dionisio: '#a855f7',
  demeter: '#d4a72c', hecate: '#c084fc', nemesis: '#94a3b8', hipnos: '#818cf8', pa: '#65a30d',
};

/** Faixas do atlas (coluna, linha) que são a roupa principal de cada corpo. */
const OUTFIT_CELLS: Record<BodyKey, [number, number][]> = {
  knight: [[0, 1], [2, 2]],
  barbarian: [[0, 1], [1, 1], [2, 2]],
  mage: [[0, 1], [1, 1], [7, 1]],
  rogue: [[0, 1], [1, 1], [1, 2]],
  rogue_hooded: [[0, 1], [1, 1], [1, 2]],
};

export interface HeroConfig {
  classKey: string;
  race: string;
  divinity: string;
  portrait: PortraitSpec | null;
  equipment: { mainHand?: string | null; offHand?: string | null; shield?: string | null; armor?: string | null };
  inventory?: string[];
}

/** O que mostrar no palco: um herói (ficha) ou um monstro do bestiário. */
export type StageSubject = { hero: HeroConfig } | { monster: string };

export function heroBody(cfg: HeroConfig): BodyKey {
  const look: HeroLook = cfg.portrait?.look ?? {};
  return look.body && look.body !== 'auto' ? look.body : CLASS_BODY[cfg.classKey] ?? 'knight';
}

/** Converte a ficha do herói na receita do boneco. */
export function heroRigSpec(cfg: HeroConfig): RigSpec {
  const spec = cfg.portrait;
  const look: HeroLook = spec?.look ?? {};
  const body = heroBody(cfg);
  const isCyclops = cfg.race === 'ciclope' || spec?.race === 'ciclope';
  const heavy = ['armadura_placas', 'cota_de_malha', 'meia_armadura'].includes(baseItemKey(cfg.equipment.armor ?? ''));
  const headgearOn = look.headgear ?? (body === 'knight' ? heavy : body !== 'barbarian');
  const covered = body === 'rogue_hooded' || headgearOn;
  const h = look.height ?? (isCyclops ? 1.12 : cfg.race === 'satiro' ? 0.95 : 1);
  const b = look.build ?? (cfg.classKey === 'barbaro' || isCyclops ? 1.06 : 1);
  return {
    body,
    hideEyes: isCyclops,
    headgear: headgearOn,
    scale: { h, b },
    style: ['mago', 'feiticeiro', 'bruxo', 'druida', 'clerigo'].includes(cfg.classKey) ? 'caster' : cfg.classKey === 'monge' ? 'monk' : undefined,
    weapons: { ...cfg.equipment, inventory: cfg.inventory, wandIfEmpty: ['mago', 'feiticeiro', 'bruxo'].includes(cfg.classKey) },
    recolor: (src) => {
      const changes: AtlasChange[] = [];
      if (spec?.skin) changes.push({ cells: skinCells(src), color: spec.skin });
      // Cabeça raspada: o cabelo vira uma sombra de barba por fazer
      if (spec?.hairColor) changes.push({ cells: [[1, 0]], color: spec.hair === 'raspado' && spec.skin ? mix(spec.skin, spec.hairColor, 0.3) : spec.hairColor });
      if (isCyclops && spec?.skin) changes.push({ cells: [[2, 0]], color: mix(spec.skin, '#000000', 0.1) });
      else if (spec?.eyeColor) changes.push({ cells: [[2, 0]], color: mix(spec.eyeColor, '#000000', 0.55) });
      if (look.outfit) changes.push({ cells: OUTFIT_CELLS[body], color: look.outfit });
      return changes;
    },
    adorn: (p) => {
      const a = p.anchor('head');
      if (a && p.head) {
        a.add(headAdornments(spec, cfg.race, p.head, body === 'rogue_hooded'));
        if (spec) a.add(hairAndFace(spec, p.head, { covered, beardBaked: body === 'barbarian' }));
      }
    },
  };
}

export function buildHeroFigure(cfg: HeroConfig) {
  return buildRigFigure(heroRigSpec(cfg));
}

/** Chifres de sátiro, coroa de folhas, olho de ciclope, louros… presos ao osso da cabeça. */
/**
 * O que o jogador escolheu no rosto 2D também aparece no 3D: penteado (rabo, coque, tranças,
 * black power, longo, arrepiado, cacheado), barba e acessórios (elmo grego, brincos, óculos).
 */
function hairAndFace(spec: PortraitSpec, head: HeadMetrics, o: { covered: boolean; beardBaked: boolean }) {
  const g = new THREE.Group();
  const hair = mat(spec.hairColor ?? '#3a2416', { roughness: 0.85 });
  const eyeY = head.eyes ? (head.eyes.l.y + head.eyes.r.y) / 2 : head.top * 0.45;
  const cx = head.eyes ? (head.eyes.l.x + head.eyes.r.x) / 2 : 0;
  const W = head.width;
  const add = (m: THREE.Mesh, x: number, y: number, z: number) => { m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const backZ = head.back;
  switch (spec.hair) {
    case 'rabo': {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(cx, head.top - 0.18, backZ + 0.08), new THREE.Vector3(cx, head.top - 0.3, backZ - 0.12), new THREE.Vector3(cx, head.top - 0.62, backZ - 0.16), new THREE.Vector3(cx, head.top - 0.85, backZ - 0.06)]);
      g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.075, 7), hair));
      add(new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 5, 10), mat('#c0392b')), cx, head.top - 0.3, backZ - 0.1).rotation.x = 1.2;
      break;
    }
    case 'coque':
      if (!o.covered) add(new THREE.Mesh(new THREE.SphereGeometry(W * 0.2, 10, 8), hair), cx, head.top + 0.02, backZ * 0.35);
      break;
    case 'trancas':
      for (const s of [-1, 1]) for (let i = 0; i < 6; i++) add(new THREE.Mesh(new THREE.SphereGeometry(0.055 - i * 0.003, 6, 5), hair), cx + s * W * 0.44, eyeY - 0.05 - i * 0.1, -0.02 - i * 0.015);
      break;
    case 'black_power':
      if (!o.covered) { const m = add(new THREE.Mesh(new THREE.IcosahedronGeometry(W * 0.62, 1), hair), cx, head.top - 0.12, backZ * 0.3); m.scale.set(1.05, 0.85, 1); }
      break;
    case 'longo': {
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 0.75, 0.12), hair), cx, head.top - 0.55, backZ - 0.01);
      m.rotation.x = 0.12;
      break;
    }
    case 'arrepiado':
      if (!o.covered) for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; const c = add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), hair), cx + Math.sin(a) * W * 0.32, head.top + 0.02, Math.cos(a) * 0.12 - 0.05); c.rotation.z = -a * 0.6; }
      break;
    case 'cacheado':
      if (!o.covered) for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 6, 5), hair), cx + Math.sin(a) * W * 0.38, head.top - 0.06 + (i % 2) * 0.05, Math.cos(a) * W * 0.32 - 0.04); }
      break;
  }
  // Barba
  if (!o.beardBaked && spec.beard && spec.beard !== 'nenhuma') {
    const beard = mat(spec.hairColor ?? '#3a2416', { roughness: 0.9 });
    const front = head.front;
    if (spec.beard === 'cheia' || spec.beard === 'curta') {
      const full = spec.beard === 'cheia';
      const b = add(new THREE.Mesh(new THREE.SphereGeometry(W * 0.3, 10, 6, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), beard), cx, eyeY - 0.22, front - 0.17);
      b.scale.set(1.0, full ? 1.05 : 0.6, 0.7);
      if (full) add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 6), beard), cx, eyeY - 0.47, front - 0.05).rotation.x = Math.PI;
    }
    if (spec.beard === 'cavanhaque') add(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), beard), cx, eyeY - 0.36, front - 0.02).rotation.x = Math.PI;
    if (spec.beard === 'bigode' || spec.beard === 'cavanhaque') {
      for (const s of [-1, 1]) { const m = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.1, 3, 6), beard), cx + s * 0.06, eyeY - 0.17, front + 0.005); m.rotation.z = s * 1.2; }
    }
  }
  // Acessórios
  const acc = spec.accessory;
  if (acc === 'brinco') for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.009, 5, 10), mat('#d4a020', { metalness: 0.9, roughness: 0.2 })), cx + s * W * 0.5, eyeY - 0.12, -0.02).rotation.y = Math.PI / 2;
  if (acc === 'oculos' && head.eyes) {
    const frame = mat('#2a2a2a', { metalness: 0.4 });
    for (const e of [head.eyes.l, head.eyes.r]) add(new THREE.Mesh(new THREE.TorusGeometry(head.eyes.size * 1.6, 0.015, 5, 16), frame), e.x, e.y, e.z + 0.035);
    add(new THREE.Mesh(new THREE.BoxGeometry(Math.abs(head.eyes.r.x - head.eyes.l.x) * 0.35, 0.012, 0.012), frame), cx, eyeY + 0.01, head.eyes.l.z + 0.035);
  }
  if (acc === 'elmo' && !o.covered) {
    // Elmo coríntio: cúpula de bronze e crista vermelha
    const bronze = mat('#c98f3a', { metalness: 0.75, roughness: 0.3 });
    const dome = add(new THREE.Mesh(new THREE.SphereGeometry(W * 0.56, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), bronze), cx, head.top - 0.3, -0.03);
    dome.scale.set(1, 0.95, 1.05);
    const crest = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, W * 1.0), mat('#b91c1c', { roughness: 0.9 })), cx, head.top + 0.02, -0.06);
    crest.scale.y = 1.2;
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.2), bronze), cx + s * W * 0.5, eyeY - 0.05, 0.08);
  }
  markOwn(g);
  return g;
}

function headAdornments(spec: PortraitSpec | null, race: string, head: HeadMetrics, hooded: boolean) {
  const g = new THREE.Group();
  const feature = spec?.race ?? '';
  // Debaixo de um capuz não cabem coroas nem diademas
  const acc = hooded ? 'nenhum' : spec?.accessory ?? 'nenhum';
  const isSatyr = race === 'satiro' || feature === 'satiro';
  const isNymph = !hooded && (race === 'ninfa' || feature === 'ninfa');
  const isCyclops = race === 'ciclope' || feature === 'ciclope';
  const isHuntress = !hooded && (race === 'cacador_artemis' || feature === 'cacadora');
  if (isSatyr) {
    const horn = mat('#e7dcc4', { roughness: 0.8 });
    for (const s of [-1, 1]) {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(s * head.width * 0.24, head.top - 0.1, head.front * 0.25),
        new THREE.Vector3(s * head.width * 0.3, head.top + 0.12, head.front * 0.05),
        new THREE.Vector3(s * head.width * 0.4, head.top + 0.2, -head.front * 0.35),
        new THREE.Vector3(s * head.width * 0.5, head.top + 0.05, -head.front * 0.62),
      ]);
      const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.075, 7), horn);
      m.castShadow = true;
      g.add(m);
    }
  }
  if (isNymph || acc === 'louros') {
    const leafMat = mat(acc === 'louros' && !isNymph ? '#d4a020' : '#4f9a45', { metalness: acc === 'louros' && !isNymph ? 0.6 : 0, side: THREE.DoubleSide });
    const n = 22;
    const r = head.width * 0.5;
    const band = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 4, 32), leafMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = head.top - 0.3;
    g.add(band);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      if (!isNymph && Math.cos(a) > 0.92) continue; // louros abertos na testa
      for (const tilt of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.075, 6, 3).scale(0.45, 1, 0.2), leafMat);
        leaf.position.set(Math.sin(a) * r, head.top - 0.27 + tilt * 0.035, Math.cos(a) * r);
        leaf.rotation.set(0, a, tilt * 0.9);
        g.add(leaf);
      }
    }
    if (isNymph) for (let i = 0; i < 3; i++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), mat(['#f9a8d4', '#fde68a', '#fff'][i], { emissive: '#331122', emissiveIntensity: 0.3 }));
      const a = -0.9 + i * 0.9;
      fl.position.set(Math.sin(a) * head.width * 0.48, head.top - 0.12, Math.cos(a) * head.width * 0.48);
      g.add(fl);
    }
  }
  if (acc === 'diadema' || isHuntress) {
    const d = new THREE.Mesh(new THREE.TorusGeometry(head.width * 0.47, 0.018, 4, 24), mat(isHuntress ? '#dbe4ff' : '#d4a020', { metalness: 0.8, roughness: 0.25 }));
    d.rotation.x = Math.PI / 2;
    d.position.y = head.top - 0.2;
    g.add(d);
    if (isHuntress) {
      const moon = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.016, 4, 12, Math.PI * 1.3), mat('#eef2ff', { emissive: '#c7d2fe', emissiveIntensity: 0.8 }));
      moon.position.set(0, head.top - 0.12, head.front * 0.98);
      moon.rotation.z = Math.PI * 0.85;
      g.add(moon);
    }
  }
  if (acc === 'faixa') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(head.width * 0.5, 0.035, 4, 24), mat('#c0392b'));
    band.rotation.x = Math.PI / 2;
    band.position.y = head.top - 0.28;
    g.add(band);
  }
  if (isCyclops) g.add(cyclopsEyeMesh(head, spec?.eyeColor ?? '#6b4423'));
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.userData.own = true; });
  return g;
}

// ───────────── Palco ─────────────

function gradientTexture(top: string, bottom: string) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, top);
  grd.addColorStop(1, bottom);
  g.fillStyle = grd;
  g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pedestalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5b5a63';
  g.fillRect(0, 0, 512, 512);
  // Mármore manchado
  for (let i = 0; i < 2600; i++) {
    const v = 70 + Math.random() * 60;
    g.fillStyle = `rgba(${v},${v},${v + 8},${Math.random() * 0.25})`;
    g.fillRect(Math.random() * 512, Math.random() * 512, 3 + Math.random() * 8, 3 + Math.random() * 8);
  }
  // Anéis e meandro grego
  g.translate(256, 256);
  g.strokeStyle = '#c9a85a';
  g.lineWidth = 6;
  for (const r of [238, 196]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
  g.lineWidth = 5;
  const steps = 40;
  for (let i = 0; i < steps; i++) {
    g.save();
    g.rotate((i / steps) * Math.PI * 2);
    g.beginPath();
    g.moveTo(-10, -232); g.lineTo(-10, -204); g.lineTo(10, -204); g.lineTo(10, -224); g.lineTo(0, -224); g.lineTo(0, -214);
    g.stroke();
    g.restore();
  }
  g.lineWidth = 3;
  g.globalAlpha = 0.5;
  for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 30); g.lineTo(0, 190); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function symbolSprite(symbol: string, color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 10, 128, 128, 120);
  grd.addColorStop(0, color + 'cc');
  grd.addColorStop(0.5, color + '44');
  grd.addColorStop(1, color + '00');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  g.font = '140px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 30;
  g.fillText(symbol, 128, 140);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  s.scale.set(0.9, 0.9, 0.9);
  return s;
}

export class HeroStage {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
  private clock = new THREE.Clock();
  private hero: Figure | null = null;
  private loadToken = 0;
  private auraLight: THREE.PointLight;
  private faceLight: THREE.DirectionalLight;
  private rim: THREE.SpotLight;
  private ring: THREE.Mesh;
  private particles: THREE.Points;
  private particleSpeed: Float32Array;
  private symbol: THREE.Sprite | null = null;
  private symbolLife = 0;
  private burst = 0;
  private yaw = 0;
  private yawVel = 0;
  private zoom = 0; // 0 = corpo inteiro, 1 = rosto
  private zoomTarget = 0;
  private config: HeroConfig | null = null;
  private subjectKey = '';
  private resizeObs: ResizeObserver;
  private disposed = false;
  /** Ultra: brilho (bloom) e supersampling, para placas de vídeo dedicadas. */
  private composer: EffectComposer | null = null;
  private bloom: UnrealBloomPass | null = null;
  onLoading?: (loading: boolean) => void;
  onError?: (e: unknown) => void;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    const ultra = ultraGraphics();
    this.renderer.setPixelRatio(ultra ? Math.min((window.devicePixelRatio || 1) * 1.5, 3) : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.style.display = 'block';
    host.appendChild(this.renderer.domElement);

    const s = this.scene;
    s.background = gradientTexture('#1b2240', '#07080f');
    s.fog = new THREE.Fog('#0b0f1e', 6, 16);
    // Reflexos suaves para metais (bronze celestial, escudos)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.35;
    pmrem.dispose();

    s.add(new THREE.HemisphereLight('#bcd2ff', '#2a1d14', 0.55));
    const key = new THREE.DirectionalLight('#ffe2b8', 1.7);
    key.position.set(2.5, 5, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(ultra ? 2048 : 1024, ultra ? 2048 : 1024);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 15;
    key.shadow.camera.left = -2.5; key.shadow.camera.right = 2.5; key.shadow.camera.top = 3.5; key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.02;
    s.add(key);
    const fill = new THREE.DirectionalLight('#8fb3ff', 0.6);
    fill.position.set(-3, 2, 2);
    s.add(fill);
    // Luz de rosto que acompanha a câmera (peles escuras não somem na sombra)
    this.faceLight = new THREE.DirectionalLight('#fff1e0', 0.9);
    s.add(this.faceLight, this.faceLight.target);
    this.rim = new THREE.SpotLight('#cbd5e1', 18, 10, Math.PI / 5, 0.6);
    this.rim.position.set(0, 3.5, -3);
    this.rim.target.position.set(0, 1, 0);
    s.add(this.rim, this.rim.target);
    this.auraLight = new THREE.PointLight('#cbd5e1', 2, 3.2);
    this.auraLight.position.set(0, 0.35, 0.4);
    s.add(this.auraLight);

    // Pedestal de mármore com anel de energia divina
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.38, 0.28, 48),
      [new THREE.MeshStandardMaterial({ color: '#4c4a55', roughness: 0.85 }), new THREE.MeshStandardMaterial({ map: pedestalTexture(), roughness: 0.7 }), new THREE.MeshStandardMaterial({ color: '#2a2930' })],
    );
    ped.position.y = -0.14;
    ped.receiveShadow = true;
    s.add(ped);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.31, 0.025, 6, 64), new THREE.MeshBasicMaterial({ color: '#cbd5e1', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending }));
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.005;
    s.add(this.ring);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), new THREE.MeshStandardMaterial({ color: '#101422', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.28;
    floor.receiveShadow = true;
    s.add(floor);

    // Colunas gregas ao fundo, perdidas na névoa
    const colMat = new THREE.MeshStandardMaterial({ color: '#59607a', roughness: 0.9 });
    for (const [x, z] of [[-3.2, -3.4], [3.2, -3.4], [-5.6, -1.2], [5.6, -1.2], [-1.2, -5.5], [1.2, -5.5]]) {
      const col = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 5, 14), colMat);
      shaft.position.y = 2.2;
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.22, 0.85), colMat);
      cap.position.y = 4.8;
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.8), colMat);
      base.position.y = -0.15;
      col.add(shaft, cap, base);
      col.position.set(x, 0, z);
      s.add(col);
    }

    // Partículas subindo (cor do pai olímpico)
    const N = 160;
    const pos = new Float32Array(N * 3);
    this.particleSpeed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = 0.4 + Math.random() * 1.1;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 3; pos[i * 3 + 2] = Math.sin(a) * r;
      this.particleSpeed[i] = 0.15 + Math.random() * 0.35;
    }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.particles = new THREE.Points(pg, new THREE.PointsMaterial({ color: '#cbd5e1', size: 0.028, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.add(this.particles);

    if (ultra) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.42, 0.55, 0.82);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }

    this.bindInput();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  // ───── Entrada: arrastar gira, pinça/roda aproxima ─────
  private bindInput() {
    const el = this.renderer.domElement;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
    el.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      if (pts.size === 1) {
        const dx = e.clientX - p.x;
        this.yawVel = dx * 0.012;
        this.yaw += dx * 0.012;
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget + (d - pinch) * 0.006, 0, 1);
        pinch = d;
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget - e.deltaY * 0.0015, 0, 1); }, { passive: false });
  }

  setFocus(f: 'corpo' | 'rosto') { this.zoomTarget = f === 'rosto' ? 1 : 0; }
  rotate(delta: number) { this.yawVel = delta; }

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(w, h, false);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.composer?.setSize(w, h);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ───── Montar o herói (ou monstro) ─────
  async update(cfg: HeroConfig) {
    return this.show({ hero: cfg });
  }

  async show(subject: StageSubject) {
    const key = JSON.stringify(subject);
    if (key === this.subjectKey) return;
    this.subjectKey = key;
    const prev = this.config;
    const cfg = 'hero' in subject ? subject.hero : null;
    this.config = cfg;
    this.setDivineColor(cfg ? DIVINE_COLOR[cfg.divinity] ?? '#cbd5e1' : '#ff5a3a');
    const token = ++this.loadToken;
    this.onLoading?.(true);
    try {
      const fig = 'hero' in subject ? await buildHeroFigure(subject.hero) : await buildMonsterFigure(subject.monster);
      if (token !== this.loadToken || this.disposed) { fig.dispose(); return; }
      const old = this.hero;
      if (old) { this.scene.remove(old.root); old.dispose(); }
      this.hero = fig;
      this.scene.add(fig.root);
      // Feras de quatro patas ficam ilegíveis de frente: começa em três-quartos
      if ('monster' in subject) this.yaw = -0.65;
      // Reações às mudanças, como num criador de personagem de videogame
      if (prev && cfg) {
        if (prev.divinity !== cfg.divinity) this.play('reclamado');
        else if (prev.classKey !== cfg.classKey) this.play('atacar');
        else if (prev.race !== cfg.race) this.play('comemorar');
        else if (JSON.stringify(prev.equipment) !== JSON.stringify(cfg.equipment)) this.play('atacar');
      }
    } catch (e) {
      this.onError?.(e);
    } finally {
      if (token === this.loadToken) this.onLoading?.(false);
    }
  }

  /** Dispara uma ação com a animação certa para a arma empunhada. */
  play(action: HeroAction) {
    if (action === 'magia') this.burst = 1;
    if (action === 'reclamado') { this.showSymbol(); this.burst = 1; }
    this.hero?.play(action);
  }

  idle() { this.hero?.play('parado'); }

  private setDivineColor(color: string) {
    const c = new THREE.Color(color);
    this.rim.color.copy(c);
    this.auraLight.color.copy(c);
    (this.ring.material as THREE.MeshBasicMaterial).color.copy(c);
    (this.particles.material as THREE.PointsMaterial).color.copy(c);
  }

  /** O símbolo do deus brilhando sobre a cabeça: o "reclamado" dos livros. */
  private showSymbol() {
    const cfg = this.config;
    if (!cfg || !this.hero) return;
    if (this.symbol) { this.scene.remove(this.symbol); this.symbol.material.map?.dispose(); this.symbol.material.dispose(); }
    const sym = (DIVINITIES as Record<string, { symbol: string }>)[cfg.divinity]?.symbol ?? '✦';
    this.symbol = symbolSprite(sym, DIVINE_COLOR[cfg.divinity] ?? '#ffffff');
    this.symbol.position.set(0, this.hero.height + 0.55, 0);
    this.scene.add(this.symbol);
    this.symbolLife = 3.2;
  }

  private tick() {
    const dt = Math.min(0.1, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    const h = this.hero;
    if (h) {
      h.update(dt);
      this.yaw += this.yawVel * dt * 4;
      this.yawVel *= Math.pow(0.04, dt);
      h.root.rotation.y = this.yaw;
    }
    // Câmera: corpo inteiro ↔ rosto
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 5);
    const H = h?.height ?? 2.4;
    const aspect = this.camera.aspect;
    const S = Math.max(H, (h?.radius ?? 1) * 1.7);
    const fitDist = (S * 0.85) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / Math.min(1, aspect * 1.25);
    const bodyLook = new THREE.Vector3(0, H * 0.5, 0), faceLook = new THREE.Vector3(0, H * 0.74, 0);
    const look = bodyLook.lerp(faceLook, this.zoom);
    const dist = THREE.MathUtils.lerp(fitDist, H * 1.45, this.zoom);
    this.camera.position.set(0, look.y + THREE.MathUtils.lerp(H * 0.12, 0.05, this.zoom), dist);
    this.camera.lookAt(look);
    this.faceLight.position.copy(this.camera.position).add(new THREE.Vector3(0.6, 0.8, 0));
    this.faceLight.target.position.copy(look);

    // Partículas e aura
    const pos = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute;
    const boost = 1 + this.burst * 5;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + this.particleSpeed[i] * dt * boost;
      if (y > 3.2) y = 0;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
    this.burst = Math.max(0, this.burst - dt * 0.6);
    this.auraLight.intensity = 2 + Math.sin(t * 2.2) * 0.4 + this.burst * 10;
    (this.ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + Math.sin(t * 1.7) * 0.2 + this.burst * 0.4;
    if (this.symbol) {
      this.symbolLife -= dt;
      const life = this.symbolLife;
      this.symbol.material.opacity = Math.max(0, Math.min(1, life < 1 ? life : (3.2 - life) * 2));
      this.symbol.position.y += dt * 0.05;
      this.symbol.material.rotation = Math.sin(t * 1.5) * 0.08;
      if (life <= 0) { this.scene.remove(this.symbol); this.symbol.material.map?.dispose(); this.symbol.material.dispose(); this.symbol = null; }
    }
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  /** Foto do herói (PNG) para usar como retrato. */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    this.disposed = true;
    this.composer?.dispose();
    this.bloom?.dispose();
    this.renderer.setAnimationLoop(null);
    this.resizeObs.disconnect();
    if (this.hero) { this.scene.remove(this.hero.root); this.hero.dispose(); this.hero = null; }
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh || (o as THREE.Points).isPoints) {
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        mats.forEach((x) => { (x as THREE.MeshStandardMaterial)?.map?.dispose(); x?.dispose(); });
      }
    });
    (this.scene.background as THREE.Texture | null)?.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
