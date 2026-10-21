/**
 * Arte dos tokens: ícones vetoriais ORIGINAIS do Mesa RPG (sem assets de terceiros).
 * Heróis usam o ícone da classe; monstros, a silhueta da criatura.
 * Cada ícone é um SVG 64x64 branco com contorno escuro — legível sobre qualquer cor e no celular.
 */
import { Texture } from 'pixi.js';

const INK = '#1c1917';

/** Traço branco com contorno escuro (linhas: espadas, cordas, pescoços). */
const S = (d: string, w = 5) =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 4}" stroke-linecap="round" stroke-linejoin="round"/>` +
  `<path d="${d}" fill="none" stroke="#fff" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Forma preenchida de branco (ou outra cor) com contorno. */
const F = (d: string, fill = '#fff') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
/** Detalhe escuro (veias, olhos, narinas). */
const D = (d: string, w = 2.5) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const C = (cx: number, cy: number, r: number, fill = '#fff', stroke = true) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"${stroke ? ` stroke="${INK}" stroke-width="2.5"` : ''}/>`;

function star(cx: number, cy: number, points: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

function rays(cx: number, cy: number, n: number, r1: number, r2: number): string {
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    out += S(`M${(cx + r1 * Math.cos(a)).toFixed(1)} ${(cy + r1 * Math.sin(a)).toFixed(1)} L${(cx + r2 * Math.cos(a)).toFixed(1)} ${(cy + r2 * Math.sin(a)).toFixed(1)}`, 3.5);
  }
  return out;
}

