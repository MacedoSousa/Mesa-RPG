/**
 * Motor 3D do criador de personagem (three.js).
 *
 * Modelos: KayKit Adventurers (CC0, Kay Lousberg). Todos os corpos compartilham o mesmo
 * esqueleto, então as animações vêm de um único arquivo (anims.glb) e as armas são
 * anexadas aos ossos "handslot" em tempo real. A textura de cada corpo é um atlas de
 * faixas de cor: trocamos faixas inteiras para mudar pele, cabelo, olhos e roupa.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DIVINITIES, ITEMS } from '@mesa/shared';
import type { BodyKey, HeroLook, PortraitSpec } from '@mesa/common';

const BASE = '/models/';
const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
const load = (path: string) => {
  let p = cache.get(path);
  if (!p) {
    p = loader.loadAsync(BASE + path);
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
};

// ───────────── Tabelas de jogo → visual ─────────────

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
const HEADGEAR = /Helmet|_Hat$|Hat$/;

type Grip = 'nenhuma' | 'uma' | 'duas' | 'arco' | 'besta' | 'cajado';
interface WeaponVisual { asset?: string; proc?: 'arco' | 'lanca' | 'tridente' | 'martelo' | 'maca' | 'clava' | 'glaive' | 'lira'; grip: Grip; tint?: string }

const WEAPON_VISUAL: Record<string, WeaponVisual> = {
  adaga: { asset: 'dagger', grip: 'uma' }, foice_curta: { asset: 'dagger', grip: 'uma' }, dardo: { asset: 'dagger', grip: 'uma' },
  clava: { proc: 'clava', grip: 'uma' }, maca: { proc: 'maca', grip: 'uma' }, bordao: { asset: 'staff', grip: 'cajado' },
  lanca: { proc: 'lanca', grip: 'duas' }, azagaia: { proc: 'lanca', grip: 'uma' }, lanca_adamante: { proc: 'lanca', grip: 'duas', tint: '#9aa7b8' },
  funda: { grip: 'nenhuma' },
  besta_leve: { asset: 'crossbow_2handed', grip: 'besta' }, besta_de_mao: { asset: 'crossbow_1handed', grip: 'besta' },
  arco_curto: { proc: 'arco', grip: 'arco' }, arco_longo: { proc: 'arco', grip: 'arco' }, arco_de_apolo: { proc: 'arco', grip: 'arco', tint: '#f5c542' },
  espada_curta: { asset: 'sword_1handed', grip: 'uma' }, espada_longa: { asset: 'sword_1handed', grip: 'uma' },
  rapieira: { asset: 'sword_1handed', grip: 'uma' }, cimitarra: { asset: 'sword_1handed', grip: 'uma' },
  espada_bronze_celestial: { asset: 'sword_1handed', grip: 'uma', tint: '#e0a542' },
  montante: { asset: 'sword_2handed', grip: 'duas' }, machado_grande: { asset: 'axe_2handed', grip: 'duas' },
  martelo_guerra: { proc: 'martelo', grip: 'uma' }, martelo_forja: { proc: 'martelo', grip: 'uma', tint: '#e0a542' },
  tridente: { proc: 'tridente', grip: 'duas' }, tridente_mares: { proc: 'tridente', grip: 'duas', tint: '#3fc1c9' },
  glaive: { proc: 'glaive', grip: 'duas' },
};

function weaponVisual(key: string | null | undefined): WeaponVisual | null {
  if (!key) return null;
  if (WEAPON_VISUAL[key]) return WEAPON_VISUAL[key];
  const item = ITEMS[key];
  if (!item || item.kind !== 'arma') return null;
  // Itens personalizados do Mestre: escolhe pelo perfil da arma.
  if (item.properties.includes('distancia')) return { proc: 'arco', grip: 'arco' };
  if (item.properties.includes('duas_maos')) return { asset: 'sword_2handed', grip: 'duas' };
  return { asset: 'sword_1handed', grip: 'uma' };
}

export interface HeroConfig {
  classKey: string;
  race: string;
  divinity: string;
  portrait: PortraitSpec | null;
  equipment: { mainHand?: string | null; offHand?: string | null; shield?: string | null; armor?: string | null };
  inventory?: string[];
}

export type HeroAction = 'atacar' | 'defender' | 'comemorar' | 'magia' | 'esquivar' | 'andar' | 'correr' | 'pular' | 'ferido' | 'sentar' | 'reclamado' | 'interagir' | 'cair' | 'parado';

// ───────────── Recolorir o atlas ─────────────

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function recolorAtlas(img: CanvasImageSource & { width: number; height: number }, changes: { cells: [number, number][]; color: string; keep?: number }[]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const cw = c.width / 8, ch = c.height / 4;
  for (const { cells, color, keep = 0 } of changes) {
    const [tr, tg, tb] = hexToRgb(color);
    for (const [cx, cy] of cells) {
      const data = g.getImageData(cx * cw, cy * ch, cw, ch);
      const d = data.data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const mean = Math.max(1, sum / (d.length / 4));
      for (let i = 0; i < d.length; i += 4) {
        const f = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / mean;
        d[i] = Math.min(255, (tr * f) * (1 - keep) + d[i] * keep);
        d[i + 1] = Math.min(255, (tg * f) * (1 - keep) + d[i + 1] * keep);
        d[i + 2] = Math.min(255, (tb * f) * (1 - keep) + d[i + 2] * keep);
      }
      g.putImageData(data, cx * cw, cy * ch);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** Faixas da textura cuja cor média parece pele (o tom padrão do KayKit). */
