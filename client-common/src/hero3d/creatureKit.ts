/**
 * Gerador de criaturas a partir de uma receita (FigureRecipe), como o gerador de mapas:
 * base (fera, serpente, hidra, aranha, ave, marinho, golem) + partes + superfície + cores.
 * Corpos arredondados, superfícies com textura e relevo, barriga clara, olhos com íris,
 * pupila e brilho, dentes, garras, chifres, espinhos, asas, caudas e auras, todos animados.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { FigureRecipe, Surface3D } from '@mesa/shared';
import { markOwn, mix, type BakeState, type Figure, type HeroAction } from './figure';
import { shadeBelly, surfaceMat } from './surfaces';

const TAU = Math.PI * 2;
const ease = (t: number) => t * t * (3 - 2 * t);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const once01 = (t01: number, peak = 0.4) => (t01 < peak ? ease(t01 / peak) : 1 - ease((t01 - peak) / (1 - peak)));

/** Pedaço de animação: recebe estado, fração do ciclo e tempo. */
type Anim = (state: BakeState, t01: number, time: number) => void;

interface Kit {
  rec: FigureRecipe;
  skin: THREE.MeshStandardMaterial; // cores por vértice (dorso → barriga)
  accent: THREE.MeshStandardMaterial;
  horn: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  anims: Anim[];
}

function makeKit(rec: FigureRecipe): Kit {
  const hornColor = rec.surface === 'bronze' ? '#d4a020' : rec.surface === 'pedra' ? '#5a5a54' : '#e4d8bc';
  return {
    rec,
    skin: surfaceMat(rec.surface, rec.color, { vertexColors: true }),
    accent: surfaceMat(rec.surface === 'pelo' || rec.surface === 'penas' ? 'couro' : rec.surface, rec.accent),
    horn: surfaceMat(rec.surface === 'bronze' ? 'bronze' : 'osso', hornColor),
    dark: new THREE.MeshStandardMaterial({ color: '#141014', roughness: 0.6 }),
    anims: [],
  };
}

/** Malha com a pele da criatura: barriga clara e dorso na cor do corpo. */
function skinned(kit: Kit, geo: THREE.BufferGeometry, up = V(0, 1, 0)) {
  shadeBelly(geo, kit.rec.color, kit.rec.belly, up);
  const m = new THREE.Mesh(geo, kit.skin);
  m.castShadow = true;
  return m;
}
function plain(geo: THREE.BufferGeometry, m: THREE.Material) {
  const x = new THREE.Mesh(geo, m);
  x.castShadow = true;
  return x;
}

/** Cápsula deitada ao longo de Z (corpo, focinho, segmentos). */
function capsuleZ(r: number, len: number) {
  const g = new THREE.CapsuleGeometry(r, len, 6, 14);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Tubo que afina (chifres, garras, espinhos curvos). */
function taperedTube(points: THREE.Vector3[], r0: number, r1: number, seg = 12, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(points);
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, c);
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  // tampa a ponta grossa
  g.computeVertexNormals();
  return g;
}

/** Olho de verdade: esclera, íris colorida, pupila (redonda ou em fenda) e brilho. */
function makeEye(r: number, iris: string, opts: { slit?: boolean; glow?: boolean } = {}) {
  const g = new THREE.Group();
  const sclera = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshStandardMaterial({ color: opts.glow ? '#1a0a0a' : '#f1ead8', roughness: 0.25 }));
  g.add(sclera);
  const irisMat = opts.glow
    ? new THREE.MeshBasicMaterial({ color: iris })
    : new THREE.MeshStandardMaterial({ color: iris, roughness: 0.3, emissive: iris, emissiveIntensity: 0.15 });
  const ir = new THREE.Mesh(new THREE.CircleGeometry(r * 0.7, 18), irisMat);
  ir.position.z = r * 0.93;
  g.add(ir);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(r * 0.34, 14), new THREE.MeshBasicMaterial({ color: '#050305' }));
  if (opts.slit) pupil.scale.set(0.35, 1.5, 1);
  pupil.position.z = r * 0.95;
  g.add(pupil);
  const hi = new THREE.Mesh(new THREE.CircleGeometry(r * 0.16, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  hi.position.set(r * 0.3, r * 0.32, r * 0.97);
  g.add(hi);
  // pálpebra de cima (dá expressão e esconde o "globo")
  const lid = new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 14, 8, 0, TAU, 0, Math.PI * 0.42), new THREE.MeshStandardMaterial({ color: '#000000', roughness: 0.8 }));
  lid.rotation.x = -0.35;
  lid.userData.lid = true;
  g.add(lid);
  return g;
}

/** Fileira de dentes (cones), apontando para baixo (ou para cima na mandíbula). */
function teeth(width: number, n: number, size: number, up = false) {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: '#f4efe0', roughness: 0.4 });
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const big = i === 0 || i === n - 1; // presas nas pontas
    const c = new THREE.Mesh(new THREE.ConeGeometry(size * (big ? 0.55 : 0.35), size * (big ? 1.8 : 1), 5), m);
    c.position.x = (t - 0.5) * width;
    c.rotation.x = up ? 0 : Math.PI;
    c.position.y = up ? size * 0.4 : -size * 0.4;
    g.add(c);
  }
  return g;
}

/** Garras curvas na frente de uma pata. */
function claws(kit: Kit, n: number, spread: number, size: number) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const x = (n === 1 ? 0 : i / (n - 1) - 0.5) * spread;
    const c = plain(taperedTube([V(0, 0, 0), V(0, -size * 0.2, size * 0.6), V(0, -size * 0.75, size * 0.85)], size * 0.22, 0.004, 6, 5), kit.horn);
    c.position.x = x;
    g.add(c);
  }
  return g;
}

/** Chifres conforme a receita, presos no topo da cabeça (r = raio do crânio). */
function horns(kit: Kit, r: number) {
  const g = new THREE.Group();
  const kind = kit.rec.horns;
  if (kind === 'nenhum') return g;
  for (const s of [-1, 1]) {
    let pts: THREE.Vector3[];
    let r0 = r * 0.22;
    if (kind === 'touro') pts = [V(s * r * 0.55, r * 0.45, 0), V(s * r * 1.3, r * 0.6, 0.05), V(s * r * 1.55, r * 1.25, 0.25)];
    else if (kind === 'bode') pts = [V(s * r * 0.3, r * 0.75, -0.02), V(s * r * 0.55, r * 1.35, -r * 0.4), V(s * r * 0.85, r * 1.1, -r * 1.0), V(s * r * 0.75, r * 0.6, -r * 0.9)];
    else if (kind === 'coroa') {
      // coroa de espinhos: vários pequenos em arco
      for (let i = 0; i < 4; i++) {
        const a = (i / 3 - 0.5) * 1.6;
        const sp = plain(new THREE.ConeGeometry(r * 0.1, r * 0.55, 6), kit.horn);
        sp.position.set(s * Math.sin(a + 0.4) * r * 0.75, r * 0.85, Math.cos(a + 0.4) * r * 0.2 - r * 0.2);
        sp.rotation.z = -s * 0.35;
        g.add(sp);
      }
      continue;
    } else { pts = [V(s * r * 0.4, r * 0.7, 0), V(s * r * 0.8, r * 1.3, -r * 0.3), V(s * r * 0.7, r * 1.75, -r * 0.9)]; r0 = r * 0.18; }
    g.add(plain(taperedTube(pts, r0, 0.006), kit.horn));
    // anéis do chifre
    for (let k = 1; k < 4; k++) {
      const ring = plain(new THREE.TorusGeometry(r0 * (1 - k * 0.2), r0 * 0.12, 4, 10), kit.horn);
      const p = new THREE.CatmullRomCurve3(pts).getPointAt(k * 0.15);
      ring.position.copy(p);
      ring.lookAt(new THREE.CatmullRomCurve3(pts).getPointAt(k * 0.15 + 0.05));
      g.add(ring);
    }
  }
  return g;
}

/** Fileira de espinhos ao longo das costas (de z0 a z1, na altura y). */
function spineSpikes(kit: Kit, y: (z: number) => number, z0: number, z1: number, n: number, h: number) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const z = z0 + (z1 - z0) * t;
    const s = h * (0.55 + Math.sin(t * Math.PI) * 0.6);
    const sp = plain(new THREE.ConeGeometry(s * 0.32, s, 6), kit.accent);
    sp.position.set(0, y(z) + s * 0.35, z);
    sp.rotation.x = -0.45;
    g.add(sp);
  }
  return g;
}

