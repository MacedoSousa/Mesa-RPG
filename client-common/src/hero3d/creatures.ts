/**
 * Peças e criaturas procedurais (low-poly, flat shading) com animação por código.
 * Cada criatura implementa Figure: anda, ataca, se fere e cai como os bonecos do KayKit.
 */
import * as THREE from 'three';
import { markOwn, mat, mix, type BakeState, type Figure, type HeadMetrics, type HeroAction, type ProcPart, type RigParts } from './figure';

const TAU = Math.PI * 2;
const ease = (t: number) => t * t * (3 - 2 * t);

// ───────────────────────────── Peças para bonecos com esqueleto ─────────────────────────────

/** Cauda de serpente segmentada presa ao quadril, balançando. */
export function serpentTail(p: RigParts, color: string, opts: { segments?: number; length?: number; thick?: number; offsetX?: number; belly?: string } = {}): ProcPart | null {
  const hips = p.bones.hips;
  if (!hips) return null;
  const n = opts.segments ?? 9;
  const len = (opts.length ?? 2.2) / p.boneScale;
  const thick = (opts.thick ?? 0.24) / p.boneScale;
  const skin = mat(color);
  const belly = mat(opts.belly ?? mix(color, '#d9c88a', 0.35));
  const root = new THREE.Group();
  // O osso do quadril tem eixos e pivô próprios (no KayKit o pivô fica no chão):
  // alinha a cauda ao espaço do modelo (frente = +Z) e a põe na altura da cintura.
  hips.updateWorldMatrix(true, false);
  const inv = hips.getWorldQuaternion(new THREE.Quaternion()).invert();
  root.quaternion.copy(inv);
  const waist = new THREE.Vector3(opts.offsetX ?? 0, p.box.min.y + (p.box.max.y - p.box.min.y) * 0.3, -0.05);
  root.position.copy(waist.sub(hips.getWorldPosition(new THREE.Vector3())).applyQuaternion(inv).divideScalar(p.boneScale));
  hips.add(root);
  const segs: THREE.Group[] = [];
  let parent: THREE.Object3D = root;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const r = thick * (1 - i / (n + 1));
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, len / n, 7), i % 2 ? skin : belly);
    seg.rotation.x = Math.PI / 2;
    seg.position.z = -len / n / 2;
    seg.castShadow = true;
    g.add(seg);
    g.position.z = i === 0 ? 0 : -len / n;
    if (i === 0) g.rotation.x = -1.1; // desce do quadril até o chão
    else if (i < 3) g.rotation.x = 0.45;
    parent.add(g);
    segs.push(g);
    parent = g;
  }
  markOwn(root);
  return {
    animate(time, state) {
      const speed = state === 'walk' ? 6 : state === 'attack' ? 9 : 2.2;
      const amp = state === 'death' ? 0.05 : state === 'walk' ? 0.35 : 0.18;
      segs.forEach((s, i) => { if (i > 0) s.rotation.y = Math.sin(time * speed - i * 0.7) * amp; });
    },
  };
}

/** Asas (morcego para Fúrias, penas para Harpias) presas ao peito, batendo. */
export function wings(p: RigParts, kind: 'morcego' | 'penas', color: string): ProcPart | null {
  const chest = p.bones.chest;
  if (!chest) return null;
  const s = 1 / p.boneScale;
  const group = new THREE.Group();
  group.position.set(0, 0.25 * s, -0.22 * s);
  chest.add(group);
  const sides: THREE.Group[] = [];
  const m = mat(color, { side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    if (kind === 'morcego') {
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(1.3, 0.55);
      shape.lineTo(1.1, -0.1);
      shape.lineTo(0.85, 0.05);
      shape.lineTo(0.6, -0.35);
      shape.lineTo(0.35, -0.05);
      shape.lineTo(0, -0.5);
      const mem = new THREE.Mesh(new THREE.ShapeGeometry(shape), m);
      mem.scale.set(side * s, s, s);
      pivot.add(mem);
      const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.02 * s, 1.4 * s, 4), mat('#2a1f2f'));
      bone.rotation.z = side * (Math.PI / 2 - 0.4);
      bone.position.set(side * 0.62 * s, 0.27 * s, 0);
      pivot.add(bone);
    } else {
      for (let i = 0; i < 6; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.95 - i * 0.08, 0.12, 0.02).translate((0.95 - i * 0.08) / 2, 0, 0), mat(i % 2 ? color : '#efe3c8', { side: THREE.DoubleSide }));
        f.scale.set(side * s, s, s);
        f.position.y = (0.25 - i * 0.12) * s;
        f.rotation.z = side * (0.4 - i * 0.12);
        pivot.add(f);
      }
    }
    group.add(pivot);
    sides.push(pivot);
  }
  markOwn(group);
  return {
    animate(time, state) {
      const speed = state === 'walk' || state === 'attack' ? 9 : 3;
      const amp = state === 'death' ? 0.05 : state === 'attack' ? 0.8 : 0.45;
      sides.forEach((w, i) => { w.rotation.y = (i ? -1 : 1) * (0.55 + Math.sin(time * speed) * amp); });
    },
  };
}

