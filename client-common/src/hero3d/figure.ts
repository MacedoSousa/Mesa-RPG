/**
 * Núcleo 3D compartilhado por heróis e monstros: carregamento, recolor do atlas,
 * armas, e a interface Figure — tudo que aparece no palco 3D ou vira sprite no mapa.
 */
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { baseItemKey, getItem, rankOf } from '@mesa/shared';

export { cloneSkinned };

const BASE = '/models/';
const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();
export const loadModel = (path: string) => {
  let p = cache.get(path);
  if (!p) {
    p = loader.loadAsync(BASE + path);
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return p;
};

/** Ações que o palco e o mapa sabem tocar. */
export type HeroAction = 'atacar' | 'defender' | 'comemorar' | 'magia' | 'esquivar' | 'andar' | 'correr' | 'pular' | 'ferido' | 'sentar' | 'reclamado' | 'interagir' | 'cair' | 'parado';
/** Estados "assados" em sprites para o mapa. */
export type BakeState = 'idle' | 'walk' | 'attack' | 'hit' | 'death';

/** Qualquer coisa animada que pode ir para o palco 3D ou virar sprite no mapa. */
export interface Figure {
  root: THREE.Group;
  /** Altura em unidades do mundo (pés em y = 0). */
  height: number;
  /** Raio aproximado no chão (para enquadrar). */
  radius: number;
  play(action: HeroAction): void;
  update(dt: number): void;
  /** Pose determinística: estado + fração do ciclo (0–1). Usado para assar sprites. */
  sample(state: BakeState, t01: number): void;
  dispose(): void;
}

// ───────────── Cores e atlas ─────────────

export function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, '0')).join('');
}

export type Cell = [number, number];
export interface AtlasChange { cells: Cell[]; color: string; keep?: number }

/** Troca faixas inteiras do atlas de cores do KayKit, preservando o degradê. */
export function recolorAtlas(img: CanvasImageSource & { width: number; height: number }, changes: AtlasChange[]): THREE.CanvasTexture {
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
        d[i] = Math.min(255, tr * f * (1 - keep) + d[i] * keep);
        d[i + 1] = Math.min(255, tg * f * (1 - keep) + d[i + 1] * keep);
        d[i + 2] = Math.min(255, tb * f * (1 - keep) + d[i + 2] * keep);
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
export function skinCells(img: CanvasImageSource & { width: number; height: number }): Cell[] {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 4;
  const g = c.getContext('2d')!;
  g.drawImage(img, 0, 0, 8, 4);
  const d = g.getImageData(0, 0, 8, 4).data;
  const out: Cell[] = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) {
    const i = (y * 8 + x) * 4;
    if (Math.hypot(d[i] - 0xf0, d[i + 1] - 0xb5, d[i + 2] - 0x90) < 38) out.push([x, y]);
  }
  if (!out.some(([x, y]) => x === 0 && y === 0)) out.push([0, 0]);
  return out;
}

export const mat = (color: string, opts: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, flatShading: true, ...opts });

/** Marca geometrias criadas por código (as dos arquivos são compartilhadas pelo cache). */
export function markOwn(o: THREE.Object3D) {
  o.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) m.geometry.userData.own = true; });
  return o;
}

export function disposeOwn(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry?.userData.own) m.geometry.dispose();
  });
}

// ───────────── Armas ─────────────

export type Grip = 'nenhuma' | 'uma' | 'duas' | 'arco' | 'besta' | 'cajado';
export interface WeaponVisual { asset?: string; proc?: 'arco' | 'lanca' | 'tridente' | 'martelo' | 'maca' | 'clava' | 'glaive' | 'lira'; grip: Grip; tint?: string }