function skinCells(img: CanvasImageSource & { width: number; height: number }): [number, number][] {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 4;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, 8, 4);
  const d = g.getImageData(0, 0, 8, 4).data;
  const out: [number, number][] = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
    const i = (y * 8 + x) * 4;
    const dist = Math.hypot(d[i] - 0xf0, d[i + 1] - 0xb5, d[i + 2] - 0x90);
    if (dist < 38) out.push([x, y]);
  }
  if (!out.some(([x, y]) => x === 0 && y === 0)) out.push([0, 0]);
  return out;
}

function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, '0')).join('');
}

// ───────────── Armas e adornos procedurais ─────────────

const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, flatShading: true, ...opts });

function procWeapon(kind: NonNullable<WeaponVisual['proc']>, tint?: string): THREE.Object3D {
  const g = new THREE.Group();
  const wood = mat('#7a5230');
  const metal = mat(tint ?? '#b8c2cc', { metalness: 0.7, roughness: 0.35 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number, rx = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.y = y; mesh.rotation.x = rx; mesh.castShadow = true;
    g.add(mesh);
    return mesh;
  };
  switch (kind) {
    case 'lanca':
    case 'glaive':
    case 'tridente': {
      add(new THREE.CylinderGeometry(0.025, 0.025, 1.9, 6), wood, 0.45);
      if (kind === 'lanca') add(new THREE.ConeGeometry(0.06, 0.28, 6), metal, 1.52);
      if (kind === 'glaive') { const b = add(new THREE.BoxGeometry(0.03, 0.42, 0.14), metal, 1.55); b.position.z = 0.04; }
      if (kind === 'tridente') {
        add(new THREE.BoxGeometry(0.3, 0.04, 0.04), metal, 1.4);
        for (const x of [-0.13, 0, 0.13]) { const p = add(new THREE.ConeGeometry(0.035, x === 0 ? 0.36 : 0.28, 5), metal, 1.58); p.position.x = x; }
      }
      break;
    }
    case 'martelo':
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.75, 6), wood, 0.2);
      add(new THREE.BoxGeometry(0.32, 0.18, 0.18), metal, 0.6);
      break;
    case 'maca':
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.65, 6), wood, 0.15);
      add(new THREE.DodecahedronGeometry(0.12), metal, 0.52);
      break;
    case 'clava':
      add(new THREE.CylinderGeometry(0.09, 0.03, 0.75, 7), wood, 0.25);
      break;
    case 'arco': {
      // Na mão esquerda o eixo Y do osso aponta para a frente e o X para cima:
      // as pontas ficam no eixo X e o punho (barriga do arco) à frente.
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.62, -0.2, 0), new THREE.Vector3(0, 0.2, 0), new THREE.Vector3(0.62, -0.2, 0));
      const bowMat = tint ? mat(tint, { metalness: 0.6, roughness: 0.3, emissive: tint, emissiveIntensity: 0.25 }) : wood;
      const limb = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.025, 5), bowMat);
      limb.castShadow = true;
      g.add(limb);
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.24, 3), mat('#f1f5f9'));
      string.rotation.z = Math.PI / 2;
      string.position.y = -0.2;
      g.add(string);
      break;
    }
    case 'lira': {
      const frame = mat(tint ?? '#d4a020', { metalness: 0.6, roughness: 0.3 });
      const arm = new THREE.TorusGeometry(0.16, 0.022, 5, 12, Math.PI);
      const m = new THREE.Mesh(arm, frame);
      m.position.y = 0.2;
      g.add(m);
      add(new THREE.BoxGeometry(0.36, 0.05, 0.05), frame, 0.05);
      for (const x of [-0.08, 0, 0.08]) { const s = add(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 3), mat('#fff'), 0.2); s.position.x = x; }
      break;
    }
  }
  g.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.userData.own = true; });
  g.userData.proc = true;
  return g;
}