export const ART: Record<string, { label: string; svg: string }> = {
  // ───────────── Classes (heróis) ─────────────
  'classe:guerreiro': {
    label: 'Espadas cruzadas',
    svg: S('M14 14 L42 42') + S('M50 14 L22 42') + S('M36 48 L48 36', 4) + S('M16 36 L28 48', 4) + S('M44 44 L51 51', 6) + S('M20 44 L13 51', 6),
  },
  'classe:barbaro': {
    label: 'Machado duplo',
    svg: F('M32 16 C20 10 10 18 10 29 C10 39 20 45 32 40 Z') + F('M32 16 C44 10 54 18 54 29 C54 39 44 45 32 40 Z') + S('M32 10 L32 57', 5),
  },
  'classe:bardo': {
    label: 'Lira',
    svg: S('M20 12 C10 26 15 44 26 50 L38 50 C49 44 54 26 44 12', 4.5) + S('M17 21 L47 21', 4) + S('M28 22 L28 48', 2) + S('M32 22 L32 48', 2) + S('M36 22 L36 48', 2),
  },
  'classe:clerigo': {
    label: 'Sol sagrado',
    svg: rays(32, 32, 10, 17, 26) + C(32, 32, 12) + D('M32 25 L32 39 M25 32 L39 32', 3),
  },
  'classe:druida': {
    label: 'Folha',
    svg: F('M32 6 C52 18 54 40 32 58 C10 40 12 18 32 6 Z') + D('M32 14 L32 54', 2.5) + D('M32 26 L23 19 M32 34 L42 26 M32 42 L22 35', 2),
  },
  'classe:monge': {
    label: 'Punho',
    svg: F('M17 27 Q17 18 26 18 L44 18 Q51 18 51 26 L51 40 Q51 51 40 51 L28 51 Q17 51 17 40 Z') + D('M27 18 L27 31 M35 18 L35 31 M43 18 L43 31', 2.5) + D('M17 34 Q28 33 34 41', 2.5),
  },
  'classe:paladino': {
    label: 'Escudo sagrado',
    svg: F('M32 7 L53 14 L53 30 C53 45 43 53 32 58 C21 53 11 45 11 30 L11 14 Z') + D('M32 17 L32 47', 5) + D('M21 28 L43 28', 5),
  },
  'classe:patrulheiro': {
    label: 'Arco e flecha',
    svg: S('M20 7 Q48 32 20 57', 4.5) + S('M20 7 L20 57', 1.5) + S('M11 32 L52 32', 3) + F('M57 32 L47 26 L47 38 Z') + S('M12 32 L7 26 M12 32 L7 38', 2),
  },
  'classe:ladino': {
    label: 'Adaga',
    svg: F('M32 5 L39 34 L25 34 Z') + D('M32 11 L32 32', 1.8) + S('M19 37 L45 37', 4) + S('M32 40 L32 52', 5) + C(32, 56, 4),
  },
  'classe:feiticeiro': {
    label: 'Chama arcana',
    svg: F('M32 5 C41 17 51 24 49 40 C47 52 39 58 32 58 C24 58 15 52 15 40 C15 30 23 26 25 15 C30 23 35 25 32 5 Z') +
      `<path d="M32 30 C37 36 40 41 38 47 C36 52 28 52 26 47 C24 42 29 38 32 30 Z" fill="${INK}" opacity="0.35"/>`,
  },
  'classe:bruxo': {
    label: 'Olho do pacto',
    svg: F('M5 32 Q32 7 59 32 Q32 57 5 32 Z') + C(32, 32, 10, INK, false) + `<ellipse cx="32" cy="32" rx="2.5" ry="7" fill="#facc15"/>`,
  },
  'classe:mago': {
    label: 'Chapéu de mago',
    svg: F('M33 5 L47 44 L17 44 Z') + F('M7 46 Q32 38 57 46 Q32 55 7 46 Z') + `<path d="${star(32, 30, 5, 6, 2.6)}" fill="${INK}"/>`,
  },

  // ───────────── Monstros ─────────────
  'monstro:harpia': {
    label: 'Harpia',
    svg: F('M30 31 C20 17 10 13 3 15 C7 26 15 34 28 40 Z') + F('M34 31 C44 17 54 13 61 15 C57 26 49 34 36 40 Z') +
      F('M32 19 C39 24 39 44 32 53 C25 44 25 24 32 19 Z') + C(32, 17, 6) + F('M32 19 L37 23 L32 25 Z', '#fbbf24') + D('M28 53 L26 58 M36 53 L38 58', 2),
  },
  'monstro:cao_infernal': {
    label: 'Cão do Submundo',
    svg: F('M13 12 L24 23 L40 23 L51 12 L51 34 C51 47 42 55 32 55 C22 55 13 47 13 34 Z') +
      C(24, 33, 3.5, '#ef4444', false) + C(40, 33, 3.5, '#ef4444', false) + F('M26 43 L32 49 L38 43 Z', INK) + D('M22 51 L25 47 M42 51 L39 47', 2),
  },
  'monstro:minotauro': {
    label: 'Minotauro',
    svg: S('M19 21 C9 20 5 12 9 5', 5) + S('M45 21 C55 20 59 12 55 5', 5) +
      F('M18 17 L46 17 C51 28 47 40 41 46 L41 55 L23 55 L23 46 C17 40 13 28 18 17 Z') +
      D('M24 30 L29 32 M40 30 L35 32', 3) + C(28, 50, 2, INK, false) + C(36, 50, 2, INK, false) + S('M27 56 Q32 60 37 56', 2),
  },
  'monstro:ciclope_selvagem': {
    label: 'Ciclope',
    svg: F('M14 22 C14 9 50 9 50 22 L50 42 C50 55 14 55 14 42 Z') + C(32, 28, 10) + C(32, 28, 5, INK, false) + C(34, 26, 1.6, '#fff', false) +
      D('M19 15 L45 15', 3.5) + D('M23 44 Q32 39 41 44', 3) + D('M27 44 L27 47 M37 44 L37 47', 2),
  },
  'monstro:dracena': {
    label: 'Dracena',
    svg: S('M44 13 C22 9 20 27 32 31 C44 35 44 51 19 53', 7) + C(47, 13, 7) + C(49, 11, 1.6, INK, false) + D('M54 14 L59 11 M54 14 L59 17', 1.8),
  },
  'monstro:empusa': {
    label: 'Empusa',
    svg: F('M32 3 C38 11 45 11 45 21 C49 17 51 24 49 30 L15 30 C13 24 15 17 19 21 C19 11 26 11 32 3 Z', '#fb923c') +
      C(32, 39, 14) + D('M25 36 L29 38 M39 36 L35 38', 3) + F('M27 46 L29 51 L31 46 Z M33 46 L35 51 L37 46 Z'),
  },
  'monstro:esqueleto_spartoi': {
    label: 'Guerreiro Spartoi',
    svg: F('M13 29 C13 12 51 12 51 29 C51 38 47 42 45 44 L45 53 L19 53 L19 44 C17 42 13 38 13 29 Z') +
      C(24, 31, 5.5, INK, false) + C(40, 31, 5.5, INK, false) + F('M32 37 L28.5 43 L35.5 43 Z', INK) + D('M26 53 L26 47 M32 53 L32 47 M38 53 L38 47', 2),
  },
  'monstro:quimera': {
    label: 'Quimera',
    svg: F(star(32, 32, 14, 28, 19), '#f59e0b') + C(32, 33, 13) + D('M26 30 L29 31 M38 30 L35 31', 3) + F('M29 37 L35 37 L32 41 Z', INK) + D('M27 44 Q32 47 37 44', 2),
  },
  'monstro:hidra_jovem': {
    label: 'Hidra',
    svg: S('M32 58 C32 40 17 34 13 21', 5) + S('M32 58 L32 19', 5) + S('M32 58 C32 40 47 34 51 21', 5) +
      C(13, 16, 6) + C(32, 13, 6) + C(51, 16, 6) + C(11, 15, 1.5, INK, false) + C(32, 11, 1.5, INK, false) + C(53, 15, 1.5, INK, false),
  },
  'monstro:gorgona': {
    label: 'Górgona',
    svg: S('M20 26 C11 22 15 13 8 9', 3) + S('M26 22 C24 13 30 9 26 3', 3) + S('M38 22 C40 13 34 9 38 3', 3) + S('M44 26 C53 22 49 13 56 9', 3) + S('M17 34 C8 34 9 26 3 24', 3) + S('M47 34 C56 34 55 26 61 24', 3) +
      C(32, 38, 14) + C(27, 36, 3, '#22c55e', false) + C(37, 36, 3, '#22c55e', false) + D('M27 45 Q32 48 37 45', 2.5),
  },
  'monstro:lestrigao': {
    label: 'Lestrigão',
    svg: S('M12 53 L33 31', 8) + F('M29 35 C22 22 33 5 48 9 C61 13 59 31 46 37 C40 40 34 39 29 35 Z') +
      C(42, 17, 2, INK, false) + C(50, 25, 2, INK, false) + C(38, 29, 2, INK, false),
  },
  'monstro:telquine': {
    label: 'Telquine',
    svg: F('M9 40 C15 23 37 19 51 27 C57 31 59 37 55 40 C47 45 29 47 9 40 Z') + F('M10 40 L2 31 L3 49 Z') + F('M30 43 L24 53 L36 45 Z') + C(48, 31, 2, INK, false) + D('M53 36 L58 37', 2),
  },

  // ───────────── Genéricos ─────────────
  heroi: {
    label: 'Elmo grego',
    svg: F('M14 34 C14 14 50 14 50 34 L50 54 L38 54 L38 38 L26 38 L26 54 L14 54 Z') + `<path d="M22 12 Q32 2 42 12" fill="#ef4444" stroke="${INK}" stroke-width="2.5"/>`,
  },
  monstro: {
    label: 'Garras',
    svg: S('M18 10 Q28 32 16 54', 4) + S('M32 8 Q42 32 30 56', 4) + S('M46 10 Q56 32 44 54', 4),
  },
};