/** Cabeça de criatura (fera ou réptil): crânio, focinho, mandíbula com dentes, olhos e orelhas. */
function creatureHead(kit: Kit, r: number, style: 'fera' | 'reptil' | 'cao') {
  const head = new THREE.Group();
  const rec = kit.rec;
  const skull = skinned(kit, new THREE.SphereGeometry(r, 20, 14));
  skull.scale.set(1, style === 'reptil' ? 0.75 : 0.9, style === 'reptil' ? 1.15 : 1.05);
  head.add(skull);
  // focinho
  const snoutLen = style === 'reptil' ? r * 1.25 : style === 'cao' ? r * 0.85 : r * 0.6;
  const snout = skinned(kit, capsuleZ(r * (style === 'reptil' ? 0.48 : 0.5), snoutLen));
  snout.scale.y = style === 'reptil' ? 0.7 : 0.85;
  snout.position.set(0, -r * 0.18, r * 0.65 + snoutLen * 0.35);
  head.add(snout);
  const tipZ = r * 0.65 + snoutLen * 0.35 + snoutLen * 0.5 + r * 0.45;
  // nariz / narinas
  if (style !== 'reptil') {
    const nose = plain(new THREE.SphereGeometry(r * 0.2, 10, 8), kit.dark);
    nose.scale.set(1.3, 0.8, 0.9);
    nose.position.set(0, -r * 0.05, tipZ - r * 0.05);
    head.add(nose);
  } else {
    for (const s of [-1, 1]) { const n = plain(new THREE.SphereGeometry(r * 0.06, 6, 4), kit.dark); n.position.set(s * r * 0.16, -r * 0.08, tipZ - r * 0.08); head.add(n); }
  }
  // dentes de cima
  const upper = teeth(r * 0.75, 6, r * 0.12);
  upper.position.set(0, -r * 0.42, tipZ - r * 0.5);
  head.add(upper);
  // mandíbula articulada
  const jaw = new THREE.Group();
  jaw.position.set(0, -r * 0.38, r * 0.25);
  const jm = skinned(kit, capsuleZ(r * 0.38, snoutLen * 0.9));
  jm.scale.set(0.95, 0.42, 1);
  jm.position.set(0, -r * 0.08, snoutLen * 0.5 + r * 0.15);
  const lower = teeth(r * 0.65, 5, r * 0.1, true);
  lower.position.set(0, -r * 0.02, snoutLen * 0.6 + r * 0.3);
  const tongue = plain(capsuleZ(r * 0.12, snoutLen * 0.5), new THREE.MeshStandardMaterial({ color: '#b03a48', roughness: 0.4 }));
  tongue.scale.y = 0.4;
  tongue.position.set(0, -r * 0.02, snoutLen * 0.45);
  jaw.add(jm, lower, tongue);
  head.add(jaw);
  // olhos (com sobrancelha óssea)
  const eyes: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const e = makeEye(r * 0.2, rec.eyes, { slit: style === 'reptil' || rec.surface === 'escamas' || rec.surface === 'lodo', glow: rec.glow });
    e.position.set(s * r * 0.48, r * 0.2, r * 0.68);
    e.rotation.y = s * 0.55;
    head.add(e);
    eyes.push(e);
    const brow = skinned(kit, new THREE.SphereGeometry(r * 0.22, 10, 6));
    brow.scale.set(1.3, 0.45, 0.9);
    brow.position.set(s * r * 0.46, r * 0.4, r * 0.64);
    brow.rotation.z = s * -0.3;
    head.add(brow);
  }
  // orelhas (feras) ou crista (répteis)
  if (style !== 'reptil' && rec.surface !== 'escamas' && rec.surface !== 'lodo') {
    for (const s of [-1, 1]) {
      const ear = skinned(kit, new THREE.ConeGeometry(r * 0.28, r * 0.7, 8));
      ear.scale.z = 0.45;
      ear.position.set(s * r * 0.55, r * 0.75, -r * 0.15);
      ear.rotation.set(-0.25, 0, s * -0.35);
      head.add(ear);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const c = plain(new THREE.ConeGeometry(r * 0.1, r * (0.45 - i * 0.07), 5), kit.accent);
      c.position.set(0, r * 0.7 - i * r * 0.05, -r * 0.05 - i * r * 0.28);
      c.rotation.x = -0.6;
      head.add(c);
    }
  }
  head.add(horns(kit, r));
  return { head, jaw, eyes };
}

// ───────────────────────────── Asas, caudas e aura ─────────────────────────────

function featherGeo(len: number, w: number) {
  const s = new THREE.Shape();
  s.moveTo(0, -w * 0.5);
  s.quadraticCurveTo(len * 0.55, -w * 1.05, len, -w * 0.1);
  s.quadraticCurveTo(len * 0.6, w * 0.95, 0, w * 0.5);
  s.lineTo(0, -w * 0.5);
  return new THREE.ShapeGeometry(s, 6);
}

/** Par de asas; devolve o grupo e a animação de bater. span = envergadura de uma asa. */
function wingPair(kit: Kit, span: number): { group: THREE.Group; anim: Anim } | null {
  const kind = kit.rec.wings;
  if (kind === 'nenhuma') return null;
  const group = new THREE.Group();
  const pivots: { p: THREE.Group; side: number }[] = [];
  const membrane = surfaceMat('couro', kind === 'inseto' ? mix(kit.rec.accent, '#e0f2fe', 0.6) : kit.rec.accent, { side: THREE.DoubleSide, transparent: kind === 'inseto', opacity: kind === 'inseto' ? 0.55 : 1 });
  const featherMats = [surfaceMat('penas', mix(kit.rec.accent, '#000000', 0.15), { side: THREE.DoubleSide, repeat: 1 }), surfaceMat('penas', kit.rec.color, { side: THREE.DoubleSide, repeat: 1 }), surfaceMat('penas', mix(kit.rec.belly, kit.rec.color, 0.4), { side: THREE.DoubleSide, repeat: 1 })];
  for (const side of [-1, 1]) {
    const p = new THREE.Group();
    const w = new THREE.Group();
    w.scale.set(side * span, span, span);
    if (kind === 'morcego') {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0.05); sh.lineTo(0.55, 0.42); sh.lineTo(1.25, 0.5);
      sh.quadraticCurveTo(1.05, 0.15, 1.12, -0.12); sh.quadraticCurveTo(0.85, -0.02, 0.78, -0.32);
      sh.quadraticCurveTo(0.55, -0.15, 0.42, -0.42); sh.quadraticCurveTo(0.22, -0.2, 0, -0.32);
      w.add(plain(new THREE.ShapeGeometry(sh, 8), membrane));
      for (const [x, y] of [[1.25, 0.5], [1.12, -0.12], [0.78, -0.32], [0.42, -0.42]]) w.add(plain(taperedTube([V(0.55, 0.42, 0.01), V(x, y, 0.01)], 0.03, 0.008, 4, 5), kit.horn));
      w.add(plain(taperedTube([V(0, 0.05, 0.01), V(0.55, 0.42, 0.01)], 0.045, 0.03, 4, 6), kit.horn));
      const thumb = plain(new THREE.ConeGeometry(0.03, 0.12, 5), kit.horn);
      thumb.position.set(0.58, 0.5, 0.01);
      w.add(thumb);
    } else if (kind === 'penas') {
      // três camadas de penas em leque
      const layers: [number, number, number][] = [[1.15, 0.2, 9], [0.8, 0.17, 8], [0.48, 0.14, 7]];
      layers.forEach(([len, wd, n], li) => {
        for (let i = 0; i < n; i++) {
          const a = 0.45 - (i / (n - 1)) * 1.35;
          const f = plain(featherGeo(len * (1 - i * 0.03), wd), featherMats[li]);
          f.position.set(0.05 + i * 0.04, 0.12 + li * 0.06, 0.01 + li * 0.012);
          f.rotation.z = a;
          w.add(f);
        }
      });
    } else {
      // inseto: dois pares de asas finas com nervuras
      for (const [len, wd, a] of [[1.2, 0.3, 0.25], [0.95, 0.24, -0.2]] as const) {
        const e = plain(new THREE.CircleGeometry(1, 20), membrane);
        e.scale.set(len / 2, wd, 1);
        e.position.set(len / 2, 0, 0);
        const holder = new THREE.Group();
        holder.rotation.z = a;
        holder.add(e);
        w.add(holder);
      }
    }
    p.add(w);
    group.add(p);
    pivots.push({ p, side });
  }
  const anim: Anim = (state, t01, time) => {
    const fast = kind === 'inseto' ? 30 : 9;
    const flap = state === 'attack' ? Math.sin(t01 * TAU) : state === 'walk' ? Math.sin(time * fast) : Math.sin(time * (kind === 'inseto' ? 18 : 2.4));
    const amp = state === 'death' ? 0 : state === 'attack' ? 0.7 : state === 'walk' ? 0.55 : kind === 'inseto' ? 0.25 : 0.18;
    const open = state === 'death' ? 0.1 : state === 'attack' || state === 'walk' ? 0.25 : 0.5;
    for (const { p, side } of pivots) p.rotation.set(0, side * open, side * (0.3 + flap * amp));
  };
  return { group, anim };
}