/** Cabelo de serpentes da Górgona. */
export function snakeHair(p: RigParts, color: string): ProcPart | null {
  const head = p.bones.head;
  if (!head || !p.head) return null;
  const hm = p.head;
  const g = new THREE.Group();
  head.add(g);
  const snakes: THREE.Group[] = [];
  const skin = mat(color);
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const sn = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.12, 0.05), new THREE.Vector3(-0.03, 0.24, 0.1), new THREE.Vector3(0.02, 0.32, 0.18),
    ]);
    sn.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.035, 5), skin));
    const headM = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4).scale(1, 0.7, 1.4), skin);
    headM.position.set(0.02, 0.32, 0.2);
    sn.add(headM);
    const r = hm.width * 0.42;
    sn.position.set(Math.sin(a) * r, hm.top - 0.18, Math.cos(a) * r * 0.9 - 0.04);
    sn.rotation.y = a;
    sn.rotation.x = -0.3;
    g.add(sn);
    snakes.push(sn);
  }
  markOwn(g);
  return {
    animate(time) {
      snakes.forEach((sn, i) => { sn.rotation.z = Math.sin(time * 3 + i) * 0.25; });
    },
  };
}

/** Cabelo de chamas (Empusa) que tremula. */
export function flameHair(p: RigParts): ProcPart | null {
  const head = p.bones.head;
  if (!head || !p.head) return null;
  const hm = p.head;
  const g = new THREE.Group();
  head.add(g);
  const flames: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.42, 6), mat(i % 2 ? '#ff7a1a' : '#ffd166', { emissive: i % 2 ? '#ff5a00' : '#ffb000', emissiveIntensity: 1.4 }));
    f.position.set(Math.sin(a) * hm.width * 0.3, hm.top + 0.02, Math.cos(a) * hm.width * 0.3 - 0.05);
    f.rotation.x = -0.35;
    g.add(f);
    flames.push(f);
  }
  markOwn(g);
  return {
    animate(time) {
      flames.forEach((f, i) => { const k = 1 + Math.sin(time * 12 + i * 1.7) * 0.18; f.scale.set(1, k, 1); });
    },
  };
}

/** Cabeça de touro: chifres, focinho com argola e orelhas. */
export function bullHead(p: RigParts) {
  const head = p.bones.head;
  if (!head || !p.head) return;
  const hm = p.head;
  const g = new THREE.Group();
  const horn = mat('#efe6d2', { roughness: 0.5 });
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * hm.width * 0.4, hm.top - 0.2, 0), new THREE.Vector3(s * hm.width * 0.75, hm.top - 0.05, 0.05),
      new THREE.Vector3(s * hm.width * 0.85, hm.top + 0.25, 0.12), new THREE.Vector3(s * hm.width * 0.72, hm.top + 0.42, 0.18),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.07, 7), horn));
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 5), mat('#4a2c16'));
    ear.position.set(s * hm.width * 0.55, hm.top * 0.55, -0.02);
    ear.rotation.z = s * 1.6;
    g.add(ear);
  }
  const snout = new THREE.Mesh(new THREE.BoxGeometry(hm.width * 0.5, hm.top * 0.32, 0.24), mat('#3b2414'));
  snout.position.set(0, hm.top * 0.28, hm.front * 0.92);
  g.add(snout);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 5, 12), mat('#d4a020', { metalness: 0.8, roughness: 0.3 }));
  ring.position.set(0, hm.top * 0.16, hm.front * 0.92 + 0.13);
  g.add(ring);
  head.add(markOwn(g));
}