export const WEAPON_VISUAL: Record<string, WeaponVisual> = {
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

export function weaponVisual(key: string | null | undefined): WeaponVisual | null {
  if (!key) return null;
  const base = baseItemKey(key);
  if (WEAPON_VISUAL[base]) return WEAPON_VISUAL[base];
  const item = getItem(key);
  if (!item || item.kind !== 'arma') return null;
  // Itens personalizados do Mestre: escolhe pelo perfil da arma.
  if (item.properties.includes('distancia')) return { proc: 'arco', grip: 'arco' };
  if (item.properties.includes('duas_maos')) return { asset: 'sword_2handed', grip: 'duas' };
  return { asset: 'sword_1handed', grip: 'uma' };
}

export function procWeapon(kind: NonNullable<WeaponVisual['proc']>, tint?: string): THREE.Object3D {
  const g = new THREE.Group();
  const wood = mat('#7a5230');
  const metal = mat(tint ?? '#b8c2cc', { metalness: 0.7, roughness: 0.35 });
  const add = (geo: THREE.BufferGeometry, m: THREE.Material, y: number) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.y = y; mesh.castShadow = true;
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
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 5, 12, Math.PI), frame);
      m.position.y = 0.2;
      g.add(m);
      add(new THREE.BoxGeometry(0.36, 0.05, 0.05), frame, 0.05);
      for (const x of [-0.08, 0, 0.08]) { const s = add(new THREE.CylinderGeometry(0.003, 0.003, 0.3, 3), mat('#fff'), 0.2); s.position.x = x; }
      break;
    }
  }
  markOwn(g);
  g.userData.proc = true;
  return g;
}

/** Armas Heroicas ou melhores brilham na cor do rank (azul, roxo, dourado). */
export function rankGlow(o: THREE.Object3D, key: string | null | undefined) {
  const item = key ? getItem(key) : undefined;
  const r = rankOf(item);
  if (!item || r.rank < 2) return;
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (!m.isMesh) return;
    const sm = (m.material as THREE.MeshStandardMaterial).clone();
    sm.emissive = new THREE.Color(r.color);
    sm.emissiveIntensity = 0.25 + (r.rank - 2) * 0.2;
    m.material = sm;
  });
}

export function tintObject(o: THREE.Object3D, color: string) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.isMesh) {
      const sm = (m.material as THREE.MeshStandardMaterial).clone();
      sm.color = new THREE.Color(color);
      sm.metalness = 0.75; sm.roughness = 0.3;
      sm.emissive = new THREE.Color(color);
      sm.emissiveIntensity = 0.12;
      m.material = sm;
    }
  });
}

export interface LoadoutSpec {
  mainHand?: string | null;
  offHand?: string | null;
  shield?: string | null;
  inventory?: string[];
  /** Conjuradores sem arma seguram uma varinha. */
  wandIfEmpty?: boolean;
}

export interface AttachedWeapon { slot: 'r' | 'l'; obj: THREE.Object3D; kind: string }

export async function loadWeapons(cfg: LoadoutSpec): Promise<AttachedWeapon[]> {
  const out: AttachedWeapon[] = [];
  const grab = async (asset: string) => cloneSkinned((await loadModel(`weapons/${asset}.glb`)).scene);
  const main = weaponVisual(cfg.mainHand);
  const off = weaponVisual(cfg.offHand);
  if (main) {
    const obj = main.asset ? await grab(main.asset) : main.proc ? procWeapon(main.proc, main.tint) : null;
    if (obj) {
      if (main.tint && main.asset) tintObject(obj, main.tint);
      rankGlow(obj, cfg.mainHand);
      out.push({ slot: main.grip === 'arco' ? 'l' : 'r', obj, kind: main.grip === 'besta' ? 'besta' : main.grip });
    }
  }
  if (off && main?.grip !== 'duas' && main?.grip !== 'arco') {
    const obj = off.asset ? await grab(off.asset) : off.proc ? procWeapon(off.proc, off.tint) : null;
    if (obj) { rankGlow(obj, cfg.offHand); out.push({ slot: 'l', obj, kind: 'offhand' }); }
  }
  const leftFree = !out.some((w) => w.slot === 'l') && main?.grip !== 'duas' && main?.grip !== 'besta';
  if (cfg.shield && leftFree) {
    const bronze = baseItemKey(cfg.shield) === 'escudo_bronze';
    const obj = await grab(bronze ? 'shield_badge' : 'shield_round');
    if (bronze) tintObject(obj, '#c98f3a');
    rankGlow(obj, cfg.shield);
    out.push({ slot: 'l', obj, kind: 'escudo' });
  } else if (leftFree && cfg.inventory?.includes('grimorio')) {
    out.push({ slot: 'l', obj: await grab('spellbook_closed'), kind: 'livro' });
  } else if (leftFree && cfg.inventory?.includes('lira')) {
    out.push({ slot: 'l', obj: procWeapon('lira'), kind: 'lira' });
  } else if (!main && cfg.wandIfEmpty) {
    out.push({ slot: 'r', obj: await grab('wand'), kind: 'varinha' });
  }
  if (main?.grip === 'arco') out.push({ slot: 'r', obj: await grab('quiver'), kind: 'aljava' });
  return out;
}