/** Resolve qual arte um token usa (com fallback para saves antigos sem "portrait"). */
export function artKeyFor(t: { portrait?: string; kind: string; monsterKey?: string | null }): string {
  if (t.portrait && ART[t.portrait]) return t.portrait;
  if (t.monsterKey && ART[`monstro:${t.monsterKey}`]) return `monstro:${t.monsterKey}`;
  return t.kind === 'monstro' ? 'monstro' : 'heroi';
}

/** Data URL do SVG, para usar em <img> na interface. */
export function artUrl(key: string): string {
  const art = ART[key] ?? ART.heroi;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">${art.svg}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ───────────── Texturas para o PixiJS (carregadas uma vez e reaproveitadas) ─────────────

const textures = new Map<string, Texture>();
const loading = new Set<string>();
const listeners = new Set<() => void>();

/** Avisa quando uma arte terminou de carregar (o mapa redesenha). */
export function onArtLoaded(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getArtTexture(key: string): Texture | null {
  const ready = textures.get(key);
  if (ready) return ready;
  if (!loading.has(key) && typeof Image !== 'undefined') {
    loading.add(key);
    const img = new Image();
    img.onload = () => {
      textures.set(key, Texture.from(img));
      for (const l of listeners) l();
    };
    img.src = artUrl(key);
  }
  return null;
}