/** Presas saindo da boca (Lestrigão). */
export function tusks(p: RigParts) {
  const head = p.bones.head;
  if (!head || !p.head) return;
  const hm = p.head;
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 5), mat('#f1e9d2'));
    t.position.set(s * hm.width * 0.16, hm.top * 0.22, hm.front * 0.92);
    t.rotation.x = -0.25;
    g.add(t);
  }
  head.add(markOwn(g));
}

/** Um olho gigante na testa (Ciclope). */
export function cyclopsEye(p: RigParts, iris: string) {
  const head = p.bones.head;
  if (!head || !p.head) return;
  head.add(cyclopsEyeMesh(p.head, iris));
}

export function cyclopsEyeMesh(head: HeadMetrics, irisColor: string) {
  const eye = new THREE.Group();
  const white = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), mat('#ffffff', { flatShading: false, roughness: 0.2 }));
  const iris = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), mat(irisColor, { flatShading: false, roughness: 0.2 }));
  iris.position.z = 0.09;
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 6), mat('#0b0b0b', { flatShading: false }));
  pupil.position.z = 0.13;
  eye.add(white, iris, pupil);
  eye.position.set(0, head.top * 0.42, head.front * 0.88);
  eye.scale.z = 0.6;
  eye.name = 'olho_ciclope';
  return markOwn(eye);
}

/** Dois pontos de luz no lugar dos olhos (monstros com olhos brilhando). */
export function glowingEyes(p: RigParts, color: string) {
  const head = p.bones.head;
  if (!head || !p.head) return;
  const hm = p.head;
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), m);
    e.position.set(s * hm.width * 0.17, hm.top * 0.44, hm.front * 0.97);
    g.add(e);
  }
  head.add(markOwn(g));
}

// ───────────────────────────── Criaturas procedurais ─────────────────────────────

interface CreatureSpec {
  kind: 'quadrupede' | 'hidra' | 'aranha' | 'foca';
  color: string;
  accent?: string;
  eyes?: string;
  heads?: number;
  scale?: number;
  mane?: string;
  goatHead?: boolean;
  snakeTail?: boolean;
  metal?: boolean;
  embers?: boolean;
}

type PoseFn = (state: BakeState, t01: number, time: number) => void;