/** Cauda conforme a receita, saindo de `attach` e indo para trás (-Z). */
function buildTail(kit: Kit, attach: THREE.Object3D, at: THREE.Vector3, thick: number, len: number): Anim | null {
  const kind = kit.rec.tail;
  if (kind === 'nenhuma') return null;
  const n = kind === 'curta' ? 3 : kind === 'escorpiao' ? 8 : 7;
  const L = kind === 'curta' ? len * 0.35 : len;
  const segs: THREE.Group[] = [];
  let parent: THREE.Object3D = attach;
  const segMat = kind === 'serpente' ? surfaceMat('escamas', mix(kit.rec.accent, '#3f6a3a', 0.5)) : kind === 'escorpiao' ? surfaceMat('carapaca', kit.rec.accent) : null;
  for (let i = 0; i < n; i++) {
    const g = new THREE.Group();
    const r = thick * (1 - (i / n) * 0.7);
    const seg = segMat ? plain(capsuleZ(r, L / n * 0.7), segMat) : skinned(kit, capsuleZ(r, L / n * 0.7));
    seg.position.z = -L / n / 2;
    g.add(seg);
    if (i === 0) { g.position.copy(at); g.rotation.x = kind === 'escorpiao' ? 0.5 : -0.5; }
    else { g.position.z = -L / n; g.rotation.x = kind === 'escorpiao' ? -0.42 : 0.12; }
    parent.add(g);
    segs.push(g);
    parent = g;
  }
  const tip = new THREE.Group();
  tip.position.z = -L / n;
  parent.add(tip);
  let flames: THREE.Mesh[] = [];
  if (kind === 'longa' && kit.rec.surface === 'pelo') {
    const tuft = skinned(kit, new THREE.ConeGeometry(thick * 0.9, thick * 3.5, 10));
    tuft.rotation.x = -Math.PI / 2;
    tuft.position.z = -thick * 1.2;
    tip.add(tuft);
  }
  if (kind === 'serpente') {
    const h = creatureHead({ ...kit, skin: kit.skin }, thick * 1.5, 'reptil');
    h.head.rotation.y = Math.PI;
    h.head.position.z = -thick;
    tip.add(h.head);
  }
  if (kind === 'escorpiao') {
    const bulb = plain(new THREE.SphereGeometry(thick * 1.2, 12, 10), segMat!);
    bulb.position.z = -thick;
    const sting = plain(taperedTube([V(0, 0, -thick * 1.8), V(0, -thick * 1.2, -thick * 3), V(0, -thick * 2.6, -thick * 2.6)], thick * 0.45, 0.004, 8, 6), kit.horn);
    tip.add(bulb, sting);
  }
  if (kind === 'clava') {
    const ball = plain(new THREE.IcosahedronGeometry(thick * 1.8, 1), kit.horn);
    ball.position.z = -thick * 1.5;
    tip.add(ball);
    for (let i = 0; i < 8; i++) {
      const d = new THREE.Vector3().randomDirection();
      const sp = plain(new THREE.ConeGeometry(thick * 0.35, thick * 1.4, 5), kit.horn);
      sp.position.copy(d.clone().multiplyScalar(thick * 1.9)).add(ball.position);
      sp.quaternion.setFromUnitVectors(V(0, 1, 0), d);
      tip.add(sp);
    }
  }
  if (kind === 'chamas') {
    const cols = ['#ff4a14', '#ff8a2a', '#ffe27a'];
    flames = cols.map((c, i) => {
      const f = new THREE.Mesh(new THREE.ConeGeometry(thick * (1.6 - i * 0.4), thick * (5 - i), 10), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      f.rotation.x = -Math.PI / 2;
      f.position.z = -thick * (1.5 + i * 0.2);
      tip.add(f);
      return f;
    });
  }
  return (state, t01, time) => {
    const amp = state === 'death' ? 0.02 : state === 'attack' ? 0.5 : state === 'walk' ? 0.35 : 0.2;
    const sp = kind === 'escorpiao' ? 3 : state === 'walk' ? 7 : 3;
    segs.forEach((s, i) => {
      if (i === 0) return;
      s.rotation.y = Math.sin(time * sp - i * 0.6) * amp;
      if (kind === 'escorpiao') s.rotation.x = -0.42 - (state === 'attack' ? once01(t01) * 0.25 : 0);
    });
    flames.forEach((f, i) => { const k = 1 + Math.sin(time * (13 + i * 5)) * 0.18; f.scale.set(1 / k, k, 1 / k); });
  };
}

let dotTex: THREE.CanvasTexture | null = null;
/** Ponto redondo e macio (sem isso as partículas viram quadradinhos). */
function softDot() {
  if (dotTex) return dotTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  dotTex = new THREE.CanvasTexture(c);
  return dotTex;
}

/** Partículas em volta da criatura: brasas, névoa, faíscas ou bolhas. */
function aura(kit: Kit, root: THREE.Object3D, h: number, w: number): Anim | null {
  const kind = kit.rec.aura;
  if (kind === 'nenhuma') return null;
  const N = kind === 'nevoa' ? 26 : 46;
  const pos = new Float32Array(N * 3);
  const speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * w * 1.6;
    pos[i * 3 + 1] = Math.random() * h;
    pos[i * 3 + 2] = (Math.random() - 0.5) * w * 1.8;
    speed[i] = 0.3 + Math.random() * 0.6;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const look = { brasas: ['#ff6a2a', 0.07, THREE.AdditiveBlending], nevoa: ['#cbd5e1', 0.5, THREE.NormalBlending], raios: ['#7dd3fc', 0.06, THREE.AdditiveBlending], bolhas: ['#bae6fd', 0.08, THREE.NormalBlending] } as const;
  const [color, size, blending] = look[kind];
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size, map: softDot(), transparent: true, opacity: kind === 'nevoa' ? 0.22 : 0.85, blending, depthWrite: false }));
  root.add(pts);
  return (_s, _t, time) => {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < N; i++) {
      if (kind === 'nevoa') {
        p.setX(i, p.getX(i) + Math.sin(time * 0.5 + i) * 0.003);
        p.setY(i, 0.15 + Math.abs(Math.sin(time * 0.3 + i)) * 0.35);
      } else if (kind === 'raios') {
        p.setY(i, (Math.sin(time * 9 * speed[i] + i * 7) * 0.5 + 0.5) * h);
      } else {
        let y = p.getY(i) + speed[i] * 0.016 * (kind === 'bolhas' ? 0.6 : 1);
        if (y > h * 1.2) y = 0.2;
        p.setY(i, y);
      }
    }
    p.needsUpdate = true;
    (pts.material as THREE.PointsMaterial).opacity = kind === 'raios' ? 0.5 + Math.random() * 0.5 : (pts.material as THREE.PointsMaterial).opacity;
  };
}

