/**
 * Motor de rolagem de dados.
 *
 * Fórmulas suportadas (combináveis com + e -):
 *   2d6, d20, 1d20+5, 4d6kh3 (mantém os 3 maiores), 2d20kh1 (vantagem),
 *   2d20kl1 (desvantagem), 1d8+1d6+2, 1d12-1
 *
 * A fonte de aleatoriedade é injetável (útil para testes e para o servidor).
 */

export type Rng = () => number; // [0, 1)

export const defaultRng: Rng = () => Math.random();

/** Gera um RNG determinístico (mulberry32) — usado nos testes. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rola sempre os valores informados, em sequência (para testes). */
export function fixedRng(values: number[], sides = 20): Rng {
  let i = 0;
  return () => {
    const v = values[i % values.length];
    i++;
    return (v - 1) / sides + 1e-9;
  };
}

export const ALLOWED_SIDES = [2, 3, 4, 6, 8, 10, 12, 20, 100] as const;
export const MAX_DICE_PER_TERM = 100;
export const MAX_TERMS = 10;

export interface DiceTerm {
  kind: 'dice';
  sign: 1 | -1;
  count: number;
  sides: number;
  keep?: { mode: 'kh' | 'kl'; n: number };
}
export interface ConstTerm {
  kind: 'const';
  sign: 1 | -1;
  value: number;
}
export type Term = DiceTerm | ConstTerm;

export interface TermResult {
  notation: string;
  rolls: number[];
  kept: number[];
  subtotal: number;
}

export interface RollResult {
  formula: string;
  total: number;
  terms: TermResult[];
  /** Valor natural do d20 quando a fórmula tem exatamente um d20 mantido. */
  natural: number | null;
  critical: boolean;
  fumble: boolean;
}

export class DiceError extends Error {}

const TERM_RE = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/i;

export function parseFormula(formula: string): Term[] {
  const clean = formula.replace(/\s+/g, '').toLowerCase();
  if (!clean) throw new DiceError('Fórmula vazia');
  if (!/^[+-]?[0-9dkhl+-]+$/.test(clean)) throw new DiceError(`Fórmula inválida: "${formula}"`);

  const parts = clean.match(/[+-]?[^+-]+/g);
  if (!parts || parts.length > MAX_TERMS) throw new DiceError(`Use no máximo ${MAX_TERMS} termos`);

  return parts.map((raw) => {
    const sign: 1 | -1 = raw.startsWith('-') ? -1 : 1;
    const body = raw.replace(/^[+-]/, '');
    if (/^\d+$/.test(body)) return { kind: 'const', sign, value: Number(body) } satisfies ConstTerm;

    const m = TERM_RE.exec(body);
    if (!m) throw new DiceError(`Termo inválido: "${body}"`);
    const count = m[1] === '' ? 1 : Number(m[1]);
    const sides = Number(m[2]);
    if (count < 1 || count > MAX_DICE_PER_TERM) throw new DiceError(`Quantidade de dados deve ser entre 1 e ${MAX_DICE_PER_TERM}`);
    if (!(ALLOWED_SIDES as readonly number[]).includes(sides)) throw new DiceError(`Dado d${sides} não suportado`);

    const term: DiceTerm = { kind: 'dice', sign, count, sides };
    if (m[3]) {
      const n = Number(m[4]);
      if (n < 1 || n > count) throw new DiceError(`Não é possível manter ${n} de ${count} dados`);
      term.keep = { mode: m[3] as 'kh' | 'kl', n };
    }
    return term;
  });
}

export function rollDie(sides: number, rng: Rng = defaultRng): number {
  return 1 + Math.floor(rng() * sides);
}

export function roll(formula: string, rng: Rng = defaultRng): RollResult {
  const terms = parseFormula(formula);
  const results: TermResult[] = [];
  let total = 0;
  const keptD20: number[] = [];

  for (const term of terms) {
    if (term.kind === 'const') {
      const subtotal = term.sign * term.value;
      total += subtotal;
      results.push({ notation: `${term.sign < 0 ? '-' : '+'}${term.value}`, rolls: [], kept: [], subtotal });
      continue;
    }
    const rolls = Array.from({ length: term.count }, () => rollDie(term.sides, rng));
    let kept = [...rolls];
    if (term.keep) {
      const sorted = [...rolls].sort((a, b) => (term.keep!.mode === 'kh' ? b - a : a - b));
      kept = sorted.slice(0, term.keep.n);
    }
    const subtotal = term.sign * kept.reduce((s, v) => s + v, 0);
    total += subtotal;
    if (term.sides === 20) keptD20.push(...kept);
    const keepStr = term.keep ? `${term.keep.mode}${term.keep.n}` : '';
    results.push({
      notation: `${term.sign < 0 ? '-' : '+'}${term.count}d${term.sides}${keepStr}`,
      rolls,
      kept,
      subtotal,
    });
  }

  const natural = keptD20.length === 1 ? keptD20[0] : null;
  return {
    formula: formula.replace(/\s+/g, '').toLowerCase(),
    total,
    terms: results,
    natural,
    critical: natural === 20,
    fumble: natural === 1,
  };
}

export type AdvantageState = 'normal' | 'vantagem' | 'desvantagem';

/** Combina fontes de vantagem/desvantagem como no 5e: qualquer uma de cada se anula. */
export function resolveAdvantage(advantages: number, disadvantages: number): AdvantageState {
  if (advantages > 0 && disadvantages === 0) return 'vantagem';
  if (disadvantages > 0 && advantages === 0) return 'desvantagem';
  return 'normal';
}

/** Monta uma fórmula de d20 com modificador e vantagem: "2d20kh1+5". */
export function d20Formula(modifier: number, adv: AdvantageState = 'normal'): string {
  const die = adv === 'vantagem' ? '2d20kh1' : adv === 'desvantagem' ? '2d20kl1' : '1d20';
  if (modifier === 0) return die;
  return `${die}${modifier > 0 ? '+' : '-'}${Math.abs(modifier)}`;
}

/** Dobra os dados (não os modificadores) — usado em acertos críticos. */
export function criticalFormula(formula: string): string {
  return parseFormula(formula)
    .map((t, i) => {
      const sign = t.sign < 0 ? '-' : i === 0 ? '' : '+';
      if (t.kind === 'const') return `${sign}${t.value}`;
      return `${sign}${t.count * 2}d${t.sides}`;
    })
    .join('');
}

/** Média esperada de uma fórmula (ignora kh/kl). */
export function averageOf(formula: string): number {
  return parseFormula(formula).reduce((s, t) => {
    if (t.kind === 'const') return s + t.sign * t.value;
    return s + t.sign * t.count * ((t.sides + 1) / 2);
  }, 0);
}
