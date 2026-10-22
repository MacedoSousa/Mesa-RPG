/**
 * Peças e criaturas procedurais (low-poly, flat shading) com animação por código.
 * Cada criatura implementa Figure: anda, ataca, se fere e cai como os bonecos do KayKit.
 */
import * as THREE from 'three';
import { surfaceMat } from './surfaces';
import { markOwn, mat, mix, type BakeState, type Figure, type HeadMetrics, type HeroAction, type ProcPart, type RigParts } from './figure';

const TAU = Math.PI * 2;

// ───────────────────────────── Peças para bonecos com esqueleto ─────────────────────────────
// Todas presas por p.anchor(osso): eixos do modelo (+Y cima, +Z frente), unidades do mundo.

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Cauda de serpente segmentada saindo da cintura, balançando. */
export function serpentTail(p: RigParts, color: string, opts: { segments?: number; length?: number; thick?: number; offsetX?: number; belly?: string } = {}): ProcPart | null {
  const root = p.anchor('hips');
  if (!root) return null;
  const n = opts.segments ?? 9;
  const len = opts.length ?? 2.2;
  const thick = opts.thick ?? 0.24;
  const skin = surfaceMat('escamas', color);
  const belly = surfaceMat('escamas', opts.belly ?? mix(color, '#d9c88a', 0.35));
  const base = new THREE.Group();
  base.position.copy(p.toAnchor('hips', V(opts.offsetX ?? 0, p.box.min.y + (p.box.max.y - p.box.min.y) * 0.3, -0.05)));
  root.add(base);
  const segs: THREE.Group[] = [];
  let parent: THREE.Object3D = base;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const r = thick * (1 - i / (n + 1));
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r * 0.96, len / n * 0.75, 4, 12), i % 2 ? skin : belly);
    seg.rotation.x = Math.PI / 2;
    seg.position.z = -len / n / 2;
    seg.castShadow = true;
    g.add(seg);
    g.position.z = i === 0 ? 0 : -len / n;
    if (i === 0) g.rotation.x = -1.1; // desce da cintura até o chão
    else if (i < 3) g.rotation.x = 0.45;
    parent.add(g);
    segs.push(g);
    parent = g;
  }
  markOwn(base);
  return {
    animate(time, state) {
      const speed = state === 'walk' ? 6 : state === 'attack' ? 9 : 2.2;
      const amp = state === 'death' ? 0.05 : state === 'walk' ? 0.35 : 0.18;
      segs.forEach((sg, i) => { if (i > 0) sg.rotation.y = Math.sin(time * speed - i * 0.7) * amp; });
    },
  };
}

/** Pena: folha alongada no plano XY, comprimento ao longo de +X. */
function featherShape(len: number, w: number) {
  const s = new THREE.Shape();
  s.moveTo(0, -w * 0.5);
  s.quadraticCurveTo(len * 0.55, -w * 1.05, len, -w * 0.1);
  s.quadraticCurveTo(len * 0.6, w * 0.95, 0, w * 0.5);
  s.lineTo(0, -w * 0.5);
  return new THREE.ShapeGeometry(s, 6);
}

/** Onde as asas nascem: costas, logo abaixo da cabeça. */
function shoulderBlade(p: RigParts, side: number) {
  const neckY = p.headBox ? p.headBox.min.y : p.box.min.y + (p.box.max.y - p.box.min.y) * 0.55;
  return V(side * 0.14, neckY - 0.08, -0.2);
}