// ───────────── Figuras com esqueleto (KayKit) ─────────────

export interface HeadMetrics { top: number; front: number; width: number }

export interface RigParts {
  model: THREE.Object3D;
  bones: Record<string, THREE.Object3D>;
  head: HeadMetrics | null;
  /** Escala do mundo dos ossos (para criar peças em metros). */
  boneScale: number;
  /** Caixa do modelo (espaço do modelo, antes da escala da figura). */
  box: THREE.Box3;
}

/** Peça animada por código (cauda, asas, chamas…). */
export interface ProcPart {
  /** time = segundos (ao vivo) ou fração do ciclo × duração (assado). */
  animate(time: number, state: BakeState, t01: number): void;
}

export interface RigSpec {
  body: string;
  recolor?: (src: CanvasImageSource & { width: number; height: number }) => AtlasChange[];
  /** Esconde malhas pelo nome (ex.: pernas de quem tem cauda de serpente). */
  hide?: RegExp;
  headgear?: boolean;
  weapons?: LoadoutSpec;
  scale?: { h: number; b: number };
  /** Adornos presos aos ossos (devolve peças animadas). */
  adorn?: (p: RigParts) => ProcPart[] | void;
  /** Olhos brilhando (malha "Eyes" dos esqueletos ganha emissivo). */
  glowEyes?: string;
  /** Clipes por ação; o resto segue o padrão. */
  clips?: Partial<Record<'idle' | 'walk' | 'hit' | 'death', string>> & { attack?: string[] };
  /** Tipo de ataque padrão quando não definido em clips.attack. */
  style?: 'caster' | 'monk' | 'brute';
}

const HEADGEAR = /Helmet|_Hat$|Hat$|_Hood$/;

function attackClips(grip: Grip, spec: RigSpec, dual: boolean): string[] {
  if (spec.clips?.attack?.length) return spec.clips.attack;
  if (grip === 'duas') return ['2H_Melee_Attack_Chop', '2H_Melee_Attack_Spin'];
  if (grip === 'besta') return ['1H_Ranged_Shoot'];
  if (grip === 'arco' || grip === 'cajado' || (grip === 'nenhuma' && spec.style === 'caster')) return ['Spellcast_Shoot'];
  if (grip === 'nenhuma' || spec.style === 'monk') return ['Unarmed_Melee_Attack_Punch_A', 'Unarmed_Melee_Attack_Kick'];
  if (dual) return ['Dualwield_Melee_Attack_Slice'];
  return ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Stab'];
}