function tintObject(o: THREE.Object3D, color: string) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      m.material = (m.material as THREE.MeshStandardMaterial).clone();
      const sm = m.material as THREE.MeshStandardMaterial;
      sm.color = new THREE.Color(color);
      sm.metalness = 0.75; sm.roughness = 0.3;
      sm.emissive = new THREE.Color(color);
      sm.emissiveIntensity = 0.12;
    }
  });
}

/** Chifres de sátiro, coroa de folhas, olho de ciclope, louros… presos ao osso da cabeça. */
function headAdornments(spec: PortraitSpec | null, race: string, head: { top: number; front: number; width: number }, hooded: boolean) {
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
  if (isCyclops) {
    const eye = new THREE.Group();
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), mat('#ffffff', { flatShading: false, roughness: 0.2 }));
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), mat(spec?.eyeColor ?? '#6b4423', { flatShading: false, roughness: 0.2 }));
    iris.position.z = 0.09;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 6), mat('#0b0b0b', { flatShading: false }));
    pupil.position.z = 0.13;
    eye.add(white, iris, pupil);
    eye.position.set(0, head.top * 0.42, head.front * 0.88);
    eye.scale.z = 0.6;
    eye.name = 'olho_ciclope';
    g.add(eye);
  }
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

interface LoadedHero {
  root: THREE.Group;
  model: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  grip: Grip;
  height: number;
  headBone: THREE.Object3D | null;
  dispose: () => void;
}