/** Placas de armadura de bronze (costas e peito). */
function armorPlates(len: number, width: number) {
  const m = surfaceMat('bronze', '#b8862e');
  const g = new THREE.Group();
  const n = Math.max(2, Math.round(len / 0.35));
  for (let i = 0; i < n; i++) {
    const p = plain(new RoundedBoxGeometry(width, 0.07, len / n * 0.92, 2, 0.03), m);
    p.position.z = (i / (n - 1) - 0.5) * len * 0.9;
    p.rotation.x = 0.06;
    g.add(p);
  }
  return g;
}

// ───────────────────────────── Bases ─────────────────────────────

interface Built { body: THREE.Group; height: number; radius: number }
type Extras = { goatHead?: boolean };

function quadruped(kit: Kit, extras: Extras): Built {
  const rec = kit.rec;
  const body = new THREE.Group();
  const torso = skinned(kit, capsuleZ(0.42, 0.95));
  torso.scale.y = 0.95;
  torso.position.y = 1.0;
  const chest = skinned(kit, new THREE.SphereGeometry(0.5, 20, 14));
  chest.scale.set(0.95, 1.05, 1);
  chest.position.set(0, 1.05, 0.55);
  const haunch = skinned(kit, new THREE.SphereGeometry(0.45, 20, 14));
  haunch.position.set(0, 1.02, -0.6);
  body.add(torso, chest, haunch);
  // Pernas: coxa, canela e pata com garras
  const legs: { hip: THREE.Group; knee: THREE.Group; phase: number }[] = [];
  for (const [x, z, phase] of [[-0.3, 0.62, 0], [0.3, 0.62, Math.PI], [-0.3, -0.62, Math.PI], [0.3, -0.62, 0]] as const) {
    const hip = new THREE.Group();
    hip.position.set(x, 1.0, z);
    const thigh = skinned(kit, new THREE.CapsuleGeometry(z > 0 ? 0.15 : 0.18, 0.35, 4, 10));
    thigh.position.y = -0.25;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.52;
    const shin = skinned(kit, new THREE.CapsuleGeometry(0.095, 0.3, 4, 10));
    shin.position.y = -0.2;
    const paw = skinned(kit, new THREE.SphereGeometry(0.15, 14, 10));
    paw.scale.set(1.05, 0.55, 1.3);
    paw.position.set(0, -0.42, 0.06);
    const cl = claws(kit, 3, 0.16, 0.09);
    cl.position.set(0, -0.44, 0.22);
    knee.add(shin, paw, cl);
    hip.add(knee);
    body.add(hip);
    legs.push({ hip, knee, phase });
  }
  // Pescoço(s) e cabeça(s)
  const style = rec.surface === 'escamas' || rec.surface === 'lodo' ? 'reptil' : 'cao';
  const nHeads = Math.min(3, rec.heads);
  const necks: { neck: THREE.Group; jaw: THREE.Group }[] = [];
  for (let i = 0; i < nHeads; i++) {
    const off = nHeads === 1 ? 0 : (i - (nHeads - 1) / 2) * 0.42;
    const neck = new THREE.Group();
    neck.position.set(off, 1.25, 0.85 - Math.abs(off) * 0.25);
    neck.rotation.y = off * 0.9;
    neck.rotation.z = -off * 0.5;
    const nm = skinned(kit, new THREE.CapsuleGeometry(0.22, 0.32, 4, 12));
    nm.rotation.x = 0.85;
    nm.position.set(0, 0.12, 0.12);
    neck.add(nm);
    const h = creatureHead(kit, 0.3, style);
    h.head.position.set(0, 0.36, 0.38);
    neck.add(h.head);
    body.add(neck);
    necks.push({ neck, jaw: h.jaw });
  }
  // Juba: tufos de pelo numa "bola" em volta do pescoço, penteados para trás
  if (rec.mane) {
    const maneMat = surfaceMat('pelo', rec.accent, { repeat: 1.2 });
    const center = V(0, 1.42, 0.78);
    for (let i = 0; i < 110; i++) {
      // pontos espalhados numa esfera (espiral de Fibonacci), sem a parte da frente (rosto)
      const y = 1 - (i / 109) * 2;
      const rr = Math.sqrt(1 - y * y);
      const th = i * 2.399963;
      const d = V(Math.cos(th) * rr, y, Math.sin(th) * rr);
      if (d.z > 0.55) continue;
      const tuft = plain(new THREE.SphereGeometry(0.13, 10, 8), maneMat);
      tuft.scale.set(1, 1.9, 0.7);
      tuft.position.copy(center).addScaledVector(d, 0.34);
      const dir = d.clone().add(V(0, 0.15, -0.55)).normalize();
      tuft.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
      body.add(tuft);
    }
  }
  // Cabeça de bode nas costas (Quimera)
  if (extras.goatHead) {
    const gk = { ...kit, rec: { ...rec, horns: 'bode' as const, color: '#8a7a63', belly: '#c8b89a' } };
    gk.skin = surfaceMat('pelo', '#8a7a63', { vertexColors: true });
    const g = creatureHead(gk, 0.2, 'cao');
    g.head.position.set(0, 1.65, -0.15);
    g.head.rotation.x = -0.2;
    const gn = skinned(gk, new THREE.CapsuleGeometry(0.11, 0.3, 4, 8));
    gn.position.set(0, 1.45, -0.2);
    body.add(g.head, gn);
  }
  if (rec.spikes) body.add(spineSpikes(kit, (z) => 1.38 - Math.abs(z) * 0.08, 0.6, -0.85, 9, 0.22));
  if (rec.armor) { const a = armorPlates(1.4, 0.75); a.position.set(0, 1.42, -0.05); body.add(a); }
  const w = wingPair(kit, 1.05);
  if (w) { w.group.position.set(0, 1.4, 0.35); body.add(w.group); kit.anims.push(w.anim); }
  const tailAnim = buildTail(kit, body, V(0, 1.12, -0.95), 0.09, 1.3);
  if (tailAnim) kit.anims.push(tailAnim);

  kit.anims.push((state, t01) => {
    const cyc = t01 * TAU;
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    necks.forEach((n) => { n.neck.rotation.x = 0; n.jaw.rotation.x = 0.05; });
    legs.forEach((l) => { l.hip.rotation.x = 0; l.knee.rotation.x = 0; });
    if (state === 'walk') {
      legs.forEach((l) => { l.hip.rotation.x = Math.sin(cyc + l.phase) * 0.55; l.knee.rotation.x = Math.max(0, -Math.sin(cyc + l.phase)) * 0.75; });
      body.position.y = Math.abs(Math.sin(cyc * 2)) * 0.06;
      necks.forEach((n) => { n.neck.rotation.x = Math.sin(cyc * 2) * 0.06; });
    }
    if (state === 'idle') {
      body.position.y = Math.sin(cyc) * 0.025;
      necks.forEach((n, i) => { n.neck.rotation.x = Math.sin(cyc + i) * 0.08; n.jaw.rotation.x = 0.05 + Math.max(0, Math.sin(cyc * 2 + i)) * 0.18; });
    }
    if (state === 'attack') {
      const k = once01(t01);
      body.position.z = k * 0.5;
      body.rotation.x = -k * 0.12;
      necks.forEach((n, i) => { n.neck.rotation.x = k * 0.5 - (i % 2) * 0.1; n.jaw.rotation.x = 0.05 + k * 0.7; });
      legs.forEach((l, i) => { l.hip.rotation.x = (i < 2 ? -1 : 1) * k * 0.35; });
    }
    if (state === 'hit') {
      const k = Math.sin(t01 * Math.PI);
      body.position.z = -k * 0.3;
      body.rotation.z = Math.sin(t01 * TAU * 3) * 0.08 * (1 - t01);
      necks.forEach((n) => { n.neck.rotation.x = -k * 0.5; n.jaw.rotation.x = 0.4 * k; });
    }
    if (state === 'death') {
      const k = ease(Math.min(1, t01 * 1.4));
      body.rotation.z = k * (Math.PI / 2);
      body.position.set(k * 0.9, k * 0.1, 0);
      legs.forEach((l) => { l.hip.rotation.x = k * 0.3; });
      necks.forEach((n) => { n.neck.rotation.x = k * 0.6; n.jaw.rotation.x = 0.45 * k; });
    }
  });
  return { body, height: 2.0, radius: 1.1 };
}

