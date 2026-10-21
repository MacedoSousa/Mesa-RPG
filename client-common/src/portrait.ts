/**
 * Gerador de retratos (rostos únicos) para os heróis.
 * Uma PortraitSpec é um JSON pequeno salvo com o personagem; a semente sorteia os campos que o jogador
 * não escolheu. Peças SVG em camadas com cores parametrizadas (base/sombra/brilho) e traços de raça
 * (chifres de sátiro, cabelo de folhas de ninfa, olho único de ciclope, diadema de caçadora).
 * Arte 100% original e vetorial — funciona offline e fica nítida em qualquer tamanho.
 */
import { Texture } from 'pixi.js';

export const SKIN_TONES = ['#ffe0c7', '#f6cba5', '#e8b48a', '#d49a6a', '#b97d4f', '#9a6139', '#7a4a2a', '#5a3420', '#3e2416', '#c9a06a', '#8fae7a', '#9fb4c8'] as const;
export const HAIR_COLORS = ['#1d1410', '#3a2416', '#6b4423', '#a0652f', '#d4a056', '#f1d38a', '#e8e4dc', '#9a2a1a', '#d2691e', '#3b5b8f', '#4a8a4a', '#2a2a2a'] as const;
export const EYE_COLORS = ['#3b2414', '#6b4423', '#2f6b8f', '#3f7f4f', '#7a7a7a', '#d4a020', '#4a8fd0', '#8f3fd0'] as const;
export const BG_COLORS = ['#1e3a5f', '#4a2c5e', '#5e2c2c', '#2c5e3a', '#5e4a2c', '#2c4a5e', '#3a3a3a', '#6b4f8f'] as const;

export const FACE_SHAPES = ['oval', 'redondo', 'quadrado', 'longo', 'coracao'] as const;
export const HAIR_STYLES = ['curto', 'arrepiado', 'longo', 'rabo', 'coque', 'cacheado', 'trancas', 'raspado', 'franja', 'black_power'] as const;
export const EYE_SHAPES = ['normal', 'amendoado', 'redondo', 'sereno', 'determinado'] as const;
export const MOUTHS = ['sorriso', 'neutro', 'confiante', 'aberto', 'serio'] as const;
export const BEARDS = ['nenhuma', 'curta', 'cheia', 'cavanhaque', 'bigode'] as const;
export const SCARS = ['nenhuma', 'bochecha', 'olho', 'queixo'] as const;
export const ACCESSORIES = ['nenhum', 'louros', 'elmo', 'diadema', 'capuz', 'faixa', 'brinco', 'oculos'] as const;
export const RACE_FEATURES = ['nenhum', 'satiro', 'ninfa', 'ciclope', 'cacadora', 'divino'] as const;

export const BODY_KEYS = ['auto', 'knight', 'barbarian', 'mage', 'rogue', 'rogue_hooded'] as const;
export type BodyKey = Exclude<(typeof BODY_KEYS)[number], 'auto'>;
export const BODY_LABELS: Record<(typeof BODY_KEYS)[number], string> = {
  auto: 'Da classe', knight: 'Hoplita', barbarian: 'Bárbaro', mage: 'Sábio', rogue: 'Aventureiro', rogue_hooded: 'Encapuzado',
};
export const OUTFIT_COLORS = ['#f97316', '#c0392b', '#2f6fb7', '#2e8b57', '#6b3fa0', '#d4a020', '#e8e4dc', '#3a3a3a', '#8b5a2b', '#1fa5a5'] as const;

/** Corpo 3D do herói: modelo, cor da roupa, proporções e adornos. */
export interface HeroLook {
  body?: (typeof BODY_KEYS)[number];
  /** Cor principal da roupa (null = original do modelo). */
  outfit?: string | null;
  /** 0.9–1.1 */
  height?: number;
  /** 0.9–1.15 */
  build?: number;
  /** Mostra elmo/chapéu do modelo. */
  headgear?: boolean;
}

export interface PortraitSpec {
  v: 1;
  seed: string;
  face: (typeof FACE_SHAPES)[number];
  skin: string;
  hair: (typeof HAIR_STYLES)[number];
  hairColor: string;
  eyes: (typeof EYE_SHAPES)[number];
  eyeColor: string;
  mouth: (typeof MOUTHS)[number];
  beard: (typeof BEARDS)[number];
  scar: (typeof SCARS)[number];
  accessory: (typeof ACCESSORIES)[number];
  race: (typeof RACE_FEATURES)[number];
  bg: string;
  freckles: boolean;
  /** Aparência do corpo 3D (opcional; ausente = padrão da classe). */
  look?: HeroLook;
}