export class HeroStage {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(32, 1, 0.05, 60);
  private clock = new THREE.Clock();
  private hero: LoadedHero | null = null;
  private loadToken = 0;
  private idleClip = 'Idle';
  private current: THREE.AnimationAction | null = null;
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
  private resizeObs: ResizeObserver;
  private disposed = false;
  onLoading?: (loading: boolean) => void;
  onError?: (e: unknown) => void;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
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
    key.shadow.mapSize.set(1024, 1024);
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
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ───── Montar o herói ─────
  async update(cfg: HeroConfig) {
    const prev = this.config;
    this.config = cfg;
    const look: HeroLook = cfg.portrait?.look ?? {};
    const body: BodyKey = look.body && look.body !== 'auto' ? look.body : CLASS_BODY[cfg.classKey] ?? 'knight';
    this.setDivineColor(DIVINE_COLOR[cfg.divinity] ?? '#cbd5e1');
    const token = ++this.loadToken;
    this.onLoading?.(true);
    try {
      const [gltf, anims] = await Promise.all([load(`${body}.glb`), load('anims.glb')]);
      const weapons = await this.loadWeapons(cfg);
      if (token !== this.loadToken || this.disposed) return;
      const hero = this.build(gltf, anims, cfg, body, weapons);
      const old = this.hero;
      if (old) { this.scene.remove(old.root); old.dispose(); }
      this.hero = hero;
      this.scene.add(hero.root);
      this.idleClip = hero.grip === 'duas' ? '2H_Melee_Idle' : hero.grip === 'nenhuma' && cfg.classKey === 'monge' ? 'Unarmed_Idle' : 'Idle';
      this.current = null;
      this.playLoop(this.idleClip, 0);
      // Reações às mudanças, como num criador de personagem de videogame
      if (prev) {
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

  private async loadWeapons(cfg: HeroConfig) {
    const out: { slot: 'r' | 'l'; obj: THREE.Object3D; kind: string }[] = [];
    const grab = async (asset: string) => cloneSkinned((await load(`weapons/${asset}.glb`)).scene);
    const main = weaponVisual(cfg.equipment.mainHand);
    const off = weaponVisual(cfg.equipment.offHand);
    if (main) {
      const obj = main.asset ? await grab(main.asset) : main.proc ? procWeapon(main.proc, main.tint) : null;
      if (obj) {
        if (main.tint && main.asset) tintObject(obj, main.tint);
        out.push({ slot: main.grip === 'arco' ? 'l' : 'r', obj, kind: main.grip === 'besta' ? 'besta' : main.grip });
      }
    }
    if (off && main?.grip !== 'duas' && main?.grip !== 'arco') {
      const obj = off.asset ? await grab(off.asset) : off.proc ? procWeapon(off.proc, off.tint) : null;
      if (obj) out.push({ slot: 'l', obj, kind: 'offhand' });
    }
    const leftFree = !out.some((w) => w.slot === 'l') && main?.grip !== 'duas' && main?.grip !== 'besta';
    if (cfg.equipment.shield && leftFree) {
      const obj = await grab(cfg.equipment.shield === 'escudo_bronze' ? 'shield_badge' : 'shield_round');
      if (cfg.equipment.shield === 'escudo_bronze') tintObject(obj, '#c98f3a');
      out.push({ slot: 'l', obj, kind: 'escudo' });
    } else if (leftFree && cfg.inventory?.includes('grimorio')) {
      out.push({ slot: 'l', obj: await grab('spellbook_closed'), kind: 'livro' });
    } else if (leftFree && cfg.inventory?.includes('lira')) {
      out.push({ slot: 'l', obj: procWeapon('lira'), kind: 'lira' });
    } else if (!main && ['mago', 'feiticeiro', 'bruxo'].includes(cfg.classKey)) {
      out.push({ slot: 'r', obj: await grab('wand'), kind: 'varinha' });
    }
    if (main?.grip === 'arco') out.push({ slot: 'r', obj: await grab('quiver'), kind: 'aljava' });
    return out;
  }

  private build(gltf: GLTF, anims: GLTF, cfg: HeroConfig, body: BodyKey, weapons: { slot: 'r' | 'l'; obj: THREE.Object3D; kind: string }[]): LoadedHero {
    const model = cloneSkinned(gltf.scene);
    const spec = cfg.portrait;
    const look: HeroLook = spec?.look ?? {};
    const isCyclops = cfg.race === 'ciclope' || spec?.race === 'ciclope';

    // Textura recolorida (um material novo por herói)
    let baseMat: THREE.MeshStandardMaterial | null = null;
    model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !baseMat) baseMat = m.material as THREE.MeshStandardMaterial; });
    const textures: THREE.Texture[] = [];
    const materials: THREE.Material[] = [];
    let heroMat: THREE.MeshStandardMaterial | null = null;
    const src = (baseMat as THREE.MeshStandardMaterial | null)?.map?.image as (HTMLImageElement & ImageBitmap) | undefined;
    if (baseMat && src) {
      const changes: { cells: [number, number][]; color: string; keep?: number }[] = [];
      if (spec?.skin) changes.push({ cells: skinCells(src), color: spec.skin });
      if (spec?.hairColor) changes.push({ cells: [[1, 0]], color: spec.hairColor });
      if (isCyclops && spec?.skin) changes.push({ cells: [[2, 0]], color: mix(spec.skin, '#000000', 0.1) });
      else if (spec?.eyeColor) changes.push({ cells: [[2, 0]], color: mix(spec.eyeColor, '#000000', 0.55) });
      if (look.outfit) changes.push({ cells: OUTFIT_CELLS[body], color: look.outfit });
      const tex = recolorAtlas(src, changes);
      textures.push(tex);
      heroMat = (baseMat as THREE.MeshStandardMaterial).clone();
      heroMat.map = tex;
      heroMat.roughness = 0.75;
      materials.push(heroMat);
    }

    let headBone: THREE.Object3D | null = null;
    let handR: THREE.Object3D | null = null;
    let handL: THREE.Object3D | null = null;
    let chest: THREE.Object3D | null = null;
    let headMesh: THREE.SkinnedMesh | null = null;
    const showHeadgear = look.headgear ?? (body === 'knight' ? ['armadura_placas', 'cota_de_malha', 'meia_armadura'].includes(cfg.equipment.armor ?? '') : body !== 'barbarian');
    model.traverse((o) => {
      if (o.name === 'head') headBone = o;
      // o GLTFLoader remove o "." dos nomes (handslot.r → handslotr)
      if (o.name === 'handslotr' || o.name === 'handslot.r') handR = o;
      if (o.name === 'handslotl' || o.name === 'handslot.l') handL = o;
      if (o.name === 'chest') chest = o;
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        if (heroMat) m.material = heroMat;
        if (/_Head/.test(o.name) && (m as THREE.SkinnedMesh).isSkinnedMesh) headMesh = m as THREE.SkinnedMesh;
        if (HEADGEAR.test(o.name)) o.visible = showHeadgear;
        m.frustumCulled = false;
      }
    });