/** Monta uma criatura e devolve a Figure com o ciclo de animação de cada estado. */
export function buildCreatureFigure(spec: CreatureSpec): Figure {
  const root = new THREE.Group();
  const body = new THREE.Group(); // tudo que cai junto na morte
  root.add(body);
  const m = mat(spec.color, spec.metal ? { metalness: 0.75, roughness: 0.35 } : {});
  const accent = mat(spec.accent ?? spec.color, spec.metal ? { metalness: 0.8, roughness: 0.3 } : {});
  const eyeMat = new THREE.MeshBasicMaterial({ color: spec.eyes ?? '#ff2a2a' });
  const mesh = (geo: THREE.BufferGeometry, mt: THREE.Material = m) => { const x = new THREE.Mesh(geo, mt); x.castShadow = true; return x; };
  let pose: PoseFn = () => undefined;
  let height = 1.6;
  let radius = 1;

  if (spec.kind === 'quadrupede') {
    const torso = mesh(new THREE.BoxGeometry(0.85, 0.75, 1.7));
    torso.position.y = 1.0;
    body.add(torso);
    const chestM = mesh(new THREE.BoxGeometry(0.95, 0.85, 0.6));
    chestM.position.set(0, 1.05, 0.65);
    body.add(chestM);
    if (spec.mane) {
      const mane = mesh(new THREE.DodecahedronGeometry(0.62, 0), mat(spec.mane));
      mane.scale.set(1.1, 1, 0.8);
      mane.position.set(0, 1.35, 0.95);
      body.add(mane);
    }
    // Pernas: quadril → coxa → canela
    const legs: { hip: THREE.Group; knee: THREE.Group; phase: number }[] = [];
    for (const [x, z, phase] of [[-0.32, 0.6, 0], [0.32, 0.6, Math.PI], [-0.32, -0.6, Math.PI], [0.32, -0.6, 0]] as const) {
      const hip = new THREE.Group();
      hip.position.set(x, 0.95, z);
      const thigh = mesh(new THREE.BoxGeometry(0.24, 0.55, 0.28));
      thigh.position.y = -0.27;
      hip.add(thigh);
      const knee = new THREE.Group();
      knee.position.y = -0.52;
      const shin = mesh(new THREE.BoxGeometry(0.18, 0.45, 0.2));
      shin.position.y = -0.2;
      const paw = mesh(new THREE.BoxGeometry(0.24, 0.1, 0.3), accent);
      paw.position.set(0, -0.42, 0.05);
      knee.add(shin, paw);
      hip.add(knee);
      body.add(hip);
      legs.push({ hip, knee, phase });
    }
    // Cabeças
    const nHeads = spec.heads ?? 1;
    const necks: { neck: THREE.Group; jaw: THREE.Mesh; base: number }[] = [];
    for (let i = 0; i < nHeads; i++) {
      const off = nHeads === 1 ? 0 : (i - (nHeads - 1) / 2) * 0.55;
      const neck = new THREE.Group();
      neck.position.set(off, 1.3, 0.9);
      neck.rotation.y = -off * 0.5;
      const n = mesh(new THREE.BoxGeometry(0.4, 0.45, 0.5));
      n.position.set(0, 0.1, 0.15);
      neck.add(n);
      const headG = new THREE.Group();
      headG.position.set(0, 0.3, 0.45);
      const skull = mesh(new THREE.BoxGeometry(0.55, 0.48, 0.55));
      const snout = mesh(new THREE.BoxGeometry(0.36, 0.22, 0.4));
      snout.position.set(0, 0.0, 0.42);
      const jaw = mesh(new THREE.BoxGeometry(0.34, 0.1, 0.4), accent);
      jaw.position.set(0, -0.15, 0.36);
      headG.add(skull, snout, jaw);
      for (const s of [-1, 1]) {
        const ear = mesh(new THREE.ConeGeometry(0.1, 0.3, 4));
        ear.position.set(s * 0.2, 0.32, -0.08);
        headG.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), eyeMat);
        eye.position.set(s * 0.15, 0.08, 0.28);
        headG.add(eye);
      }
      if (!spec.mane) {
        for (const s of [-1, 1]) {
          const fang = mesh(new THREE.ConeGeometry(0.035, 0.12, 4), mat('#f4efe0'));
          fang.position.set(s * 0.1, -0.12, 0.6);
          fang.rotation.x = Math.PI;
          headG.add(fang);
        }
      }
      neck.add(headG);
      body.add(neck);
      necks.push({ neck, jaw, base: 0 });
    }
    // Cabeça de bode nas costas (Quimera)
    if (spec.goatHead) {
      const gh = new THREE.Group();
      gh.position.set(0, 1.55, -0.2);
      const neckG = mesh(new THREE.BoxGeometry(0.22, 0.45, 0.22), mat('#8a7a63'));
      neckG.position.y = 0.2;
      const skull = mesh(new THREE.BoxGeometry(0.3, 0.32, 0.42), mat('#8a7a63'));
      skull.position.set(0, 0.5, 0.12);
      gh.add(neckG, skull);
      for (const s of [-1, 1]) {
        const horn = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(s * 0.08, 0.62, 0.05), new THREE.Vector3(s * 0.18, 0.85, -0.1), new THREE.Vector3(s * 0.12, 0.8, -0.32)]), 8, 0.035, 5), mat('#d8cfb8'));
        gh.add(horn);
      }
      body.add(gh);
    }
    // Cauda
    const tail: THREE.Group[] = [];
    let tp: THREE.Object3D = body;
    const nt = spec.snakeTail ? 7 : 4;
    for (let i = 0; i < nt; i++) {
      const g = new THREE.Group();
      g.position.set(0, i === 0 ? 1.15 : 0, i === 0 ? -0.85 : -0.22);
      g.rotation.x = i === 0 ? -0.6 : 0.12;
      const seg = mesh(new THREE.CylinderGeometry(0.09 - i * 0.008, 0.08 - i * 0.008, 0.26, 5), spec.snakeTail ? mat('#4f7a3a') : m);
      seg.rotation.x = Math.PI / 2;
      seg.position.z = -0.12;
      g.add(seg);
      if (spec.snakeTail && i === nt - 1) {
        const sh = mesh(new THREE.BoxGeometry(0.2, 0.14, 0.26), mat('#4f7a3a'));
        sh.position.z = -0.3;
        g.add(sh);
        for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffe066' })); e.position.set(s * 0.06, 0.06, -0.38); g.add(e); }
      }
      tp.add(g);
      tail.push(g);
      tp = g;
    }
    height = 2.0;
    radius = 1.1;
    pose = (state, t01, time) => {
      const cyc = t01 * TAU;
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      necks.forEach((n) => { n.neck.rotation.x = 0; n.jaw.rotation.x = 0; });
      if (state === 'walk') {
        legs.forEach((l) => { l.hip.rotation.x = Math.sin(cyc + l.phase) * 0.55; l.knee.rotation.x = Math.max(0, -Math.sin(cyc + l.phase)) * 0.7; });
        body.position.y = Math.abs(Math.sin(cyc * 2)) * 0.06;
      } else {
        legs.forEach((l) => { l.hip.rotation.x = 0; l.knee.rotation.x = 0; });
      }
      if (state === 'idle') {
        const br = Math.sin(cyc) * 0.03;
        body.position.y = br;
        necks.forEach((n, i) => { n.neck.rotation.x = Math.sin(cyc + i) * 0.08; n.jaw.rotation.x = Math.max(0, Math.sin(cyc * 2 + i)) * 0.15; });
      }
      if (state === 'attack') {
        const k = t01 < 0.4 ? ease(t01 / 0.4) : 1 - ease((t01 - 0.4) / 0.6);
        body.position.z = k * 0.5;
        body.rotation.x = -k * 0.12 + (t01 < 0.4 ? -0.1 * (1 - k) : 0);
        necks.forEach((n, i) => { n.neck.rotation.x = k * 0.5 - (i % 2) * 0.1; n.jaw.rotation.x = k * 0.6; });
        legs.forEach((l, i) => { l.hip.rotation.x = (i < 2 ? -1 : 1) * k * 0.35; });
      }
      if (state === 'hit') {
        const k = Math.sin(t01 * Math.PI);
        body.position.z = -k * 0.3;
        body.rotation.z = Math.sin(t01 * TAU * 3) * 0.08 * (1 - t01);
        necks.forEach((n) => { n.neck.rotation.x = -k * 0.5; });
      }
      if (state === 'death') {
        const k = ease(Math.min(1, t01 * 1.4));
        body.rotation.z = k * (Math.PI / 2);
        body.position.set(k * 0.9, k * 0.1, 0);
        legs.forEach((l) => { l.hip.rotation.x = k * 0.3; });
        necks.forEach((n) => { n.neck.rotation.x = k * 0.6; n.jaw.rotation.x = 0.4 * k; });
      }
      const tailAmp = state === 'death' ? 0 : state === 'attack' ? 0.6 : 0.3;
      tail.forEach((s, i) => { if (i > 0) s.rotation.y = Math.sin(time * (spec.snakeTail ? 4 : 7) - i * 0.6) * tailAmp; });
    };
  }

  if (spec.kind === 'hidra') {
    const torso = mesh(new THREE.DodecahedronGeometry(0.9, 1));
    torso.scale.set(1.1, 0.75, 1.3);
    torso.position.y = 0.75;
    body.add(torso);
    for (const [x, z] of [[-0.6, 0.5], [0.6, 0.5], [-0.6, -0.5], [0.6, -0.5]]) {
      const leg = mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.6, 6));
      leg.position.set(x, 0.3, z);
      body.add(leg);
    }
    const n = spec.heads ?? 5;
    const necks: { segs: THREE.Group[]; jaw: THREE.Mesh; phase: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a = ((i - (n - 1) / 2) / n) * 2.0;
      const base = new THREE.Group();
      base.position.set(Math.sin(a) * 0.6, 1.0, Math.cos(a) * 0.5 + 0.2);
      base.rotation.y = a * 0.6;
      body.add(base);
      const segs: THREE.Group[] = [];
      let par: THREE.Object3D = base;
      for (let s = 0; s < 6; s++) {
        const g = new THREE.Group();
        g.position.y = s === 0 ? 0 : 0.26;
        g.rotation.x = s === 0 ? 0.45 : -0.04;
        const seg = mesh(new THREE.CylinderGeometry(0.11 - s * 0.008, 0.13 - s * 0.008, 0.28, 6), s % 2 ? m : accent);
        seg.position.y = 0.13;
        g.add(seg);
        par.add(g);
        segs.push(g);
        par = g;
      }
      const head = new THREE.Group();
      head.position.y = 0.3;
      const skull = mesh(new THREE.BoxGeometry(0.28, 0.24, 0.42));
      skull.position.z = 0.1;
      const jaw = mesh(new THREE.BoxGeometry(0.24, 0.07, 0.36), accent);
      jaw.position.set(0, -0.14, 0.1);
      head.add(skull, jaw);
      for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), eyeMat); e.position.set(s * 0.1, 0.07, 0.26); head.add(e); }
      par.add(head);
      necks.push({ segs, jaw, phase: i * 1.3 });
    }
    height = 2.6;
    radius = 1.2;
    pose = (state, t01, time) => {
      const cyc = t01 * TAU;
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      necks.forEach((nk, i) => {
        let sway = Math.sin(time * 1.6 + nk.phase) * 0.12;
        let lunge = 0;
        if (state === 'walk') sway = Math.sin(cyc + nk.phase) * 0.2;
        if (state === 'attack') lunge = (t01 < 0.45 ? ease(t01 / 0.45) : 1 - ease((t01 - 0.45) / 0.55)) * (i % 2 ? 0.5 : 0.9);
        if (state === 'hit') lunge = -Math.sin(t01 * Math.PI) * 0.6;
        nk.segs.forEach((s, j) => { if (j > 0) { s.rotation.z = sway; s.rotation.x = -0.04 + lunge * 0.12; } });
        nk.jaw.rotation.x = state === 'attack' ? lunge * 0.6 : Math.max(0, Math.sin(time * 2 + nk.phase)) * 0.1;
        if (state === 'death') nk.segs.forEach((s, j) => { if (j > 0) s.rotation.x = ease(Math.min(1, t01 * 1.3)) * 0.35; });
      });
      if (state === 'walk') body.position.y = Math.abs(Math.sin(cyc * 2)) * 0.05;
      if (state === 'death') { const k = ease(Math.min(1, t01 * 1.4)); body.rotation.z = k * 0.5; body.position.y = -k * 0.35; }
    };
  }

  if (spec.kind === 'aranha') {
    const abdomen = mesh(new THREE.DodecahedronGeometry(0.42, 0));
    abdomen.scale.set(1, 0.8, 1.2);
    abdomen.position.set(0, 0.55, -0.4);
    const thorax = mesh(new THREE.DodecahedronGeometry(0.3, 0), accent);
    thorax.position.set(0, 0.5, 0.15);
    body.add(abdomen, thorax);
    // Engrenagem e olhos de gema
    const gear = mesh(new THREE.TorusGeometry(0.2, 0.05, 4, 10), mat('#d4a020', { metalness: 0.9, roughness: 0.25 }));
    gear.position.set(0, 0.95, -0.4);
    gear.rotation.x = Math.PI / 2;
    body.add(gear);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), eyeMat); e.position.set(s * 0.1, 0.58, 0.42); body.add(e); }
    const legs: { hip: THREE.Group; knee: THREE.Group; phase: number; side: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const side = i < 4 ? -1 : 1;
      const k = i % 4;
      const hip = new THREE.Group();
      hip.position.set(side * 0.22, 0.52, 0.3 - k * 0.2);
      hip.rotation.y = side * (0.4 - k * 0.3) + (side < 0 ? Math.PI : 0);
      const upper = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 4), accent);
      upper.rotation.z = Math.PI / 2;
      upper.position.x = 0.25;
      hip.add(upper);
      hip.rotation.z = 0.5;
      const knee = new THREE.Group();
      knee.position.x = 0.5;
      const lower = mesh(new THREE.CylinderGeometry(0.03, 0.015, 0.6, 4));
      lower.position.set(0.12, -0.28, 0);
      lower.rotation.z = 0.4;
      knee.add(lower);
      knee.rotation.z = -1.3;
      hip.add(knee);
      body.add(hip);
      legs.push({ hip, knee, phase: (k % 2 ? Math.PI : 0) + (side > 0 ? Math.PI : 0), side });
    }
    height = 1.1;
    radius = 0.9;
    pose = (state, t01, time) => {
      const cyc = t01 * TAU;
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      gear.rotation.z = time * 3;
      legs.forEach((l) => {
        l.hip.rotation.z = 0.5 + (state === 'walk' ? Math.max(0, Math.sin(cyc * 2 + l.phase)) * 0.4 : 0);
        l.hip.rotation.x = state === 'walk' ? Math.sin(cyc * 2 + l.phase) * 0.35 : 0;
      });
      if (state === 'idle') body.position.y = Math.sin(cyc) * 0.02;
      if (state === 'attack') { const k = t01 < 0.4 ? ease(t01 / 0.4) : 1 - ease((t01 - 0.4) / 0.6); body.position.z = k * 0.35; body.rotation.x = -k * 0.35; }
      if (state === 'hit') body.position.z = -Math.sin(t01 * Math.PI) * 0.2;
      if (state === 'death') { const k = ease(Math.min(1, t01 * 1.4)); body.rotation.z = k * Math.PI; body.position.y = k * 0.5; legs.forEach((l) => { l.hip.rotation.z = 0.5 + k * 1.2; }); }
    };
  }

  if (spec.kind === 'foca') {
    // Telquine: corpo de foca, cara de cachorro, nadadeiras como mãos
    const torso = mesh(new THREE.CapsuleGeometry(0.42, 1.0, 4, 8));
    torso.rotation.x = 1.05;
    torso.position.set(0, 0.75, -0.1);
    body.add(torso);
    const headG = new THREE.Group();
    headG.position.set(0, 1.3, 0.35);
    const skull = mesh(new THREE.BoxGeometry(0.46, 0.4, 0.46));
    const snout = mesh(new THREE.BoxGeometry(0.3, 0.2, 0.34), accent);
    snout.position.set(0, -0.06, 0.34);
    headG.add(skull, snout);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), eyeMat);
      e.position.set(s * 0.13, 0.07, 0.24);
      const ear = mesh(new THREE.ConeGeometry(0.07, 0.18, 4));
      ear.position.set(s * 0.17, 0.26, -0.05);
      headG.add(e, ear);
    }
    body.add(headG);
    const flippers: THREE.Group[] = [];
    for (const s of [-1, 1]) {
      const f = new THREE.Group();
      f.position.set(s * 0.42, 0.95, 0.15);
      const fl = mesh(new THREE.BoxGeometry(0.55, 0.06, 0.3), accent);
      fl.position.x = s * 0.25;
      f.add(fl);
      body.add(f);
      flippers.push(f);
    }
    const tail = mesh(new THREE.BoxGeometry(0.6, 0.06, 0.3), accent);
    tail.position.set(0, 0.2, -0.85);
    body.add(tail);
    height = 1.65;
    radius = 0.8;
    pose = (state, t01, time) => {
      const cyc = t01 * TAU;
      body.position.set(0, 0, 0);
      body.rotation.set(0, 0, 0);
      headG.rotation.set(0, 0, 0);
      flippers.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * Math.sin(time * 2) * 0.15; });
      if (state === 'idle') { body.position.y = Math.sin(cyc) * 0.03; headG.rotation.y = Math.sin(cyc) * 0.2; }
      if (state === 'walk') { body.position.y = Math.abs(Math.sin(cyc * 2)) * 0.12; body.rotation.x = Math.sin(cyc * 2) * 0.08; flippers.forEach((f, i) => { f.rotation.x = Math.sin(cyc * 2 + i * Math.PI) * 0.5; }); }
      if (state === 'attack') { const k = t01 < 0.4 ? ease(t01 / 0.4) : 1 - ease((t01 - 0.4) / 0.6); body.position.z = k * 0.4; headG.rotation.x = k * 0.5; flippers.forEach((f, i) => { f.rotation.z = (i ? 1 : -1) * k * 1.1; }); }
      if (state === 'hit') { body.position.z = -Math.sin(t01 * Math.PI) * 0.25; headG.rotation.x = -Math.sin(t01 * Math.PI) * 0.4; }
      if (state === 'death') { const k = ease(Math.min(1, t01 * 1.4)); body.rotation.x = -k * 1.2; body.position.set(0, -k * 0.2, -k * 0.5); }
    };
  }

  // Brasas subindo (Cão do Submundo, Cérbero)
  let embers: THREE.Points | null = null;
  let emberSpeed: Float32Array | null = null;
  if (spec.embers) {
    const N = 40;
    const pos = new Float32Array(N * 3);
    emberSpeed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 1.4; pos[i * 3 + 1] = Math.random() * 2; pos[i * 3 + 2] = (Math.random() - 0.5) * 2; emberSpeed[i] = 0.3 + Math.random() * 0.6; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    embers = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ff6a2a', size: 0.06, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    body.add(embers);
  }

  const scale = spec.scale ?? 1;
  root.scale.setScalar(scale);
  root.traverse((o) => { o.frustumCulled = false; });
  markOwn(root);

  // Animação ao vivo: estado + tempo; ações únicas voltam ao repouso sozinhas
  const DUR: Record<BakeState, number> = { idle: 2.4, walk: 0.9, attack: 0.8, hit: 0.5, death: 1.2 };
  let state: BakeState = 'idle';
  let stateT = 0;
  let time = 0;
  const once = new Set<BakeState>(['attack', 'hit', 'death']);
  return {
    root, height: height * scale, radius: radius * scale,
    play(action: HeroAction) {
      const map: Partial<Record<HeroAction, BakeState>> = { atacar: 'attack', ferido: 'hit', cair: 'death', andar: 'walk', correr: 'walk', parado: 'idle', magia: 'attack', defender: 'hit', esquivar: 'hit', pular: 'attack', comemorar: 'attack', reclamado: 'attack', interagir: 'idle', sentar: 'idle' };
      state = map[action] ?? 'idle';
      stateT = 0;
    },
    update(dt) {
      time += dt;
      stateT += dt;
      const d = DUR[state];
      if (once.has(state) && stateT >= d && state !== 'death') { state = 'idle'; stateT = 0; }
      const t01 = once.has(state) ? Math.min(1, stateT / d) : (stateT % d) / d;
      pose(state, t01, time);
      if (embers && emberSpeed) {
        const p = embers.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < p.count; i++) { let y = p.getY(i) + emberSpeed[i] * dt; if (y > 2.4) y = 0.3; p.setY(i, y); }
        p.needsUpdate = true;
      }
    },
    sample(s, t01) {
      pose(s, t01, t01 * DUR[s] * 3);
    },
    dispose() {
      root.traverse((o) => {
        const x = o as THREE.Mesh;
        if (x.isMesh || (o as THREE.Points).isPoints) {
          x.geometry?.dispose();
          (Array.isArray(x.material) ? x.material : [x.material]).forEach((mm) => mm?.dispose());
        }
      });
    },
  };
}

export type { CreatureSpec };