/** Corpo feito de esferas encadeadas ao longo de uma curva animada (serpente, pescoços). */
function sphereChain(kit: Kit, n: number, r0: number, r1: number) {
  const parts: THREE.Mesh[] = [];
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const m = skinned(kit, new THREE.SphereGeometry(1, 16, 12));
    const r = r0 + (r1 - r0) * t;
    m.scale.setScalar(r);
    m.userData.r = r;
    g.add(m);
    parts.push(m);
  }
  return { group: g, parts };
}

function serpent(kit: Kit): Built {
  const rec = kit.rec;
  const body = new THREE.Group();
  const N = 36;
  const chain = sphereChain(kit, N, 0.1, 0.27);
  body.add(chain.group);
  const nHeads = Math.min(2, rec.heads);
  const heads = Array.from({ length: nHeads }, (_, i) => {
    const h = creatureHead(kit, 0.3, 'reptil');
    body.add(h.head);
    // pescoço extra (2 cabeças): mais umas esferas
    const neck = nHeads > 1 ? sphereChain(kit, 10, 0.24, 0.2) : null;
    if (neck) body.add(neck.group);
    return { ...h, neck, side: nHeads > 1 ? (i ? 1 : -1) : 0 };
  });
  // capelo de naja quando tem coroa
  let hood: THREE.Mesh | null = null;
  if (rec.horns === 'coroa' && nHeads === 1) {
    hood = skinned(kit, new THREE.SphereGeometry(0.42, 16, 10, 0, TAU, 0, Math.PI * 0.6));
    hood.scale.set(1.25, 1.1, 0.25);
    body.add(hood);
  }
  const spikes = rec.spikes ? chain.parts.filter((_, i) => i % 3 === 0 && i > 4 && i < N - 3).map(() => { const c = plain(new THREE.ConeGeometry(0.05, 0.2, 5), kit.accent); body.add(c); return c; }) : [];
  const w = wingPair(kit, 0.9);
  if (w) body.add(w.group), kit.anims.push(w.anim);
  const P = new THREE.Vector3();
  kit.anims.push((state, t01, time) => {
    const cyc = t01 * TAU;
    const und = state === 'walk' ? cyc * 2 : time * 1.2;
    const amp = state === 'walk' ? 0.38 : 0.18;
    const rise = state === 'death' ? 1 - ease(Math.min(1, t01 * 1.3)) : 1;
    const lunge = state === 'attack' ? once01(t01, 0.45) : state === 'hit' ? -Math.sin(t01 * Math.PI) * 0.6 : 0;
    // 60% do corpo no chão em S, o resto ergue até a cabeça
    chain.parts.forEach((m, i) => {
      const u = i / (N - 1);
      const r = m.userData.r as number;
      if (u < 0.62) {
        P.set(Math.sin(u * 9 - und) * amp * (0.4 + u), r * 0.9, -1.5 + u * 2.3);
      } else {
        const t = (u - 0.62) / 0.38;
        P.set(Math.sin(0.62 * 9 - und) * amp * (1 - t), r * 0.9 + t * 1.05 * rise, -0.07 + t * (0.45 + lunge * 0.55));
      }
      m.position.copy(P);
    });
    const top = chain.parts[N - 1].position;
    heads.forEach((h, i) => {
      if (h.neck) {
        h.neck.parts.forEach((m, j) => { const t = (j + 1) / h.neck!.parts.length; m.position.set(top.x + h.side * t * 0.35, top.y + t * 0.25, top.z + t * 0.12); });
      }
      const base = h.neck ? h.neck.parts[h.neck.parts.length - 1].position : top;
      h.head.position.set(base.x + (h.neck ? 0 : 0), base.y + 0.16, base.z + 0.12);
      h.head.rotation.set(0.35 * rise + lunge * 0.4, h.side * 0.3 + Math.sin(time * 1.3 + i) * 0.12, 0);
      h.jaw.rotation.x = 0.05 + (state === 'attack' ? once01(t01, 0.45) * 0.8 : Math.max(0, Math.sin(time * 2 + i)) * 0.08);
    });
    if (hood) { hood.position.set(top.x, top.y - 0.05, top.z - 0.08); hood.rotation.x = -0.25; }
    spikes.forEach((s, k) => { const m = chain.parts[6 + k * 3]; s.position.set(m.position.x, m.position.y + (m.userData.r as number) * 0.95, m.position.z); s.rotation.x = -0.4; });
    if (w) w.group.position.set(top.x, top.y - 0.3, top.z - 0.25);
  });
  return { body, height: 1.7, radius: 1.3 };
}

function hydra(kit: Kit): Built {
  const rec = kit.rec;
  const body = new THREE.Group();
  const torso = skinned(kit, new THREE.SphereGeometry(0.85, 22, 16));
  torso.scale.set(1.1, 0.78, 1.3);
  torso.position.y = 0.8;
  body.add(torso);
  for (const [x, z] of [[-0.62, 0.5], [0.62, 0.5], [-0.62, -0.55], [0.62, -0.55]]) {
    const leg = skinned(kit, new THREE.CapsuleGeometry(0.18, 0.35, 4, 10));
    leg.position.set(x, 0.32, z);
    const foot = skinned(kit, new THREE.SphereGeometry(0.2, 12, 8));
    foot.scale.set(1, 0.5, 1.3);
    foot.position.set(x, 0.06, z + 0.06);
    const cl = claws(kit, 3, 0.2, 0.1);
    cl.position.set(x, 0.06, z + 0.26);
    body.add(leg, foot, cl);
  }
  if (rec.spikes) body.add(spineSpikes(kit, (z) => 1.38 - z * z * 0.3, 0.6, -1.0, 8, 0.28));
  const n = Math.max(2, rec.heads);
  const necks = Array.from({ length: n }, (_, i) => {
    const chain = sphereChain(kit, 16, 0.17, 0.11);
    body.add(chain.group);
    const h = creatureHead(kit, 0.22, 'reptil');
    body.add(h.head);
    const a = ((i - (n - 1) / 2) / Math.max(1, n - 1)) * 1.9;
    return { chain, ...h, a, phase: i * 1.3 };
  });
  const tailAnim = buildTail(kit, body, V(0, 0.85, -1.05), 0.16, 1.4);
  if (tailAnim) kit.anims.push(tailAnim);
  const w = wingPair(kit, 1.3);
  if (w) { w.group.position.set(0, 1.35, -0.1); body.add(w.group); kit.anims.push(w.anim); }
  const P = new THREE.Vector3();
  kit.anims.push((state, t01, time) => {
    const cyc = t01 * TAU;
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    if (state === 'walk') body.position.y = Math.abs(Math.sin(cyc * 2)) * 0.05;
    const fall = state === 'death' ? ease(Math.min(1, t01 * 1.3)) : 0;
    necks.forEach((nk, i) => {
      let sway = Math.sin(time * 1.6 + nk.phase) * 0.12;
      let lunge = 0;
      if (state === 'walk') sway = Math.sin(cyc + nk.phase) * 0.2;
      if (state === 'attack') lunge = once01(t01, 0.45) * (i % 2 ? 0.45 : 0.85);
      if (state === 'hit') lunge = -Math.sin(t01 * Math.PI) * 0.5;
      const bx = Math.sin(nk.a) * 0.55, bz = Math.cos(nk.a) * 0.45 + 0.3;
      nk.chain.parts.forEach((m, j) => {
        const t = j / (nk.chain.parts.length - 1);
        const height = (1 - fall * 0.8) * t * 1.4;
        P.set(bx + Math.sin(nk.a) * t * 0.5 + Math.sin(t * 3 + time * 1.6 + nk.phase) * sway * t, 1.05 + height, bz + t * (0.25 + lunge * 0.6) - fall * t * 0.3);
        m.position.copy(P);
      });
      const top = nk.chain.parts[nk.chain.parts.length - 1].position;
      nk.head.position.set(top.x, top.y + 0.1, top.z + 0.1);
      nk.head.rotation.set(0.25 + lunge * 0.5 + fall * 0.5, nk.a * 0.35 + sway, 0);
      nk.jaw.rotation.x = 0.05 + (state === 'attack' ? lunge * 0.8 : Math.max(0, Math.sin(time * 2 + nk.phase)) * 0.12);
    });
    if (state === 'death') { body.rotation.z = fall * 0.35; body.position.y = -fall * 0.3; }
  });
  return { body, height: 2.6, radius: 1.25 };
}