    // Armas nas mãos (mesmas transformações do pacote original)
    for (const w of weapons) {
      w.obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
      const slot = w.slot === 'r' ? handR : handL;
      if (!slot) continue;
      if (w.kind === 'aljava') {
        // aljava nas costas
        if (chest) {
          model.updateMatrixWorld(true);
          const cs = (chest as THREE.Object3D).getWorldScale(new THREE.Vector3()).y || 1;
          w.obj.position.set(0.12 / cs, 0.2 / cs, -0.3 / cs);
          w.obj.rotation.set(0.25, 0, 0.35);
          (chest as THREE.Object3D).add(w.obj);
        }
        continue;
      }
      if (w.slot === 'r') {
        w.obj.position.set(0, 0.033, 0);
        w.obj.quaternion.set(0, -1, 0, 0);
        if (w.kind === 'besta') { w.obj.position.set(-0.105, -0.01, 0); w.obj.quaternion.set(0, 0.7071, 0, 0.7071); }
      } else {
        w.obj.position.set(0, 0.017, w.kind === 'escudo' ? 0.156 : 0);
        if (w.kind === 'livro') { w.obj.position.set(0, 0.266, 0); w.obj.quaternion.set(0, -0.7071, -0.7071, 0); }
      }
      (slot as THREE.Object3D).add(w.obj);
      // Armas procedurais são feitas em metros; o osso da mão tem escala própria.
      if (w.obj.userData.proc) {
        model.updateMatrixWorld(true);
        const ws = (slot as THREE.Object3D).getWorldScale(new THREE.Vector3());
        w.obj.scale.setScalar(1 / (ws.y || 1));
      }
    }