export const PORTRAIT_FIELDS = {
  face: { label: 'Rosto', options: FACE_SHAPES },
  hair: { label: 'Cabelo', options: HAIR_STYLES },
  eyes: { label: 'Olhos', options: EYE_SHAPES },
  mouth: { label: 'Boca', options: MOUTHS },
  beard: { label: 'Barba', options: BEARDS },
  scar: { label: 'Cicatriz', options: SCARS },
  accessory: { label: 'Acessório', options: ACCESSORIES },
} as const;

// ───────────── Semente → escolhas ─────────────

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rngFrom(seed: string) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length)];

/** Traço racial padrão a partir da raça do personagem. */
export function raceFeatureFor(race: string): PortraitSpec['race'] {
  switch (race) {
    case 'satiro': return 'satiro';
    case 'ninfa': return 'ninfa';
    case 'ciclope': return 'ciclope';
    case 'cacador_artemis': return 'cacadora';
    case 'semideus': return 'divino';
    default: return 'nenhum';
  }
}

export function randomPortrait(seed: string, race = 'semideus', locked: Partial<PortraitSpec> = {}): PortraitSpec {
  const r = rngFrom(seed);
  const feature = locked.race ?? raceFeatureFor(race);
  const spec: PortraitSpec = {
    v: 1,
    seed,
    face: pick(r, FACE_SHAPES),
    skin: feature === 'ninfa' && r() < 0.4 ? SKIN_TONES[10] : pick(r, SKIN_TONES.slice(0, 10)),
    hair: pick(r, HAIR_STYLES),
    hairColor: feature === 'ninfa' ? pick(r, ['#4a8a4a', '#6b8f3a', '#d2691e', '#3a6b2a']) : pick(r, HAIR_COLORS),
    eyes: pick(r, EYE_SHAPES),
    eyeColor: pick(r, EYE_COLORS),
    mouth: pick(r, MOUTHS),
    beard: r() < 0.25 ? pick(r, BEARDS.slice(1)) : 'nenhuma',
    scar: r() < 0.2 ? pick(r, SCARS.slice(1)) : 'nenhuma',
    accessory: feature === 'cacadora' ? 'diadema' : r() < 0.45 ? pick(r, ACCESSORIES.slice(1)) : 'nenhum',
    race: feature,
    bg: pick(r, BG_COLORS),
    freckles: r() < 0.3,
  };
  return { ...spec, ...locked, v: 1 };
}

export function isPortraitSpec(x: unknown): x is PortraitSpec {
  return !!x && typeof x === 'object' && (x as PortraitSpec).v === 1 && typeof (x as PortraitSpec).skin === 'string';
}

// ───────────── Cores ─────────────