function arachnid(kit: Kit): Built {
  const rec = kit.rec;
  const body = new THREE.Group();
  const scorpion = rec.tail === 'escorpiao';
  const abdomen = skinned(kit, new THREE.SphereGeometry(0.45, 20, 14));
  abdomen.scale.set(1, scorpion ? 0.5 : 0.85, scorpion ? 1.4 : 1.25);
  abdomen.position.set(0, scorpion ? 0.42 : 0.62, -0.45);
  const thorax = skinned(kit, new THREE.SphereGeometry(0.3, 18, 12));
  thorax.scale.set(1, 0.75, 1.1);
  thorax.position.set(0, 0.5, 0.15);
  body.add(abdomen, thorax);
  // olhos: dois grandes e um aglomerado de pequenos
  const eyes: THREE.Group[] = [];
  for (const [x, y, z, r] of [[-0.09, 0.62, 0.42, 0.06], [0.09, 0.62, 0.42, 0.06], [-0.17, 0.66, 0.36, 0.035], [0.17, 0.66, 0.36, 0.035], [-0.05, 0.7, 0.38, 0.03], [0.05, 0.7, 0.38, 0.03], [-0.2, 0.6, 0.32, 0.03], [0.2, 0.6, 0.32, 0.03]]) {
    const e = makeEye(r, rec.eyes, { glow: true });
    e.position.set(x, y, z);
    e.rotation.y = x * 2;
    body.add(e);
    eyes.push(e);
  }
  // quelíceras (presas)
  const fangs: THREE.Mesh[] = [];
  for (const s of [-1, 1]) {
    const f = plain(taperedTube([V(s * 0.07, 0.42, 0.42), V(s * 0.09, 0.3, 0.5), V(s * 0.04, 0.2, 0.46)], 0.035, 0.005, 6, 5), kit.horn);
    body.add(f);
    fangs.push(f);
  }
  // pinças (escorpião)
  const pincers: THREE.Group[] = [];
  if (scorpion) {
    for (const s of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(s * 0.22, 0.5, 0.35);
      const upperArm = skinned(kit, new THREE.CapsuleGeometry(0.06, 0.35, 4, 8));
      upperArm.rotation.set(1.2, 0, -s * 0.6);
      arm.add(upperArm);
      const claw = skinned(kit, new THREE.SphereGeometry(0.14, 12, 8));
      claw.scale.set(0.8, 0.6, 1.4);
      claw.position.set(s * 0.25, -0.02, 0.38);
      const tip = plain(new THREE.ConeGeometry(0.05, 0.22, 6), kit.horn);
      tip.rotation.x = Math.PI / 2;
      tip.position.set(s * 0.25, -0.02, 0.6);
      arm.add(claw, tip);
      body.add(arm);
      pincers.push(arm);
    }
  }
  if (rec.armor || rec.surface === 'bronze') {
    const gear = plain(new THREE.TorusGeometry(0.2, 0.05, 6, 14), surfaceMat('bronze', '#d4a020'));
    gear.position.set(0, scorpion ? 0.68 : 1.0, -0.45);
    gear.rotation.x = Math.PI / 2;
    body.add(gear);
    kit.anims.push((_s, _t, time) => { gear.rotation.z = time * 3; });
  }
  if (rec.spikes) for (let i = 0; i < 6; i++) { const c = plain(new THREE.ConeGeometry(0.04, 0.18, 5), kit.accent); c.position.set((i % 2 ? 1 : -1) * 0.18, scorpion ? 0.62 : 0.98, -0.25 - Math.floor(i / 2) * 0.22); body.add(c); }
  // patas articuladas (coxa, fêmur, tíbia)
  const n = rec.legs === 6 ? 6 : 8;
  const legs: { hip: THREE.Group; knee: THREE.Group; phase: number }[] = [];
  for (let i = 0; i < n; i++) {
    const side = i < n / 2 ? -1 : 1;
    const k = i % (n / 2);
    const hip = new THREE.Group();
    hip.position.set(side * 0.22, 0.5, 0.28 - k * (0.6 / (n / 2 - 1)));
    hip.rotation.y = side < 0 ? Math.PI - (0.5 - k * 0.33) : 0.5 - k * 0.33;
    const femur = plain(taperedTube([V(0, 0, 0), V(0.3, 0.22, 0), V(0.55, 0.25, 0)], 0.05, 0.035, 6, 6), kit.accent);
    hip.add(femur);
    const knee = new THREE.Group();
    knee.position.set(0.55, 0.25, 0);
    const joint = skinned(kit, new THREE.SphereGeometry(0.045, 8, 6));
    const tibia = plain(taperedTube([V(0, 0, 0), V(0.22, -0.3, 0), V(0.3, -0.75, 0)], 0.035, 0.008, 6, 5), kit.accent);
    knee.add(joint, tibia);
    hip.add(knee);
    body.add(hip);
    legs.push({ hip, knee, phase: (k % 2 ? Math.PI : 0) + (side > 0 ? Math.PI : 0) });
  }
  const tailAnim = scorpion ? buildTail(kit, body, V(0, 0.48, -1.05), 0.09, 1.3) : null;
  if (tailAnim) kit.anims.push(tailAnim);
  const w = wingPair(kit, 0.7);
  if (w) { w.group.position.set(0, 0.8, 0.05); body.add(w.group); kit.anims.push(w.anim); }
  kit.anims.push((state, t01) => {
    const cyc = t01 * TAU;
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    legs.forEach((l) => {
      const lift = state === 'walk' ? Math.max(0, Math.sin(cyc * 2 + l.phase)) : 0;
      l.hip.rotation.z = lift * 0.35;
      l.hip.rotation.x = state === 'walk' ? Math.sin(cyc * 2 + l.phase) * 0.3 : 0;
      l.knee.rotation.z = -lift * 0.3;
    });
    fangs.forEach((f, i) => { f.rotation.y = (i ? -1 : 1) * (state === 'attack' ? once01(t01) * 0.4 : 0); });
    pincers.forEach((p, i) => { p.rotation.x = state === 'attack' ? -once01(t01) * 0.6 : Math.sin(cyc + i) * 0.08; });
    if (state === 'idle') body.position.y = Math.sin(cyc) * 0.02;
    if (state === 'attack') { const k = once01(t01); body.position.z = k * 0.35; body.rotation.x = -k * 0.3; }
    if (state === 'hit') body.position.z = -Math.sin(t01 * Math.PI) * 0.2;
    if (state === 'death') { const k = ease(Math.min(1, t01 * 1.4)); body.rotation.z = k * Math.PI; body.position.y = k * 0.55; legs.forEach((l) => { l.hip.rotation.z = k * 0.9; }); }
  });
  return { body, height: scorpion ? 1.3 : 1.2, radius: 1.0 };
}

