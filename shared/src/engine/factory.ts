import { getClass } from '../content/classes';
import { getDivinity } from '../content/divinities';
import { ItemDef, WeaponItem, getItem, isShield, isWeapon } from '../content/items';
import { AttackDef, getMonster } from '../content/monsters';
import { averageOf, roll, Rng } from '../dice';
import { ABILITIES, AbilityScores, abilityModifier } from '../rules/abilities';
import { CharacterBuild, SQUARE_METERS, deriveStats } from '../rules/character';
import type { Token } from './types';

/** Dados mínimos de um personagem do banco para virar token na mesa. */
export interface CharacterSnapshot {
  id: string;
  userId: string;
  name: string;
  build: CharacterBuild;
  hp: number;
  stamina: number;
  inventory: { itemKey: string; quantity: number }[];
  /** Retrato (PortraitSpec) para o rosto no token. */
  face?: unknown;
}

const signed = (n: number) => (n === 0 ? '' : n > 0 ? `+${n}` : String(n));

export function weaponAttack(weapon: WeaponItem, mods: AbilityScores, proficiency: number, twoHanded: boolean, offHand = false): AttackDef {
  const ranged = weapon.properties.includes('distancia');
  let mod = ranged ? mods.destreza : mods.forca;
  if (weapon.properties.includes('acuidade')) mod = Math.max(mods.forca, mods.destreza);
  const dice = twoHanded && weapon.versatileDamage ? weapon.versatileDamage : weapon.damage;
  const dmgMod = offHand && mod > 0 ? 0 : mod;
  return {
    name: offHand ? `${weapon.name} (mão secundária)` : weapon.name,
    toHit: mod + proficiency + (weapon.attackBonus ?? 0),
    damage: `${dice}${signed(dmgMod + (weapon.attackBonus ?? 0))}`,
    damageType: weapon.damageType,
    range: weapon.range,
    longRange: weapon.longRange,
    bonusVsMonsters: weapon.bonusVsMonsters,
    ranged,
  };
}

export function characterAttacks(build: CharacterBuild, mods: AbilityScores, proficiency: number, custom?: Record<string, ItemDef>): AttackDef[] {
  const main = build.equipment.mainHand ? getItem(build.equipment.mainHand, custom) : undefined;
  const off = build.equipment.offHand ? getItem(build.equipment.offHand, custom) : undefined;
  const shield = build.equipment.shield ? getItem(build.equipment.shield, custom) : undefined;
  const attacks: AttackDef[] = [];
  if (isWeapon(main)) attacks.push(weaponAttack(main, mods, proficiency, !off && !isShield(shield)));
  if (isWeapon(off)) attacks.push(weaponAttack(off, mods, proficiency, false, true));
  attacks.push({
    name: 'Ataque Desarmado', toHit: mods.forca + proficiency, damage: String(Math.max(1, 1 + mods.forca)),
    damageType: 'concussao', range: 1,
  });
  return attacks;
}

const COLORS = ['#e9b949', '#4fb3bf', '#c06cdb', '#6cc070', '#f07c5a', '#5a8ff0', '#f05aa8', '#b0b0b0'];

export function tokenFromCharacter(c: CharacterSnapshot, x: number, y: number, index = 0, custom?: Record<string, ItemDef>): Token {
  const stats = deriveStats(c.build, custom);
  const divinity = getDivinity(c.build.divinity);
  const consumables: Record<string, number> = {};
  for (const i of c.inventory) {
    if (getItem(i.itemKey, custom)?.kind === 'consumivel') consumables[i.itemKey] = (consumables[i.itemKey] ?? 0) + i.quantity;
  }
  return {
    id: `tok_${c.id}`,
    kind: 'personagem',
    name: c.name,
    ownerUserId: c.userId,
    characterId: c.id,
    x, y,
    hp: Math.min(c.hp, stats.maxHp),
    maxHp: stats.maxHp,
    tempHp: 0,
    ac: stats.armorClass,
    speed: stats.speedSquares,
    stamina: Math.min(c.stamina, stats.maxStamina),
    maxStamina: stats.maxStamina,
    initiativeBonus: stats.initiativeBonus,
    abilityMods: stats.modifiers,
    proficiency: stats.proficiencyBonus,
    attacks: characterAttacks(c.build, stats.modifiers, stats.proficiencyBonus, custom),
    resistances: stats.resistances,
    conditionAdvantage: stats.conditionAdvantage,
    conditions: [],
    power: divinity?.power ?? null,
    consumables,
    hidden: false,
    dead: false,
    color: COLORS[index % COLORS.length],
    portrait: `classe:${c.build.classKey}`,
    emblem: divinity?.symbol,
    skills: stats.skillProficiencies,
    saves: [...(getClass(c.build.classKey)?.savingThrows ?? [])],
    level: c.build.level,
    face: c.face ?? undefined,
  };
}

export function createMonsterToken(monsterKey: string, x: number, y: number, id: string, opts: { hidden?: boolean; rng?: Rng; rollHp?: boolean; name?: string } = {}): Token {
  const m = getMonster(monsterKey);
  if (!m) throw new Error(`Monstro desconhecido: ${monsterKey}`);
  const mods = Object.fromEntries(ABILITIES.map((a) => [a, abilityModifier(m.abilities[a])])) as AbilityScores;
  const hp = opts.rollHp && opts.rng ? Math.max(1, roll(m.hp, opts.rng).total) : Math.max(1, Math.floor(averageOf(m.hp)));
  const cr = m.cr.includes('/') ? 0 : Number(m.cr);
  return {
    id,
    kind: 'monstro',
    name: opts.name ?? m.label,
    ownerUserId: null,
    monsterKey,
    x, y,
    hp, maxHp: hp, tempHp: 0,
    ac: m.ac,
    speed: Math.floor(m.speed / SQUARE_METERS),
    stamina: 0, maxStamina: 0,
    initiativeBonus: mods.destreza,
    abilityMods: mods,
    proficiency: 2 + Math.floor(Math.max(0, cr - 1) / 4),
    attacks: m.attacks,
    resistances: m.resistances ?? [],
    conditionAdvantage: [],
    conditions: [],
    power: null,
    consumables: {},
    hidden: opts.hidden ?? false,
    dead: false,
    color: '#7f1d1d',
    portrait: `monstro:${monsterKey}`,
  };
}