/** Asas de penas (Harpia) ou de morcego (Fúria), varridas para trás e batendo. */
export function wings(p: RigParts, kind: 'morcego' | 'penas', color: string, tip = '#3a2a1a'): ProcPart | null {
  const anchor = p.anchor('chest');
  if (!anchor) return null;
  const sides: { pivot: THREE.Group; side: number }[] = [];
  const all = new THREE.Group();
  anchor.add(all);
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.copy(p.toAnchor('chest', shoulderBlade(p, side)));
    const wing = new THREE.Group();
    wing.scale.x = side; // espelha a asa esquerda
    if (kind === 'penas') {
      // Asa de ave: bordo de ataque curvo, rêmiges recortadas na borda de fuga
      const wingShape = (scale: number) => {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0.12 * scale);
        sh.quadraticCurveTo(0.45 * scale, 0.6 * scale, 1.25 * scale, 0.5 * scale);
        const tips = [[1.3, 0.2], [1.12, -0.12], [0.92, -0.32], [0.7, -0.44], [0.47, -0.48], [0.24, -0.42]];
        let px = 1.25, py = 0.5;
        for (const [tx, ty] of tips) {
          // cada pena: ponta arredondada e um recorte entre ela e a próxima
          sh.quadraticCurveTo(((px + tx) / 2 + 0.06) * scale, ((py + ty) / 2) * scale, tx * scale, ty * scale);
          sh.lineTo((tx - 0.1) * scale, (ty + 0.1) * scale);
          px = tx - 0.1; py = ty + 0.1;
        }
        sh.quadraticCurveTo(0.08 * scale, -0.2 * scale, 0, -0.12 * scale);
        sh.lineTo(0, 0.12 * scale);
        return new THREE.ShapeGeometry(sh, 8);
      };
      const outer = new THREE.Mesh(wingShape(1), surfaceMat('penas', mix(color, tip, 0.45), { side: THREE.DoubleSide, repeat: 1.2 }));
      outer.castShadow = true;
      const inner = new THREE.Mesh(wingShape(0.72), surfaceMat('penas', color, { side: THREE.DoubleSide, repeat: 1 }));
      inner.position.set(0, 0.08, 0.012);
      const coverts = new THREE.Mesh(wingShape(0.42), surfaceMat('penas', mix(color, '#efe3c8', 0.35), { side: THREE.DoubleSide, repeat: 0.8 }));
      coverts.position.set(0, 0.14, 0.024);
      // listras das penas
      for (let i = 0; i < 5; i++) {
        const l = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.004), mat(mix(tip, '#000000', 0.2)));
        const ang = -0.25 - i * 0.22;
        l.position.set(0.42 + Math.cos(ang) * 0.35, 0.05 + Math.sin(ang) * 0.35, 0.03);
        l.rotation.z = ang;
        wing.add(l);
      }
      wing.add(outer, inner, coverts);
      wing.scale.multiplyScalar(0.95);
    } else {
      // Membrana de morcego com dedos ósseos
      const sh = new THREE.Shape();
      sh.moveTo(0, 0.05);
      sh.lineTo(0.55, 0.42);
      sh.lineTo(1.25, 0.5);
      sh.quadraticCurveTo(1.05, 0.15, 1.12, -0.12);
      sh.quadraticCurveTo(0.85, -0.02, 0.78, -0.32);
      sh.quadraticCurveTo(0.55, -0.15, 0.42, -0.42);
      sh.quadraticCurveTo(0.22, -0.2, 0, -0.32);
      const mem = new THREE.Mesh(new THREE.ShapeGeometry(sh, 6), surfaceMat('couro', color, { side: THREE.DoubleSide, repeat: 1.5 }));
      mem.castShadow = true;
      wing.add(mem);
      const boneMat = mat('#1c141f');
      for (const [x, y] of [[1.25, 0.5], [1.12, -0.12], [0.78, -0.32], [0.42, -0.42]]) {
        const l = Math.hypot(x - 0.55, y - 0.42);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, l, 4), boneMat);
        b.position.set((x + 0.55) / 2, (y + 0.42) / 2, 0.01);
        b.rotation.z = Math.atan2(y - 0.42, x - 0.55) - Math.PI / 2;
        wing.add(b);
      }
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.7, 5), boneMat);
      arm.position.set(0.27, 0.23, 0.01);
      arm.rotation.z = Math.atan2(0.42 - 0.05, 0.55) - Math.PI / 2;
      wing.add(arm);
    }
    pivot.add(wing);
    all.add(pivot);
    sides.push({ pivot, side });
  }
  markOwn(all);
  return {
    animate(time, state, t01) {
      const flap = state === 'attack' ? Math.sin(t01 * Math.PI * 2) : state === 'walk' ? Math.sin(time * 9) : Math.sin(time * 2.4);
      const amp = state === 'death' ? 0 : state === 'attack' ? 0.65 : state === 'walk' ? 0.5 : 0.18;
      const open = state === 'death' ? 0.15 : state === 'attack' || state === 'walk' ? 0.25 : 0.45; // varrida p/ trás
      for (const { pivot, side } of sides) {
        pivot.rotation.set(0, side * open, side * (0.25 + flap * amp));
      }
    },
  };
}