function bird(kit: Kit): Built {
  const rec = kit.rec;
  const body = new THREE.Group();
  const torso = skinned(kit, new THREE.SphereGeometry(0.55, 22, 16));
  torso.scale.set(0.95, 1.0, 1.35);
  torso.position.set(0, 1.15, 0);
  torso.rotation.x = -0.35;
  body.add(torso);
  const neck = new THREE.Group();
  neck.position.set(0, 1.45, 0.45);
  const nm = skinned(kit, new THREE.CapsuleGeometry(0.16, 0.35, 4, 10));
  nm.rotation.x = 0.3;
  nm.position.y = 0.15;
  neck.add(nm);
  const head = new THREE.Group();
  head.position.set(0, 0.45, 0.08);
  const skull = skinned(kit, new THREE.SphereGeometry(0.24, 18, 12));
  skull.scale.set(0.95, 1, 1.15);
  head.add(skull);
  const beakMat = surfaceMat(rec.surface === 'bronze' ? 'bronze' : 'osso', rec.surface === 'bronze' ? '#d4a020' : '#e0b040');
  const beak = plain(taperedTube([V(0, 0.02, 0.18), V(0, 0.0, 0.42), V(0, -0.12, 0.55)], 0.1, 0.01, 8, 8), beakMat);
  const lowerBeak = plain(taperedTube([V(0, -0.06, 0.18), V(0, -0.08, 0.38)], 0.06, 0.01, 6, 6), beakMat);
  head.add(beak, lowerBeak);
  for (const s of [-1, 1]) {
    const e = makeEye(0.055, rec.eyes, { glow: rec.glow });
    e.position.set(s * 0.15, 0.06, 0.13);
    e.rotation.y = s * 0.9;
    head.add(e);
  }
  if (rec.horns !== 'nenhum') {
    // crista de penas
    const crestMat = surfaceMat('penas', rec.accent, { side: THREE.DoubleSide, repeat: 1 });
    for (let i = 0; i < 5; i++) { const f = plain(featherGeo(0.35, 0.08), crestMat); f.position.set(0, 0.18, -0.05 - i * 0.03); f.rotation.set(0, Math.PI / 2, 1.2 + i * 0.12); head.add(f); }
  }
  neck.add(head);
  body.add(neck);
  // pernas compridas com garras
  const legs: { hip: THREE.Group; knee: THREE.Group; phase: number }[] = [];
  for (const [s, phase] of [[-1, 0], [1, Math.PI]] as const) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.22, 0.85, 0);
    const thigh = skinned(kit, new THREE.CapsuleGeometry(0.11, 0.25, 4, 8));
    thigh.position.y = -0.18;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.4;
    const shin = plain(new THREE.CylinderGeometry(0.035, 0.03, 0.42, 6), beakMat);
    shin.position.y = -0.2;
    const cl = claws(kit, 3, 0.18, 0.11);
    cl.position.set(0, -0.42, 0.02);
    const back = claws(kit, 1, 0, 0.08);
    back.position.set(0, -0.42, -0.02);
    back.rotation.y = Math.PI;
    knee.add(shin, cl, back);
    hip.add(knee);
    body.add(hip);
    legs.push({ hip, knee, phase });
  }
  // leque da cauda
  const tailMat = surfaceMat('penas', rec.accent, { side: THREE.DoubleSide, repeat: 1 });
  const tail = new THREE.Group();
  tail.position.set(0, 1.05, -0.65);
  for (let i = 0; i < 7; i++) { const f = plain(featherGeo(0.75, 0.16), tailMat); f.rotation.set(Math.PI / 2 - 0.35, 0, -Math.PI / 2 + (i - 3) * 0.16); tail.add(f); }
  body.add(tail);
  if (rec.armor) { const a = armorPlates(0.8, 0.6); a.position.set(0, 1.6, -0.05); body.add(a); }
  const w = wingPair(kit, 1.2);
  if (w) { w.group.position.set(0, 1.38, 0.15); body.add(w.group); kit.anims.push(w.anim); }
  kit.anims.push((state, t01, time) => {
    const cyc = t01 * TAU;
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    neck.rotation.x = 0;
    legs.forEach((l) => { l.hip.rotation.x = 0; l.knee.rotation.x = 0; });
    tail.rotation.y = Math.sin(time * 2) * 0.08;
    if (state === 'idle') { neck.rotation.x = Math.sin(cyc * 2) * 0.1; head.rotation.y = Math.sin(cyc) * 0.4; }
    if (state === 'walk') {
      legs.forEach((l) => { l.hip.rotation.x = Math.sin(cyc + l.phase) * 0.6; l.knee.rotation.x = Math.max(0, -Math.sin(cyc + l.phase)) * 0.9; });
      neck.rotation.x = Math.sin(cyc * 2) * 0.2; // cabeça indo e vindo, como galinha
      body.position.y = Math.abs(Math.sin(cyc)) * 0.05;
    }
    if (state === 'attack') { const k = once01(t01); neck.rotation.x = k * 0.9; body.position.z = k * 0.35; body.rotation.x = k * 0.25; }
    if (state === 'hit') { const k = Math.sin(t01 * Math.PI); body.position.z = -k * 0.3; neck.rotation.x = -k * 0.4; }
    if (state === 'death') { const k = ease(Math.min(1, t01 * 1.4)); body.rotation.z = k * (Math.PI / 2); body.position.set(k * 0.7, -k * 0.2, 0); }
  });
  return { body, height: 2.2, radius: 1.0 };
}

function marine(kit: Kit): Built {
  const rec = kit.rec;
  const body = new THREE.Group();
  // perfil de foca girado (torno): base larga no chão, peito erguido
  const prof = [[0.01, 0], [0.32, 0.05], [0.45, 0.25], [0.47, 0.55], [0.42, 0.85], [0.33, 1.1], [0.24, 1.3], [0.01, 1.38]].map(([x, y]) => new THREE.Vector2(x, y));
  const lathe = new THREE.LatheGeometry(prof, 22);
  lathe.rotateX(1.05); // de pé e inclinada para a frente: cauda atrás, peito e cabeça na frente
  const torso = skinned(kit, lathe, V(0, 1, 0.4).normalize());
  torso.position.set(0, 0.32, -0.55);
  body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 1.25, 0.42);
  const h = creatureHead(kit, 0.24, 'cao');
  head.add(h.head);
  // bigodes
  const whisk = new THREE.LineBasicMaterial({ color: '#e5e7eb' });
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    const g = new THREE.BufferGeometry().setFromPoints([V(s * 0.1, -0.07 - k * 0.025, 0.42), V(s * 0.38, -0.02 - k * 0.06, 0.38)]);
    head.add(new THREE.Line(g, whisk));
  }
  body.add(head);
  const flippers: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const f = new THREE.Group();
    f.position.set(s * 0.4, 0.85, 0.15);
    const fl = plain(new THREE.SphereGeometry(0.28, 14, 8), kit.accent);
    fl.scale.set(1.3, 0.18, 0.6);
    fl.position.set(s * 0.22, -0.12, 0.05);
    fl.rotation.z = s * -0.6; // nadadeiras caídas ao lado do corpo
    f.add(fl);
    body.add(f);
    flippers.push(f);
  }
  const fluke = plain(new THREE.SphereGeometry(0.3, 14, 8), kit.accent);
  fluke.scale.set(1.5, 0.15, 0.55);
  fluke.position.set(0, 0.12, -1.0);
  body.add(fluke);
  if (rec.spikes) { const fin = plain(new THREE.ConeGeometry(0.16, 0.45, 8), kit.accent); fin.scale.z = 0.3; fin.position.set(0, 1.0, -0.35); fin.rotation.x = -0.6; body.add(fin); }
  const mw = wingPair(kit, 0.8);
  if (mw) { mw.group.position.set(0, 1.0, -0.2); body.add(mw.group); kit.anims.push(mw.anim); }
  kit.anims.push((state, t01, time) => {
    const cyc = t01 * TAU;
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    h.jaw.rotation.x = 0.05;
    flippers.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * Math.sin(time * 2) * 0.15; });
    if (state === 'idle') { body.position.y = Math.sin(cyc) * 0.03; head.rotation.y = Math.sin(cyc) * 0.25; }
    if (state === 'walk') { body.position.y = Math.abs(Math.sin(cyc * 2)) * 0.12; body.rotation.x = Math.sin(cyc * 2) * 0.08; flippers.forEach((f, i) => { f.rotation.x = Math.sin(cyc * 2 + i * Math.PI) * 0.5; }); }
    if (state === 'attack') { const k = once01(t01); body.position.z = k * 0.4; head.rotation.x = k * 0.45; h.jaw.rotation.x = 0.05 + k * 0.7; flippers.forEach((f, i) => { f.rotation.z = (i ? 1 : -1) * k * 1.1; }); }
    if (state === 'hit') { body.position.z = -Math.sin(t01 * Math.PI) * 0.25; head.rotation.x = -Math.sin(t01 * Math.PI) * 0.4; }
    if (state === 'death') { const k = ease(Math.min(1, t01 * 1.4)); body.rotation.x = -k * 1.2; body.position.set(0, -k * 0.2, -k * 0.5); }
  });
  return { body, height: 1.7, radius: 0.85 };
}

