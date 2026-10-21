/**
 * Ranks e encantamentos de armas e armaduras.
 *
 * Um item com rank é o item base + uma melhoria, codificado na própria chave:
 *   "espada_longa+2"              → Espada Longa +2 (rank Heroico)
 *   "couro_batido+1~contra_fogo"  → Couro Batido contra Fogo +1
 * Assim o inventário, os baús e as recompensas funcionam sem tabela nova: o motor
 * resolve a chave em um ItemDef derivado (ver getItem em items.ts).
 */
import type { Ability } from '../rules/abilities';
import type { ArmorItem, DamageType, ItemDef, WeaponItem } from './items';

export interface RankDef {
  rank: number;
  label: string;
  color: string;
  /** Bônus de acerto/dano (armas) ou de CA (armaduras). */
  bonus: number;
  /** Escudos ganham menos (máximo +2). */
  shieldBonus: number;
  minLevel: number;
  valueMult: number;
}

export const RANKS: RankDef[] = [
  { rank: 0, label: 'Comum', color: '#9ca3af', bonus: 0, shieldBonus: 0, minLevel: 1, valueMult: 1 },
  { rank: 1, label: 'Refinado', color: '#4ade80', bonus: 1, shieldBonus: 1, minLevel: 1, valueMult: 3 },
  { rank: 2, label: 'Heroico', color: '#60a5fa', bonus: 2, shieldBonus: 1, minLevel: 3, valueMult: 8 },
  { rank: 3, label: 'Épico', color: '#c084fc', bonus: 3, shieldBonus: 2, minLevel: 5, valueMult: 20 },
  { rank: 4, label: 'Divino', color: '#fbbf24', bonus: 4, shieldBonus: 2, minLevel: 8, valueMult: 50 },
];
export const MAX_RANK = RANKS.length - 1;

export interface AffixDef {
  key: string;
  label: string;
  /** Em quais itens o encantamento pode ir. */
  on: 'arma' | 'defesa';
  description: string;
  attack?: number;
  damage?: number;
  extraDamage?: string;
  ac?: number;
  abilities?: Partial<Record<Ability, number>>;
  resistances?: DamageType[];
  /** Metros a menos de deslocamento (encantamentos com preço). */
  speedPenalty?: number;
  lighter?: boolean;
}

export const AFFIXES: Record<string, AffixDef> = {
  // ───── Armas ─────
  de_fogo: { key: 'de_fogo', label: 'de Fogo', on: 'arma', description: '+1d4 de dano de fogo a cada acerto.', extraDamage: '1d4' },
  de_gelo: { key: 'de_gelo', label: 'de Gelo', on: 'arma', description: '+1d4 de dano de frio a cada acerto.', extraDamage: '1d4' },
  do_trovao: { key: 'do_trovao', label: 'do Trovão', on: 'arma', description: '+1d4 de dano elétrico a cada acerto.', extraDamage: '1d4' },
  da_precisao: { key: 'da_precisao', label: 'da Precisão', on: 'arma', description: '+1 extra para acertar.', attack: 1 },
  brutal: { key: 'brutal', label: 'Brutal', on: 'arma', description: '+3 de dano, mas −1 para acertar (golpes pesados).', attack: -1, damage: 3 },
  do_tita: { key: 'do_tita', label: 'do Titã', on: 'arma', description: '+1 em Força enquanto empunhada.', abilities: { forca: 1 } },
  da_raposa: { key: 'da_raposa', label: 'da Raposa', on: 'arma', description: '+1 em Destreza enquanto empunhada.', abilities: { destreza: 1 } },
  do_oraculo: { key: 'do_oraculo', label: 'do Oráculo', on: 'arma', description: '+1 em Sabedoria enquanto empunhada.', abilities: { sabedoria: 1 } },
  // ───── Armaduras e escudos ─────
  do_guardiao: { key: 'do_guardiao', label: 'do Guardião', on: 'defesa', description: '+1 extra na CA.', ac: 1 },
  da_fortaleza: { key: 'da_fortaleza', label: 'da Fortaleza', on: 'defesa', description: '+2 na CA, mas −1,5 m de deslocamento.', ac: 2, speedPenalty: 1.5 },
  contra_fogo: { key: 'contra_fogo', label: 'contra Fogo', on: 'defesa', description: 'Resistência a fogo (metade do dano).', resistances: ['fogo'] },
  contra_gelo: { key: 'contra_gelo', label: 'contra Gelo', on: 'defesa', description: 'Resistência a frio.', resistances: ['frio'] },
  contra_raios: { key: 'contra_raios', label: 'contra Raios', on: 'defesa', description: 'Resistência a dano elétrico.', resistances: ['eletrico'] },
  contra_veneno: { key: 'contra_veneno', label: 'contra Veneno', on: 'defesa', description: 'Resistência a veneno.', resistances: ['veneno'] },
  do_vigor: { key: 'do_vigor', label: 'do Vigor', on: 'defesa', description: '+1 em Constituição (mais PV e estamina).', abilities: { constituicao: 1 } },
  do_heroi: { key: 'do_heroi', label: 'do Herói', on: 'defesa', description: '+1 em Carisma.', abilities: { carisma: 1 } },
  da_leveza: { key: 'da_leveza', label: 'da Leveza', on: 'defesa', description: 'Sem desvantagem em Furtividade e +1 no limite de Destreza.', lighter: true },
};

