import { averageOf } from '../dice';
import { getItem, type ItemDef } from '../content/items';
import { characterAttacks } from '../engine/factory';
import { ABILITIES, ABILITY_LABELS } from './abilities';
import { canUseItem, deriveStats, type CharacterBuild, type Equipment, type EquipmentSlot } from './character';

export interface StatDelta {
  label: string;
  before: string;
  after: string;
  /** > 0 melhora, < 0 piora, 0 = só muda. */
  delta: number;
}

export interface EquipComparison {
  slot: EquipmentSlot | null;
  allowed: boolean;
  reasons: string[];
  deltas: StatDelta[];
  /** Soma ponderada das mudanças: positivo = upgrade. */
  score: number;
}

/** Em qual espaço o item iria (armas vão na mão principal). */
export function slotFor(item: ItemDef | undefined): EquipmentSlot | null {
  if (!item) return null;
  if (item.kind === 'arma') return 'mainHand';
  if (item.kind === 'armadura') return 'armor';
  if (item.kind === 'escudo') return 'shield';
  return null;
}

/**
 * Compara a ficha atual com a ficha usando o item (como as setas ▲▼ dos RPGs de PC).
 * Mostra CA, acerto, dano médio, atributos, resistências e deslocamento.
 */
export function compareEquip(build: CharacterBuild, itemKey: string, custom?: Record<string, ItemDef>, slotOverride?: EquipmentSlot): EquipComparison {
  const item = getItem(itemKey, custom);
  const slot = slotOverride ?? slotFor(item);
  if (!item || !slot) return { slot, allowed: false, reasons: ['Não é equipável'], deltas: [], score: 0 };
  const check = canUseItem(build, item, custom);
  const nextEq: Equipment = { ...build.equipment, [slot]: itemKey };
  if (item.kind === 'arma' && item.properties.includes('duas_maos')) { delete nextEq.offHand; delete nextEq.shield; }
  if (slot === 'shield') {
    const main = build.equipment.mainHand ? getItem(build.equipment.mainHand, custom) : undefined;
    if (main?.kind === 'arma' && main.properties.includes('duas_maos')) delete nextEq.mainHand;
  }
  const next: CharacterBuild = { ...build, equipment: nextEq };
  const a = deriveStats(build, custom);
  const b = deriveStats(next, custom);
  const deltas: StatDelta[] = [];
  const push = (label: string, x: number, y: number, fmt = (n: number) => String(n), weight = 1) => {
    if (x !== y) deltas.push({ label, before: fmt(x), after: fmt(y), delta: (y - x) * weight });
  };
  push('CA', a.armorClass, b.armorClass, undefined, 3);
  const atkA = characterAttacks(build, a.modifiers, a.proficiencyBonus, custom)[0];
  const atkB = characterAttacks(next, b.modifiers, b.proficiencyBonus, custom)[0];
  push('Acerto', atkA.toHit, atkB.toHit, (n) => (n >= 0 ? `+${n}` : String(n)), 2);
  push('Dano médio', Math.round(averageOf(atkA.damage) * 10) / 10, Math.round(averageOf(atkB.damage) * 10) / 10, (n) => n.toFixed(1), 1);
  if (atkA.range !== atkB.range) push('Alcance', atkA.range, atkB.range, (n) => `${n * 1.5} m`, 0);
  for (const ab of ABILITIES) push(ABILITY_LABELS[ab].label, a.abilities[ab], b.abilities[ab], undefined, 1.5);
  push('PV máx.', a.maxHp, b.maxHp, undefined, 0.5);
  push('Deslocamento', a.speed, b.speed, (n) => `${n} m`, 1);
  const gained = b.resistances.filter((r) => !a.resistances.includes(r));
  const lost = a.resistances.filter((r) => !b.resistances.includes(r));
  for (const r of gained) deltas.push({ label: `Resistência a ${r}`, before: '—', after: '✓', delta: 2 });
  for (const r of lost) deltas.push({ label: `Resistência a ${r}`, before: '✓', after: '—', delta: -2 });
  return { slot, allowed: check.allowed, reasons: check.reasons, deltas, score: deltas.reduce((s, d) => s + d.delta, 0) };
}