    // Medidas para posicionar adornos e câmera
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model, true);
    const height = box.max.y - box.min.y || 2.4;
    if (headBone && headMesh) {
      const hb = headBone as THREE.Object3D;
      const hm = headMesh as THREE.SkinnedMesh;
      hm.geometry.computeBoundingBox();
      const hbox = hm.geometry.boundingBox!.clone().applyMatrix4(hm.matrixWorld);
      const bonePos = new THREE.Vector3().setFromMatrixPosition(hb.matrixWorld);
      const metrics = { top: hbox.max.y - bonePos.y, front: hbox.max.z - bonePos.z, width: hbox.max.x - hbox.min.x };
      const adorn = headAdornments(spec, cfg.race, metrics, body === 'rogue_hooded');
      hb.add(adorn);
    }

    const root = new THREE.Group();
    root.add(model);
    const h = look.height ?? (isCyclops ? 1.12 : cfg.race === 'satiro' ? 0.95 : 1);
    const b = look.build ?? (cfg.classKey === 'barbaro' || isCyclops ? 1.06 : 1);
    model.scale.set(h * b, h, h * b);
    model.position.y = -box.min.y * h;

    const mixer = new THREE.AnimationMixer(model);
    const clips = new Map(anims.animations.map((c) => [c.name, c]));
    mixer.addEventListener('finished', () => this.playLoop(this.idleClip, 0.35));
    const grip: Grip = (weapons.find((w) => w.slot === 'r' && w.kind !== 'aljava' && w.kind !== 'varinha')?.kind as Grip) ?? (weapons.some((w) => w.kind === 'arco') ? 'arco' : 'nenhuma');

    return {
      root, model, mixer, clips, grip, height: height * h, headBone,
      dispose: () => {
        mixer.stopAllAction();
        textures.forEach((t) => t.dispose());
        materials.forEach((m) => m.dispose());
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && m.geometry && ownGeometry(m)) m.geometry.dispose();
        });
      },
    };
  }

  // ───── Animação ─────
  private playLoop(name: string, fade = 0.3) {
    const h = this.hero;
    const clip = h?.clips.get(name) ?? h?.clips.get('Idle');
    if (!h || !clip) return;
    const a = h.mixer.clipAction(clip);
    a.reset().setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a;
  }

  private playOnce(name: string, fade = 0.2) {
    const h = this.hero;
    const clip = h?.clips.get(name);
    if (!h || !clip) return;
    const a = h.mixer.clipAction(clip);
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    if (this.current && this.current !== a) a.crossFadeFrom(this.current, fade, false);
    a.play();
    this.current = a;
  }

  /** Dispara uma ação com a animação certa para a arma empunhada. */
  play(action: HeroAction) {
    const grip = this.hero?.grip ?? 'nenhuma';
    const monk = this.config?.classKey === 'monge';
    const caster = ['mago', 'feiticeiro', 'bruxo', 'druida', 'clerigo'].includes(this.config?.classKey ?? '');
    switch (action) {
      case 'atacar':
        if (grip === 'duas') return this.playOnce(Math.random() < 0.5 ? '2H_Melee_Attack_Chop' : '2H_Melee_Attack_Spin');
        if (grip === 'besta') return this.playOnce('1H_Ranged_Shoot');
        if (grip === 'arco') return this.playOnce('Spellcast_Shoot');
        if (grip === 'cajado' || (grip === 'nenhuma' && caster)) return this.playOnce('Spellcast_Shoot');
        if (grip === 'nenhuma' || monk) return this.playOnce(Math.random() < 0.5 ? 'Unarmed_Melee_Attack_Kick' : 'Unarmed_Melee_Attack_Punch_A');
        if (this.config?.equipment.offHand) return this.playOnce('Dualwield_Melee_Attack_Slice');
        return this.playOnce(Math.random() < 0.5 ? '1H_Melee_Attack_Slice_Diagonal' : '1H_Melee_Attack_Stab');
      case 'defender': return this.playOnce('Block');
      case 'comemorar': return this.playOnce('Cheer');
      case 'magia': this.burst = 1; return this.playOnce('Spellcast_Long');
      case 'reclamado': this.showSymbol(); this.burst = 1; return this.playOnce('Spellcast_Raise');
      case 'esquivar': return this.playOnce('Dodge_Forward');
      case 'pular': return this.playOnce('Jump_Full_Short');
      case 'ferido': return this.playOnce('Hit_A');
      case 'cair': return this.playOnce('Death_A');
      case 'interagir': return this.playOnce('Interact');
      case 'andar': return this.playLoop('Walking_A');
      case 'correr': return this.playLoop('Running_A');
      case 'sentar': return this.playLoop('Sit_Floor_Idle');
      case 'parado': return this.idle();
    }
  }

  idle() { this.playLoop(this.idleClip); }

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
      h.mixer.update(dt);
      this.yaw += this.yawVel * dt * 4;
      this.yawVel *= Math.pow(0.04, dt);
      h.root.rotation.y = this.yaw;
    }
    // Câmera: corpo inteiro ↔ rosto
    this.zoom += (this.zoomTarget - this.zoom) * Math.min(1, dt * 5);
    const H = h?.height ?? 2.4;
    const aspect = this.camera.aspect;
    const fitDist = (H * 0.85) / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) / Math.min(1, aspect * 1.25);
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
    this.renderer.render(this.scene, this.camera);
  }

  /** Foto do herói (PNG) para usar como retrato. */
  snapshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObs.disconnect();
    if (this.hero) { this.scene.remove(this.hero.root); this.hero.dispose(); }
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

/** Só descartamos geometrias criadas aqui; as dos arquivos são compartilhadas pelo cache. */
function ownGeometry(m: THREE.Mesh) {
  return !!m.geometry.userData.own;
}