function adjust(hexColor: string, f: number): string {
  const n = parseInt(hexColor.replace('#', ''), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

const INK = '#1c1917';

// ───────────── Peças SVG (viewBox 0 0 100 100) ─────────────

function headPath(face: PortraitSpec['face']): string {
  switch (face) {
    case 'redondo': return 'M50 24 C70 24 80 40 80 56 C80 74 66 86 50 86 C34 86 20 74 20 56 C20 40 30 24 50 24 Z';
    case 'quadrado': return 'M50 24 C68 24 78 34 78 48 L78 66 C78 78 66 86 50 86 C34 86 22 78 22 66 L22 48 C22 34 32 24 50 24 Z';
    case 'longo': return 'M50 20 C66 20 75 34 75 52 C75 72 64 90 50 90 C36 90 25 72 25 52 C25 34 34 20 50 20 Z';
    case 'coracao': return 'M50 24 C70 24 79 38 78 52 C77 68 62 86 50 88 C38 86 23 68 22 52 C21 38 30 24 50 24 Z';
    default: return 'M50 22 C68 22 77 37 77 54 C77 73 64 88 50 88 C36 88 23 73 23 54 C23 37 32 22 50 22 Z';
  }
}

function hairBack(s: PortraitSpec, c: string): string {
  const d = adjust(c, 0.75);
  switch (s.hair) {
    case 'longo': return `<path d="M22 50 C18 72 20 92 30 98 L70 98 C80 92 82 72 78 50 Z" fill="${d}"/>`;
    case 'trancas': return `<path d="M24 54 C20 70 22 86 26 96 L34 96 C32 82 30 68 32 56 Z M76 54 C80 70 78 86 74 96 L66 96 C68 82 70 68 68 56 Z" fill="${d}"/>`;
    case 'rabo': return `<path d="M72 34 C90 40 92 62 84 78 C80 66 78 52 70 44 Z" fill="${d}"/>`;
    case 'black_power': return `<circle cx="50" cy="40" r="34" fill="${d}"/>`;
    case 'cacheado': return `<path d="M20 46 C14 64 18 80 26 86 L74 86 C82 80 86 64 80 46 Z" fill="${d}"/>`;
    default: return '';
  }
}

function hairFront(s: PortraitSpec, c: string): string {
  const hi = adjust(c, 1.25);
  const stroke = `stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"`;
  switch (s.hair) {
    case 'raspado': return `<path d="M26 38 C32 24 68 24 74 38 C66 32 34 32 26 38 Z" fill="${c}" opacity="0.55"/>`;
    case 'arrepiado': return `<path d="M22 46 L26 26 L34 34 L38 18 L46 30 L52 14 L58 30 L66 18 L68 34 L76 26 L78 46 C70 36 30 36 22 46 Z" fill="${c}" ${stroke}/>`;
    case 'franja': return `<path d="M22 48 C20 26 40 16 52 18 C68 18 80 30 78 48 C70 40 64 36 56 36 C48 42 34 44 22 48 Z" fill="${c}" ${stroke}/>`;
    case 'coque': return `<circle cx="50" cy="16" r="9" fill="${c}" ${stroke}/><path d="M23 44 C22 28 36 20 50 20 C64 20 78 28 77 44 C68 34 32 34 23 44 Z" fill="${c}" ${stroke}/>`;
    case 'black_power': return `<path d="M20 44 C20 22 80 22 80 44 C70 36 30 36 20 44 Z" fill="${c}"/><circle cx="34" cy="26" r="2" fill="${hi}"/><circle cx="62" cy="24" r="2" fill="${hi}"/>`;
    case 'cacheado': return `<path d="M22 46 C18 28 34 16 50 18 C66 16 82 28 78 46 C74 40 70 42 66 38 C62 42 56 40 52 36 C48 40 42 40 38 38 C34 42 28 40 22 46 Z" fill="${c}" ${stroke}/><circle cx="30" cy="30" r="3" fill="${hi}" opacity="0.6"/><circle cx="58" cy="24" r="3" fill="${hi}" opacity="0.6"/>`;
    case 'longo':
    case 'trancas':
    case 'rabo': return `<path d="M22 50 C20 28 36 18 50 18 C64 18 80 28 78 50 C74 38 64 30 50 30 C38 30 28 38 22 50 Z" fill="${c}" ${stroke}/><path d="M40 24 C46 22 54 22 60 24" stroke="${hi}" stroke-width="2" fill="none" opacity="0.6"/>`;
    default: return `<path d="M23 46 C22 28 36 19 50 19 C64 19 78 28 77 46 C70 34 60 32 50 34 C40 32 30 36 23 46 Z" fill="${c}" ${stroke}/><path d="M38 24 C46 21 56 21 62 24" stroke="${hi}" stroke-width="2" fill="none" opacity="0.6"/>`;
  }
}

function eyesSvg(s: PortraitSpec): string {
  const white = '#fbfaf7';
  if (s.race === 'ciclope') {
    return `<ellipse cx="50" cy="52" rx="10" ry="8" fill="${white}" stroke="${INK}" stroke-width="1.8"/><circle cx="50" cy="52" r="5" fill="${s.eyeColor}"/><circle cx="50" cy="52" r="2.2" fill="${INK}"/><circle cx="52" cy="50" r="1.2" fill="#fff"/><path d="M38 42 Q50 36 62 42" stroke="${INK}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  }
  const eye = (cx: number) => {
    switch (s.eyes) {
      case 'amendoado': return `<path d="M${cx - 6} 54 Q${cx} 48 ${cx + 6} 54 Q${cx} 57 ${cx - 6} 54 Z" fill="${white}" stroke="${INK}" stroke-width="1.4"/><circle cx="${cx}" cy="53.5" r="2.4" fill="${s.eyeColor}"/><circle cx="${cx}" cy="53.5" r="1.1" fill="${INK}"/>`;
      case 'redondo': return `<circle cx="${cx}" cy="54" r="4.5" fill="${white}" stroke="${INK}" stroke-width="1.4"/><circle cx="${cx}" cy="54" r="2.6" fill="${s.eyeColor}"/><circle cx="${cx}" cy="54" r="1.2" fill="${INK}"/><circle cx="${cx + 1.2}" cy="52.8" r="0.8" fill="#fff"/>`;
      case 'sereno': return `<path d="M${cx - 6} 54 Q${cx} 58 ${cx + 6} 54" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      case 'determinado': return `<path d="M${cx - 6} 55 Q${cx} 50 ${cx + 6} 54 L${cx + 6} 55 Q${cx} 58 ${cx - 6} 55 Z" fill="${white}" stroke="${INK}" stroke-width="1.4"/><circle cx="${cx}" cy="54.5" r="2.3" fill="${s.eyeColor}"/><circle cx="${cx}" cy="54.5" r="1" fill="${INK}"/>`;
      default: return `<ellipse cx="${cx}" cy="54" rx="5" ry="3.6" fill="${white}" stroke="${INK}" stroke-width="1.4"/><circle cx="${cx}" cy="54" r="2.4" fill="${s.eyeColor}"/><circle cx="${cx}" cy="54" r="1.1" fill="${INK}"/><circle cx="${cx + 1}" cy="53" r="0.7" fill="#fff"/>`;
    }
  };
  const brow = (cx: number, dir: number) => {
    const tilt = s.eyes === 'determinado' ? 3 * dir : 0;
    return `<path d="M${cx - 6} ${46 + tilt} Q${cx} ${43} ${cx + 6} ${46 - tilt}" stroke="${adjust(s.hairColor, 0.8)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  };
  return eye(39) + eye(61) + brow(39, -1) + brow(61, 1);
}

function mouthSvg(s: PortraitSpec): string {
  const lip = adjust(s.skin, 0.7);
  switch (s.mouth) {
    case 'sorriso': return `<path d="M41 70 Q50 78 59 70" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case 'confiante': return `<path d="M42 71 Q52 75 60 68" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case 'aberto': return `<path d="M42 70 Q50 80 58 70 Z" fill="#6b2a2a" stroke="${INK}" stroke-width="1.6"/><path d="M44 71 L56 71" stroke="#fff" stroke-width="1.6"/>`;
    case 'serio': return `<path d="M43 72 L57 72" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
    default: return `<path d="M43 71 Q50 74 57 71" stroke="${lip}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M43 71 Q50 73 57 71" stroke="${INK}" stroke-width="1" fill="none"/>`;
  }
}

function beardSvg(s: PortraitSpec): string {
  const c = s.hairColor;
  switch (s.beard) {
    case 'curta': return `<path d="M27 66 C30 80 40 88 50 88 C60 88 70 80 73 66 C68 74 60 78 50 78 C40 78 32 74 27 66 Z" fill="${c}" opacity="0.55"/>`;
    case 'cheia': return `<path d="M25 60 C26 82 38 94 50 94 C62 94 74 82 75 60 C70 72 62 78 50 78 C38 78 30 72 25 60 Z" fill="${c}" stroke="${INK}" stroke-width="1.4"/><path d="M42 67 Q50 64 58 67" stroke="${c}" stroke-width="4" fill="none"/>`;
    case 'cavanhaque': return `<path d="M44 76 Q50 90 56 76 Z" fill="${c}" stroke="${INK}" stroke-width="1.2"/><path d="M42 67 Q50 64 58 67" stroke="${c}" stroke-width="3" fill="none"/>`;
    case 'bigode': return `<path d="M40 68 Q45 63 50 66 Q55 63 60 68 Q55 67 50 69 Q45 67 40 68 Z" fill="${c}" stroke="${INK}" stroke-width="1"/>`;
    default: return '';
  }
}

function scarSvg(s: PortraitSpec): string {
  const c = adjust(s.skin, 0.72);
  switch (s.scar) {
    case 'bochecha': return `<path d="M64 60 L70 68 M66 62 L64 64 M68 65 L66 67" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/>`;
    case 'olho': return `<path d="M58 42 L66 64" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`;
    case 'queixo': return `<path d="M46 82 L54 84" stroke="${c}" stroke-width="1.8" stroke-linecap="round"/>`;
    default: return '';
  }
}

function earsAndHorns(s: PortraitSpec, skin: string): string {
  const shadow = adjust(skin, 0.82);
  if (s.race === 'satiro') {
    return `<path d="M24 48 L8 38 L20 56 Z" fill="${skin}" stroke="${INK}" stroke-width="1.4"/><path d="M76 48 L92 38 L80 56 Z" fill="${skin}" stroke="${INK}" stroke-width="1.4"/>` +
      `<path d="M34 28 C26 14 30 6 36 4 C34 12 38 20 42 26 Z" fill="#d8c8a8" stroke="${INK}" stroke-width="1.4"/><path d="M66 28 C74 14 70 6 64 4 C66 12 62 20 58 26 Z" fill="#d8c8a8" stroke="${INK}" stroke-width="1.4"/>`;
  }
  return `<ellipse cx="23" cy="56" rx="4.5" ry="7" fill="${skin}" stroke="${INK}" stroke-width="1.4"/><ellipse cx="77" cy="56" rx="4.5" ry="7" fill="${skin}" stroke="${INK}" stroke-width="1.4"/><ellipse cx="23" cy="56" rx="2" ry="4" fill="${shadow}"/><ellipse cx="77" cy="56" rx="2" ry="4" fill="${shadow}"/>`;
}

function accessorySvg(s: PortraitSpec): string {
  const stroke = `stroke="${INK}" stroke-width="1.4"`;
  const leaves = (y: number, color: string) => {
    let out = '';
    for (let i = 0; i < 7; i++) {
      const x = 28 + i * 7.3;
      const yy = y + Math.abs(3 - i) * 1.6;
      out += `<ellipse cx="${x}" cy="${yy}" rx="4.4" ry="2.2" transform="rotate(${-30 + i * 10} ${x} ${yy})" fill="${color}" ${stroke}/>`;
    }
    return out;
  };
  switch (s.accessory) {
    case 'louros': return leaves(26, '#d4af37');
    case 'elmo': return `<path d="M20 50 C20 24 80 24 80 50 L80 58 L70 58 L70 46 L30 46 L30 58 L20 58 Z" fill="#b08d57" ${stroke}/><path d="M34 22 Q50 2 66 22 Q50 14 34 22 Z" fill="#b91c1c" ${stroke}/><rect x="47" y="30" width="6" height="18" fill="#8a6a3a"/>`;
    case 'diadema': return `<path d="M26 36 Q50 26 74 36" stroke="#e2e8f0" stroke-width="3" fill="none"/><path d="M45 32 Q50 22 55 32 Q50 30 45 32 Z" fill="#e2e8f0" ${stroke}/><circle cx="50" cy="30" r="1.8" fill="#93c5fd"/>`;
    case 'capuz': return `<path d="M14 98 C10 50 26 10 50 10 C74 10 90 50 86 98 L74 98 C76 60 66 34 50 34 C34 34 24 60 26 98 Z" fill="#4b5563" ${stroke}/>`;
    case 'faixa': return `<path d="M22 40 Q50 32 78 40 L78 46 Q50 38 22 46 Z" fill="#dc2626" ${stroke}/><path d="M78 42 L88 52 L84 54 Z" fill="#dc2626" ${stroke}/>`;
    case 'brinco': return `<circle cx="23" cy="66" r="2.6" fill="#d4af37" ${stroke}/><circle cx="77" cy="66" r="2.6" fill="#d4af37" ${stroke}/>`;
    case 'oculos': return s.race === 'ciclope' ? '' : `<circle cx="39" cy="54" r="7.5" fill="none" stroke="${INK}" stroke-width="2"/><circle cx="61" cy="54" r="7.5" fill="none" stroke="${INK}" stroke-width="2"/><path d="M46.5 54 L53.5 54" stroke="${INK}" stroke-width="2"/>`;
    default: return '';
  }
}

function raceExtras(s: PortraitSpec): string {
  if (s.race === 'ninfa') {
    let out = '';
    for (let i = 0; i < 6; i++) {
      const x = 24 + i * 10;
      out += `<path d="M${x} 30 C${x - 6} 20 ${x} 12 ${x + 4} 14 C${x + 6} 20 ${x + 4} 26 ${x} 30 Z" fill="#65a30d" stroke="${INK}" stroke-width="1.2"/>`;
    }
    return out + `<circle cx="72" cy="30" r="3" fill="#f9a8d4" stroke="${INK}" stroke-width="1"/>`;
  }
  if (s.race === 'divino') return `<circle cx="50" cy="14" r="0" fill="none"/>`;
  return '';
}

/** Gera o SVG do retrato (viewBox 100x100). `frame` desenha o fundo circular. */
export function portraitSvg(s: PortraitSpec, opts: { frame?: boolean; size?: number } = {}): string {
  const skin = s.skin;
  const shadow = adjust(skin, 0.86);
  const blush = adjust(skin, 0.9);
  const size = opts.size ?? 128;
  const parts = [
    opts.frame !== false ? `<circle cx="50" cy="50" r="49" fill="${s.bg}"/><circle cx="50" cy="50" r="49" fill="url(#g)" />` : '',
    hairBack(s, s.hairColor),
    s.accessory === 'capuz' ? accessorySvg(s) : '',
    // pescoço e ombros
    `<path d="M40 80 L40 92 L60 92 L60 80 Z" fill="${shadow}"/><path d="M18 100 C20 90 34 86 50 86 C66 86 80 90 82 100 Z" fill="${adjust(s.bg, 1.6)}" stroke="${INK}" stroke-width="1.4"/>`,
    earsAndHorns(s, skin),
    `<path d="${headPath(s.face)}" fill="${skin}" stroke="${INK}" stroke-width="1.8"/>`,
    `<path d="M30 70 C34 80 42 86 50 86 C42 82 36 76 32 66 Z" fill="${shadow}" opacity="0.7"/>`,
    s.freckles ? [33, 37, 63, 67, 35, 65].map((x, i) => `<circle cx="${x}" cy="${62 + (i % 2) * 2}" r="0.9" fill="${adjust(skin, 0.7)}"/>`).join('') : '',
    `<ellipse cx="33" cy="64" rx="4" ry="2.4" fill="${blush}" opacity="0.5"/><ellipse cx="67" cy="64" rx="4" ry="2.4" fill="${blush}" opacity="0.5"/>`,
    scarSvg(s),
    eyesSvg(s),
    `<path d="M50 56 Q47 64 50 66 Q53 66 54 64" stroke="${adjust(skin, 0.7)}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    mouthSvg(s),
    beardSvg(s),
    hairFront(s, s.hairColor),
    raceExtras(s),
    s.accessory !== 'capuz' ? accessorySvg(s) : '',
    s.race === 'divino' ? `<circle cx="50" cy="50" r="48" fill="none" stroke="#fde68a" stroke-width="2" opacity="0.6"/>` : '',
  ];
  const defs = `<defs><radialGradient id="g" cx="50%" cy="35%" r="65%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.18"/><stop offset="100%" stop-color="#000000" stop-opacity="0.25"/></radialGradient><clipPath id="c"><circle cx="50" cy="50" r="49"/></clipPath></defs>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${defs}<g clip-path="url(#c)">${parts.join('')}</g></svg>`;
}

export function portraitUrl(s: PortraitSpec, size = 128): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(portraitSvg(s, { size }))}`;
}

// ───────────── Texturas para o mapa (cache por spec) ─────────────

const portraitTextures = new Map<string, Texture>();
const portraitLoading = new Set<string>();
const portraitListeners = new Set<() => void>();

export function onPortraitLoaded(fn: () => void) {
  portraitListeners.add(fn);
  return () => portraitListeners.delete(fn);
}

export function getPortraitTexture(spec: unknown): Texture | null {
  if (!isPortraitSpec(spec)) return null;
  const key = JSON.stringify(spec);
  const ready = portraitTextures.get(key);
  if (ready) return ready;
  if (!portraitLoading.has(key) && typeof Image !== 'undefined') {
    portraitLoading.add(key);
    const img = new Image();
    img.onload = () => {
      portraitTextures.set(key, Texture.from(img));
      for (const l of portraitListeners) l();
    };
    img.src = portraitUrl(spec, 128);
  }
  return null;
}