/** Garras de ave nos pés (Harpia). */
export function talons(p: RigParts, color = '#d9b36a') {
  for (const foot of ['footl', 'footr']) {
    const a = p.anchor(foot);
    if (!a) continue;
    const g = new THREE.Group();
    for (const dx of [-0.07, 0, 0.07]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 4), mat(color));
      c.rotation.x = Math.PI / 2;
      c.position.set(dx, -0.02, 0.16);
      g.add(c);
    }
    a.add(markOwn(g));
  }
}

/** Cauda de penas (Harpia). */
export function featherTail(p: RigParts, color: string): ProcPart | null {
  const a = p.anchor('hips');
  if (!a) return null;
  const g = new THREE.Group();
  g.position.copy(p.toAnchor('hips', V(0, p.box.min.y + (p.box.max.y - p.box.min.y) * 0.32, -0.22)));
  g.rotation.x = -0.55; // aponta para trás e um pouco para baixo
  for (let i = 0; i < 5; i++) {
    const f = new THREE.Mesh(featherShape(0.5, 0.13), surfaceMat('penas', mix(color, '#2a1a10', i % 2 ? 0.35 : 0), { side: THREE.DoubleSide, repeat: 0.8 }));
    f.rotation.x = -Math.PI / 2; // deita a pena
    const holder = new THREE.Group();
    holder.rotation.y = Math.PI / 2 + (i - 2) * 0.28; // leque horizontal para trás
    holder.add(f);
    g.add(holder);
  }
  a.add(markOwn(g));
  return { animate(time, state) { g.rotation.z = Math.sin(time * (state === 'walk' ? 8 : 2)) * 0.15; } };
}

/** Cabelo de serpentes da Górgona. */
export function snakeHair(p: RigParts, color: string): ProcPart | null {
  const a = p.anchor('head');
  if (!a || !p.head) return null;
  const hm = p.head;
  const g = new THREE.Group();
  a.add(g);
  const snakes: THREE.Group[] = [];
  const skin = surfaceMat('escamas', color, { repeat: 1 });
  const n = 13;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU;
    if (Math.cos(ang) > 0.8) continue; // deixa o rosto livre
    const sn = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([V(0, 0, 0), V(0, 0.12, 0.04), V(0, 0.22, 0.12), V(0, 0.27, 0.24)]);
    sn.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.038, 6), skin));
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 5).scale(0.9, 0.65, 1.5), skin);
    hd.position.set(0, 0.27, 0.28);
    sn.add(hd);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 4, 3), new THREE.MeshBasicMaterial({ color: '#ffd34d' })); e.position.set(s * 0.03, 0.3, 0.32); sn.add(e); }
    const r = hm.width * 0.4;
    sn.position.set(Math.sin(ang) * r, hm.top - 0.16, Math.cos(ang) * r * 0.8 - 0.05);
    sn.rotation.y = ang;
    sn.rotation.x = -0.45;
    g.add(sn);
    snakes.push(sn);
  }
  markOwn(g);
  return { animate(time) { snakes.forEach((sn, i) => { sn.rotation.z = Math.sin(time * 3 + i) * 0.3; }); } };
}