const KEY_RE = /^([a-z0-9_]+?)(?:\+([0-9]))?(?:~([a-z_]+))?$/;

export interface ParsedItemKey { base: string; rank: number; affix: string | null }

export function parseItemKey(key: string): ParsedItemKey | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  return { base: m[1], rank: m[2] ? Number(m[2]) : 0, affix: m[3] ?? null };
}

/** Monta a chave de um item com rank/encantamento ("espada_longa+2~de_fogo"). */
export function rankedKey(base: string, rank = 0, affix?: string | null): string {
  return `${base}${rank > 0 ? `+${rank}` : ''}${affix ? `~${affix}` : ''}`;
}

export function rankOf(item: ItemDef | undefined): RankDef {
  return RANKS[Math.min(MAX_RANK, Math.max(0, item?.rank ?? 0))];
}

export function affixFits(affix: AffixDef, item: ItemDef) {
  return affix.on === 'arma' ? item.kind === 'arma' : item.kind === 'armadura' || item.kind === 'escudo';
}

/** Cria o ItemDef derivado (rank + encantamento) a partir do item base. */
export function deriveRankedItem(base: ItemDef, key: string, rank: number, affixKey: string | null): ItemDef | undefined {
  if (base.kind !== 'arma' && base.kind !== 'armadura' && base.kind !== 'escudo') return undefined;
  if (rank < 0 || rank > MAX_RANK) return undefined;
  const affix = affixKey ? AFFIXES[affixKey] : null;
  if (affixKey && (!affix || !affixFits(affix, base))) return undefined;
  const r = RANKS[rank];
  const name = `${base.name}${affix ? ` ${affix.label}` : ''}${rank ? ` +${r.bonus}` : ''}`;
  const extras: string[] = [];
  if (rank) extras.push(`Rank ${r.label}: +${base.kind === 'escudo' ? r.shieldBonus : r.bonus} ${base.kind === 'arma' ? 'para acertar e no dano' : 'na CA'}.`);
  if (affix) extras.push(`${affix.label[0].toUpperCase()}${affix.label.slice(1)}: ${affix.description}`);
  const common = {
    key, baseKey: base.key, name, rank, affix: affixKey ?? undefined,
    description: [base.description, ...extras].join(' '),
    value: Math.round(base.value * r.valueMult * (affix ? 1.5 : 1)),
    rarity: (rank >= 4 ? 'lendario' : rank >= 2 ? 'raro' : rank >= 1 || affix ? 'incomum' : base.rarity ?? 'comum') as ItemDef['rarity'],
    minLevel: Math.max(r.minLevel, base.minLevel ?? 1),
    abilityBonuses: affix?.abilities,
    resistances: affix?.resistances,
    speedPenalty: affix?.speedPenalty,
  };
  if (base.kind === 'arma') {
    const w = base as WeaponItem;
    return {
      ...w, ...common,
      attackBonus: (w.attackBonus ?? 0) + r.bonus + (affix?.attack ?? 0),
      damageBonus: (w.damageBonus ?? 0) + (affix?.damage ?? 0),
      extraDamage: affix?.extraDamage ?? w.extraDamage,
      extraDamageType: affix?.key === 'de_fogo' ? 'fogo' : affix?.key === 'de_gelo' ? 'frio' : affix?.key === 'do_trovao' ? 'eletrico' : w.extraDamageType,
    };
  }
  const a = base as ArmorItem;
  return {
    ...a, ...common,
    baseAC: a.baseAC + (a.kind === 'escudo' ? r.shieldBonus : r.bonus) + (affix?.ac ?? 0),
    maxDexBonus: affix?.lighter && a.maxDexBonus !== null ? a.maxDexBonus + 1 : a.maxDexBonus,
    stealthDisadvantage: affix?.lighter ? false : a.stealthDisadvantage,
  };
}