export async function buildRigFigure(spec: RigSpec): Promise<Figure & { grip: Grip; headBone: THREE.Object3D | null }> {
  const [gltf, anims, weapons] = await Promise.all([loadModel(`${spec.body}.glb`), loadModel('anims.glb'), loadWeapons(spec.weapons ?? {})]);
  const model = cloneSkinned(gltf.scene);

  // Textura recolorida (material novo por figura)
  let baseMat: THREE.MeshStandardMaterial | null = null;
  model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && !baseMat) baseMat = m.material as THREE.MeshStandardMaterial; });
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  let figMat: THREE.MeshStandardMaterial | null = null;
  const src = (baseMat as THREE.MeshStandardMaterial | null)?.map?.image as (HTMLImageElement & ImageBitmap) | undefined;
  if (baseMat && src && spec.recolor) {
    const tex = recolorAtlas(src, spec.recolor(src));
    textures.push(tex);
    figMat = (baseMat as THREE.MeshStandardMaterial).clone();
    figMat.map = tex;
    figMat.roughness = 0.75;
    materials.push(figMat);
  }
  let eyeMat: THREE.MeshStandardMaterial | null = null;
  if (spec.glowEyes && baseMat) {
    eyeMat = (baseMat as THREE.MeshStandardMaterial).clone();
    eyeMat.emissive = new THREE.Color(spec.glowEyes);
    eyeMat.emissiveIntensity = 2.2;
    materials.push(eyeMat);
  }

  const bones: Record<string, THREE.Object3D> = {};
  let headMesh: THREE.SkinnedMesh | null = null;
  model.traverse((o) => {
    // o GLTFLoader remove o "." dos nomes (handslot.r → handslotr)
    if (!(o as THREE.Mesh).isMesh) bones[o.name.replace('.', '')] = o;
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
      if (figMat) m.material = figMat;
      if (eyeMat && /_Eyes$/.test(o.name)) m.material = eyeMat;
      if (/_Head|_Skull/.test(o.name) && (m as THREE.SkinnedMesh).isSkinnedMesh && !headMesh) headMesh = m as THREE.SkinnedMesh;
      if (HEADGEAR.test(o.name)) o.visible = spec.headgear ?? true;
      if (spec.hide?.test(o.name)) o.visible = false;
      m.frustumCulled = false;
    }
  });
  const handR = bones.handslotr, handL = bones.handslotl, chest = bones.chest;

  model.updateMatrixWorld(true);
  const boneScale = handR?.getWorldScale(new THREE.Vector3()).y || 1;
  for (const w of weapons) {
    w.obj.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
    if (w.kind === 'aljava') {
      if (chest) {
        w.obj.position.set(0.12 / boneScale, 0.2 / boneScale, -0.3 / boneScale);
        w.obj.rotation.set(0.25, 0, 0.35);
        chest.add(w.obj);
      }
      continue;
    }
    const slot = w.slot === 'r' ? handR : handL;
    if (!slot) continue;
    if (w.slot === 'r') {
      w.obj.position.set(0, 0.033, 0);
      w.obj.quaternion.set(0, -1, 0, 0);
      if (w.kind === 'besta') { w.obj.position.set(-0.105, -0.01, 0); w.obj.quaternion.set(0, 0.7071, 0, 0.7071); }
    } else {
      w.obj.position.set(0, 0.017, w.kind === 'escudo' ? 0.156 : 0);
      if (w.kind === 'livro') { w.obj.position.set(0, 0.266, 0); w.obj.quaternion.set(0, -0.7071, -0.7071, 0); }
    }
    slot.add(w.obj);
    // Armas procedurais são feitas em metros; o osso da mão tem escala própria.
    if (w.obj.userData.proc) w.obj.scale.setScalar(1 / boneScale);
  }

  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  model.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && o.visible && (m as THREE.SkinnedMesh).isSkinnedMesh) box.expandByObject(o, true); });
  if (box.isEmpty()) box.setFromObject(model, true);
  let head: HeadMetrics | null = null;
  if (bones.head && headMesh) {
    const hm = headMesh as THREE.SkinnedMesh;
    hm.geometry.computeBoundingBox();
    const hbox = hm.geometry.boundingBox!.clone().applyMatrix4(hm.matrixWorld);
    const bp = new THREE.Vector3().setFromMatrixPosition(bones.head.matrixWorld);
    head = { top: hbox.max.y - bp.y, front: hbox.max.z - bp.z, width: hbox.max.x - hbox.min.x };
  }
  const parts = spec.adorn?.({ model, bones, head, boneScale, box }) ?? [];

  const root = new THREE.Group();
  root.add(model);
  const { h, b } = spec.scale ?? { h: 1, b: 1 };
  model.scale.set(h * b, h, h * b);
  model.position.y = -box.min.y * h;
  const height = (box.max.y - box.min.y || 2.4) * h;
  const radius = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 0.5 * h * b;

  const mixer = new THREE.AnimationMixer(model);
  const clips = new Map(anims.animations.map((c) => [c.name, c]));
  const grip: Grip = (weapons.find((w) => w.slot === 'r' && w.kind !== 'aljava' && w.kind !== 'varinha')?.kind as Grip) ?? (weapons.some((w) => w.kind === 'arco') ? 'arco' : 'nenhuma');
  const dual = !!spec.weapons?.offHand;
  const idleClip = spec.clips?.idle ?? (grip === 'duas' ? '2H_Melee_Idle' : spec.style === 'monk' ? 'Unarmed_Idle' : 'Idle');
  const attacks = attackClips(grip, spec, dual);
  const stateClip: Record<BakeState, string> = {
    idle: idleClip,
    walk: spec.clips?.walk ?? 'Walking_A',
    attack: attacks[0],
    hit: spec.clips?.hit ?? 'Hit_A',
    death: spec.clips?.death ?? 'Death_A',
  };

  let current: THREE.AnimationAction | null = null;
  let liveTime = 0;
  let liveState: BakeState = 'idle';
  const loop = (name: string, fade = 0.3) => {
    const clip = clips.get(name) ?? clips.get('Idle');
    if (!clip) return;
    const a = mixer.clipAction(clip);
    a.reset().setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
    if (current && current !== a) a.crossFadeFrom(current, fade, false);
    a.play();
    current = a;
  };
  const once = (name: string, fade = 0.2) => {
    const clip = clips.get(name);
    if (!clip) return;
    const a = mixer.clipAction(clip);
    a.reset().setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    if (current && current !== a) a.crossFadeFrom(current, fade, false);
    a.play();
    current = a;
  };
  mixer.addEventListener('finished', () => { if (liveState !== 'death') { liveState = 'idle'; loop(idleClip, 0.35); } });
  loop(idleClip, 0);

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  return {
    root, height, radius, grip, headBone: bones.head ?? null,
    play(action) {
      liveState = action === 'andar' || action === 'correr' ? 'walk' : action === 'cair' ? 'death' : action === 'ferido' ? 'hit' : action === 'atacar' ? 'attack' : 'idle';
      switch (action) {
        case 'atacar': return once(pick(attacks));
        case 'defender': return once('Block');
        case 'comemorar': return once('Cheer');
        case 'magia': return once('Spellcast_Long');
        case 'reclamado': return once('Spellcast_Raise');
        case 'esquivar': return once('Dodge_Forward');
        case 'pular': return once('Jump_Full_Short');
        case 'ferido': return once(stateClip.hit);
        case 'cair': return once(stateClip.death);
        case 'interagir': return once('Interact');
        case 'andar': return loop(stateClip.walk);
        case 'correr': return loop('Running_A');
        case 'sentar': return loop('Sit_Floor_Idle');
        case 'parado': return loop(idleClip);
      }
    },
    update(dt) {
      mixer.update(dt);
      liveTime += dt;
      for (const p of parts) p.animate(liveTime, liveState, (liveTime % 1.2) / 1.2);
    },
    sample(state, t01) {
      mixer.stopAllAction();
      const clip = clips.get(stateClip[state]) ?? clips.get('Idle')!;
      const a = mixer.clipAction(clip);
      a.reset().setLoop(THREE.LoopRepeat, Infinity);
      a.play();
      mixer.setTime(Math.min(0.999, t01) * clip.duration);
      for (const p of parts) p.animate(t01 * clip.duration, state, t01);
      current = null;
    },
    dispose() {
      mixer.stopAllAction();
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
      disposeOwn(root);
    },
  };
}