/** Cabelo de chamas (Empusa) que tremula. */
export function flameHair(p: RigParts): ProcPart | null {
  const a = p.anchor('head');
  if (!a || !p.head) return null;
  const hm = p.head;
  const g = new THREE.Group();
  a.add(g);
  const flames: THREE.Mesh[] = [];
  for (let i = 0; i < 11; i++) {
    const ang = (i / 11) * TAU;
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.45, 6), mat(i % 2 ? '#ff7a1a' : '#ffd166', { emissive: i % 2 ? '#ff5a00' : '#ffb000', emissiveIntensity: 1.4 }));
    f.position.set(Math.sin(ang) * hm.width * 0.3, hm.top + 0.04, Math.cos(ang) * hm.width * 0.28 - 0.06);
    f.rotation.x = -0.35;
    g.add(f);
    flames.push(f);
  }
  markOwn(g);
  return { animate(time) { flames.forEach((f, i) => { const k = 1 + Math.sin(time * 12 + i * 1.7) * 0.18; f.scale.set(1, k, 1); }); } };
}

/** Cabeça de touro: chifres, focinho com argola e orelhas. */
export function bullHead(p: RigParts) {
  const a = p.anchor('head');
  if (!a || !p.head) return;
  const hm = p.head;
  const g = new THREE.Group();
  const horn = surfaceMat('osso', '#efe6d2');
  for (const s of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      V(s * hm.width * 0.4, hm.top - 0.2, 0), V(s * hm.width * 0.75, hm.top - 0.05, 0.05),
      V(s * hm.width * 0.85, hm.top + 0.25, 0.12), V(s * hm.width * 0.72, hm.top + 0.42, 0.18),
    ]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.07, 7), horn));
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), surfaceMat('pelo', '#4a2c16', { repeat: 1 }));
    ear.position.set(s * hm.width * 0.55, hm.top * 0.55, -0.02);
    ear.rotation.z = s * 1.6;
    g.add(ear);
  }
  const eyeY = hm.eyes ? (hm.eyes.l.y + hm.eyes.r.y) / 2 : hm.top * 0.45;
  const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, hm.width * 0.28, 4, 12).rotateZ(Math.PI / 2), surfaceMat('pelo', '#3b2414', { repeat: 1 }));
  snout.position.set(0, eyeY - 0.2, hm.front - 0.02);
  g.add(snout);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.014, 5, 12), mat('#d4a020', { metalness: 0.8, roughness: 0.3 }));
  ring.position.set(0, eyeY - 0.3, hm.front + 0.12);
  g.add(ring);
  a.add(markOwn(g));
}

/** Chifres na cabeça de um humanoide (Oficina de bonecos). */
export function rigHorns(p: RigParts, kind: 'chifres' | 'bode' | 'touro' | 'coroa', color = '#e4d8bc') {
  const a = p.anchor('head');
  if (!a || !p.head) return;
  if (kind === 'touro') return bullHead(p);
  const hm = p.head;
  const g = new THREE.Group();
  const m = surfaceMat('osso', color);
  for (const s of [-1, 1]) {
    if (kind === 'coroa') {
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 6), m);
        c.position.set(s * hm.width * (0.12 + i * 0.12), hm.top + 0.02 - i * 0.03, 0.02 - i * 0.05);
        c.rotation.z = -s * (0.2 + i * 0.2);
        g.add(c);
      }
      continue;
    }
    const pts = kind === 'bode'
      ? [V(s * hm.width * 0.22, hm.top - 0.06, 0.02), V(s * hm.width * 0.4, hm.top + 0.12, -0.12), V(s * hm.width * 0.55, hm.top + 0.02, -0.3), V(s * hm.width * 0.5, hm.top - 0.15, -0.26)]
      : [V(s * hm.width * 0.25, hm.top - 0.05, 0.03), V(s * hm.width * 0.45, hm.top + 0.15, -0.05), V(s * hm.width * 0.4, hm.top + 0.35, -0.2)];
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 12, 1, 7, false);
    // afina até a ponta
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= 12; i++) {
      curve.getPointAt(i / 12, c);
      const r = 0.06 * (1 - (i / 12) * 0.9);
      for (let j = 0; j <= 7; j++) { const k = i * 8 + j; v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c); pos.setXYZ(k, v.x, v.y, v.z); }
    }
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, m));
  }
  a.add(markOwn(g));
}

