import type { LootEntry } from '../engine/types';
import type { Rng } from '../dice';
import { AFFIXES, affixFits, rankedKey } from './gear';
import { ITEMS } from './items';

/** Chance de sair uma arma/armadura com rank em cada tabela. */
export const GEAR_DROPS = {
  comum: { chance: 0.35, ranks: [1, 1], affixChance: 0.2 },
  incomum: { chance: 0.75, ranks: [1, 2], affixChance: 0.45 },
  raro: { chance: 1, ranks: [2, 3], affixChance: 0.75 },
} as const;

/** Sorteia uma arma ou armadura comum do catálogo com rank (e talvez encantamento). */
export function rollGear(tier: keyof typeof GEAR_DROPS, rng: Rng): string {
  const g = GEAR_DROPS[tier];
  const pool = Object.values(ITEMS).filter((i) => (i.kind === 'arma' || i.kind === 'armadura' || i.kind === 'escudo') && (!i.rarity || i.rarity === 'comum') && i.key !== 'funda');
  const base = pool[Math.floor(rng() * pool.length)];
  const rank = g.ranks[0] + Math.floor(rng() * (g.ranks[1] - g.ranks[0] + 1));
  let affix: string | null = null;
  if (rng() < g.affixChance) {
    const fits = Object.values(AFFIXES).filter((a) => affixFits(a, base));
    affix = fits[Math.floor(rng() * fits.length)]?.key ?? null;
  }
  return rankedKey(base.key, rank, affix);
}

/** Tabelas de tesouro para baús aleatórios (o Mestre também pode montar o conteúdo à mão). */
export const LOOT_TABLES = {
  comum: {
    label: 'Comum (nível 1–2)',
    dracmas: [5, 20],
    picks: 2,
    items: [
      { itemKey: 'pocao_cura', weight: 5, quantity: [1, 2] },
      { itemKey: 'tocha', weight: 3, quantity: [1, 3] },
      { itemKey: 'corda', weight: 2, quantity: [1, 1] },
      { itemKey: 'adaga', weight: 2, quantity: [1, 1] },
      { itemKey: 'dardo', weight: 2, quantity: [2, 5] },
      { itemKey: 'nectar', weight: 1, quantity: [1, 1] },
    ],
  },
  incomum: {
    label: 'Incomum (nível 3–4)',
    dracmas: [20, 60],
    picks: 3,
    items: [
      { itemKey: 'pocao_cura', weight: 5, quantity: [1, 3] },
      { itemKey: 'ambrosia', weight: 3, quantity: [1, 2] },
      { itemKey: 'nectar', weight: 3, quantity: [1, 2] },
      { itemKey: 'espada_bronze_celestial', weight: 2, quantity: [1, 1] },
      { itemKey: 'peitoral_bronze', weight: 1, quantity: [1, 1] },
      { itemKey: 'escudo_bronze', weight: 2, quantity: [1, 1] },
    ],
  },
  raro: {
    label: 'Raro (chefe / fim de capítulo)',
    dracmas: [60, 150],
    picks: 3,
    items: [
      { itemKey: 'ambrosia', weight: 4, quantity: [1, 3] },
      { itemKey: 'nectar', weight: 4, quantity: [1, 3] },
      { itemKey: 'arco_de_apolo', weight: 1, quantity: [1, 1] },
      { itemKey: 'lanca_adamante', weight: 1, quantity: [1, 1] },
      { itemKey: 'tridente_mares', weight: 1, quantity: [1, 1] },
      { itemKey: 'martelo_forja', weight: 1, quantity: [1, 1] },
      { itemKey: 'peitoral_bronze', weight: 2, quantity: [1, 1] },
    ],
  },
} as const;

export type LootTier = keyof typeof LOOT_TABLES;

function between(rng: Rng, [a, b]: readonly [number, number]) {
  return a + Math.floor(rng() * (b - a + 1));
}

export function rollLoot(tier: LootTier, rng: Rng): { loot: LootEntry[]; dracmas: number } {
  const t = LOOT_TABLES[tier];
  const pool = [...t.items];
  const loot: LootEntry[] = [];
  for (let i = 0; i < t.picks && pool.length; i++) {
    const total = pool.reduce((s, x) => s + x.weight, 0);
    let r = rng() * total;
    const idx = pool.findIndex((x) => (r -= x.weight) < 0);
    const pick = pool.splice(idx < 0 ? 0 : idx, 1)[0];
    loot.push({ itemKey: pick.itemKey, quantity: between(rng, pick.quantity) });
  }
  if (rng() < GEAR_DROPS[tier].chance) loot.push({ itemKey: rollGear(tier, rng), quantity: 1 });
  return { loot, dracmas: between(rng, t.dracmas) };
}