function golem(kit: Kit): Built {
  const rec = kit.rec;
  const body = new THREE.Group();
  const block = (w: number, h: number, d: number) => skinned(kit, new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.18));
  const glowMat = new THREE.MeshBasicMaterial({ color: rec.eyes });
  const hips = block(0.75, 0.35, 0.45);
  hips.position.y = 1.0;
  const chest = block(1.05, 0.75, 0.62);
  chest.position.y = 1.55;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), glowMat);
  core.position.set(0, 1.6, 0.32);
  body.add(hips, chest, core);
  const headG = new THREE.Group();
  headG.position.set(0, 2.08, 0.02);
  const skull = block(0.42, 0.4, 0.42);
  headG.add(skull);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.02), glowMat);
    e.position.set(s * 0.1, 0.03, 0.215);
    headG.add(e);
  }
  headG.add(horns(kit, 0.22));
  body.add(headG);
  // rachaduras brilhantes (linhas no peito)
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18 + i * 0.03, 0.01), glowMat);
    c.position.set(-0.3 + i * 0.2, 1.4 + (i % 2) * 0.15, 0.315);
    c.rotation.z = (i % 2 ? 1 : -1) * 0.5;
    body.add(c);
  }
  const limbs: { pivot: THREE.Group; lower: THREE.Group; arm: boolean; side: number }[] = [];
  for (const side of [-1, 1]) {
    // braço
    const sh = new THREE.Group();
    sh.position.set(side * 0.68, 1.75, 0);
    const up = block(0.3, 0.5, 0.3); up.position.y = -0.22; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.5;
    const lo = block(0.28, 0.45, 0.28); lo.position.y = -0.2;
    const fist = block(0.36, 0.3, 0.36); fist.position.y = -0.52;
    el.add(lo, fist); sh.add(el);
    if (rec.armor) {
      // ombreira em cúpula de bronze
      const pad = plain(new THREE.SphereGeometry(0.26, 16, 10, 0, TAU, 0, Math.PI / 2), surfaceMat('bronze', '#b8862e', { side: THREE.DoubleSide }));
      pad.scale.set(1, 0.75, 1);
      pad.position.y = 0.02;
      sh.add(pad);
    }
    if (rec.spikes) for (let k = 0; k < 3; k++) { const sp = plain(new THREE.ConeGeometry(0.05, 0.24, 6), kit.horn); sp.position.set(side * 0.05, 0.15, -0.1 + k * 0.1); sp.rotation.z = -side * 0.4; sh.add(sp); }
    body.add(sh);
    limbs.push({ pivot: sh, lower: el, arm: true, side });
    // perna
    const hp = new THREE.Group();
    hp.position.set(side * 0.24, 0.92, 0);
    const th = block(0.32, 0.45, 0.34); th.position.y = -0.2; hp.add(th);
    const kn = new THREE.Group(); kn.position.y = -0.45;
    const sn = block(0.3, 0.38, 0.32); sn.position.y = -0.17;
    const ft = block(0.36, 0.14, 0.48); ft.position.set(0, -0.4, 0.06);
    kn.add(sn, ft); hp.add(kn);
    body.add(hp);
    limbs.push({ pivot: hp, lower: kn, arm: false, side });
  }
  const gw = wingPair(kit, 1.2);
  if (gw) { gw.group.position.set(0, 1.75, -0.32); body.add(gw.group); kit.anims.push(gw.anim); }
  kit.anims.push((state, t01, time) => {
    const cyc = t01 * TAU;
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    headG.rotation.set(0, 0, 0);
    core.rotation.y = time * 2;
    (glowMat as THREE.MeshBasicMaterial).color.set(rec.eyes).multiplyScalar(0.85 + Math.sin(time * 4) * 0.15);
    for (const l of limbs) { l.pivot.rotation.set(0, 0, l.arm ? l.side * 0.08 : 0); l.lower.rotation.x = 0; }
    if (state === 'idle') { body.position.y = Math.sin(cyc) * 0.02; headG.rotation.y = Math.sin(cyc) * 0.2; }
    if (state === 'walk') {
      for (const l of limbs) {
        const ph = (l.side > 0 ? Math.PI : 0) + (l.arm ? Math.PI : 0);
        l.pivot.rotation.x = Math.sin(cyc + ph) * (l.arm ? 0.4 : 0.45);
        if (!l.arm) l.lower.rotation.x = Math.max(0, -Math.sin(cyc + ph)) * 0.5;
      }
      body.position.y = Math.abs(Math.sin(cyc)) * 0.06;
      body.rotation.z = Math.sin(cyc) * 0.04;
    }
    if (state === 'attack') {
      const k = once01(t01, 0.45);
      const arm = limbs.find((l) => l.arm && l.side > 0)!;
      arm.pivot.rotation.x = -k * 1.8;
      arm.lower.rotation.x = -k * 0.4;
      body.rotation.y = -k * 0.3;
      body.position.z = k * 0.25;
    }
    if (state === 'hit') { const k = Math.sin(t01 * Math.PI); body.position.z = -k * 0.25; body.rotation.x = -k * 0.15; }
    if (state === 'death') {
      const k = ease(Math.min(1, t01 * 1.3));
      body.rotation.x = -k * (Math.PI / 2);
      body.position.set(0, k * 0.25, -k * 1.1);
      for (const l of limbs) if (l.arm) l.pivot.rotation.x = -k * 1.2;
    }
  });
  return { body, height: 2.5, radius: 0.95 };
}

// ───────────────────────────── Montagem ─────────────────────────────

/** Monta a criatura da receita como uma Figure (palco 3D ou sprites do mapa). */
export function buildRecipeCreature(rec: FigureRecipe, extras: Extras = {}): Figure {
  const kit = makeKit(rec);
  const root = new THREE.Group();
  const built = rec.base === 'serpente' ? serpent(kit)
    : rec.base === 'hidra' ? hydra(kit)
    : rec.base === 'aranha' ? arachnid(kit)
    : rec.base === 'ave' ? bird(kit)
    : rec.base === 'marinho' ? marine(kit)
    : rec.base === 'golem' ? golem(kit)
    : quadruped(kit, extras);
  root.add(built.body);
  const au = aura(kit, built.body, built.height, built.radius);
  if (au) kit.anims.push(au);
  // Piscar dos olhos (pálpebras), para parecer vivo
  const lids: THREE.Object3D[] = [];
  root.traverse((o) => { if (o.userData.lid) lids.push(o); });
  kit.anims.push((state, _t, time) => {
    const blink = state === 'death' ? 1 : (time % 3.7) < 0.12 ? 1 : 0;
    lids.forEach((l) => { l.rotation.x = blink ? 0.6 : -0.35; });
  });

  const scale = rec.size;
  root.scale.setScalar(scale);
  root.traverse((o) => { o.frustumCulled = false; });
  markOwn(root);

  const DUR: Record<BakeState, number> = { idle: 2.4, walk: 0.9, attack: 0.8, hit: 0.5, death: 1.2 };
  const ONCE = new Set<BakeState>(['attack', 'hit', 'death']);
  let state: BakeState = 'idle';
  let stateT = 0;
  let time = 0;
  const pose = (s: BakeState, t01: number, tm: number) => { for (const a of kit.anims) a(s, t01, tm); };
  pose('idle', 0, 0);
  return {
    root, height: built.height * scale, radius: built.radius * scale,
    play(action: HeroAction) {
      const map: Partial<Record<HeroAction, BakeState>> = { atacar: 'attack', ferido: 'hit', cair: 'death', andar: 'walk', correr: 'walk', parado: 'idle', magia: 'attack', defender: 'hit', esquivar: 'hit', pular: 'attack', comemorar: 'attack', reclamado: 'attack' };
      state = map[action] ?? 'idle';
      stateT = 0;
    },
    update(dt) {
      time += dt;
      stateT += dt;
      const d = DUR[state];
      if (ONCE.has(state) && stateT >= d && state !== 'death') { state = 'idle'; stateT = 0; }
      const t01 = ONCE.has(state) ? Math.min(1, stateT / d) : (stateT % d) / d;
      pose(state, t01, time);
    },
    sample(s, t01) {
      pose(s, t01, t01 * DUR[s] * 3);
    },
    dispose() {
      root.traverse((o) => {
        const x = o as THREE.Mesh;
        if (x.isMesh || (o as THREE.Points).isPoints || (o as THREE.Line).isLine) {
          x.geometry?.dispose();
          (Array.isArray(x.material) ? x.material : [x.material]).forEach((mm) => mm?.dispose());
        }
      });
    },
  };
}

export type { Surface3D };