/** Presas saindo da boca (Lestrigão). */
export function tusks(p: RigParts) {
  const a = p.anchor('head');
  if (!a || !p.head) return;
  const hm = p.head;
  const eyeY = hm.eyes ? (hm.eyes.l.y + hm.eyes.r.y) / 2 : hm.top * 0.45;
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.2, 8), surfaceMat('osso', '#f1e9d2'));
    t.position.set(s * hm.width * 0.16, eyeY - 0.28, hm.front - 0.02);
    t.rotation.x = -0.25;
    g.add(t);
  }
  a.add(markOwn(g));
}

/** Um olho só, grande, no meio da testa (Ciclope). Use com hideEyes. */
export function cyclopsEye(p: RigParts, iris: string) {
  const a = p.anchor('head');
  if (!a || !p.head) return;
  a.add(cyclopsEyeMesh(p.head, iris));
}

export function cyclopsEyeMesh(head: HeadMetrics, irisColor: string) {
  const eye = new THREE.Group();
  const size = Math.min(0.19, Math.max(0.12, (head.eyes?.size ?? 0.05) * 3.3));
  const white = new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), mat('#f8f6f0', { flatShading: false, roughness: 0.25 }));
  const iris = new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 14, 10), mat(irisColor, { flatShading: false, roughness: 0.2 }));
  iris.position.z = size * 0.8;
  iris.scale.z = 0.5;
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(size * 0.28, 12, 8), mat('#0b0b0b', { flatShading: false }));
  pupil.position.z = size * 1.0;
  pupil.scale.z = 0.4;
  const glint = new THREE.Mesh(new THREE.SphereGeometry(size * 0.09, 6, 4), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  glint.position.set(size * 0.2, size * 0.22, size * 1.08);
  // Pálpebra/sobrancelha única por cima
  const brow = new THREE.Mesh(new THREE.BoxGeometry(size * 2.3, size * 0.32, size * 0.5), mat('#3a2a20'));
  brow.position.set(0, size * 1.02, size * 0.45);
  eye.add(white, iris, pupil, glint, brow);
  const c = head.eyes ? head.eyes.l.clone().add(head.eyes.r).multiplyScalar(0.5) : V(0, head.top * 0.42, head.front * 0.85);
  eye.position.set(c.x, c.y + size * 0.1, c.z - size * 0.25);
  eye.scale.z = 0.75;
  eye.name = 'olho_ciclope';
  return markOwn(eye);
}

/** Olhos brilhando exatamente sobre os olhos do modelo. */
export function glowingEyes(p: RigParts, color: string) {
  const a = p.anchor('head');
  if (!a || !p.head) return;
  const hm = p.head;
  const g = new THREE.Group();
  const m = new THREE.MeshBasicMaterial({ color });
  const pts = hm.eyes ? [hm.eyes.l, hm.eyes.r] : [V(-hm.width * 0.17, hm.top * 0.44, hm.front * 0.95), V(hm.width * 0.17, hm.top * 0.44, hm.front * 0.95)];
  const r = hm.eyes ? hm.eyes.size * 0.75 : 0.045;
  for (const q of pts) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), m);
    e.position.set(q.x, q.y, q.z + 0.012);
    e.scale.z = 0.4;
    g.add(e);
  }
  a.add(markOwn(g));
}
