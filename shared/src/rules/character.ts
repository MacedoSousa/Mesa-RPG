import { z } from 'zod';
import { CLASSES, CLASS_KEYS, ClassDef, getClass } from '../content/classes';
import { AFFINITY_MAX, AFFINITY_MIN, DIVINITY_KEYS, DivinityDef, affinityTier, getDivinity } from '../content/divinities';
import {
  ArmorItem, DamageType, ItemDef, WeaponItem, getItem, isArmor, isShield, isWeapon,
} from '../content/items';
import { RACE_KEYS, RaceDef, getRace } from '../content/races';
import {
  ABILITIES, ABILITY_CAP, ABILITY_LABELS, Ability, AbilityScores, SKILLS, SKILL_KEYS, Skill,
  abilityModifier, proficiencyBonus, validatePointBuy,
} from './abilities';

// ───────────────────────────── Entrada ─────────────────────────────

export const EQUIPMENT_SLOTS = ['mainHand', 'offHand', 'armor', 'shield'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export type Equipment = Partial<Record<EquipmentSlot, string | null>>;

export interface InventoryEntry {
  itemKey: string;
  quantity: number;
}

const abilityScoresSchema = z.object(
  Object.fromEntries(ABILITIES.map((a) => [a, z.number().int()])) as Record<Ability, z.ZodNumber>,
);

export const characterCreationSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(60),
  race: z.enum(RACE_KEYS as [string, ...string[]]),
  divinity: z.enum(DIVINITY_KEYS as [string, ...string[]]),
  classKey: z.enum(CLASS_KEYS as [string, ...string[]]),
  baseAbilities: abilityScoresSchema,
  skills: z.array(z.enum(SKILL_KEYS as [string, ...string[]])).default([]),
  equipment: z
    .object({
      mainHand: z.string().nullable().optional(),
      offHand: z.string().nullable().optional(),
      armor: z.string().nullable().optional(),
      shield: z.string().nullable().optional(),
    })
    .default({}),
  inventory: z.array(z.object({ itemKey: z.string(), quantity: z.number().int().min(1).max(999) })).default([]),
  backstory: z.string().max(10_000).optional(),
});
export type CharacterCreationInput = z.infer<typeof characterCreationSchema>;

/** Estado de um personagem já criado (vindo do banco). */
export interface CharacterBuild {
  race: string;
  divinity: string;
  classKey: string;
  level: number;
  affinity: number;
  baseAbilities: AbilityScores;
  skills: string[];
  equipment: Equipment;
}

// ───────────────────────────── Derivados ─────────────────────────────

export interface DerivedStats {
  abilities: AbilityScores;
  modifiers: AbilityScores;
  proficiencyBonus: number;
  maxHp: number;
  maxStamina: number;
  armorClass: number;
  speed: number; // metros
  speedSquares: number;
  initiativeBonus: number;
  darkvision: number;
  resistances: DamageType[];
  skillProficiencies: string[];
  weaponProficiencies: string[];
  conditionAdvantage: string[];
  affinityTier: string;
}

export const SQUARE_METERS = 1.5;

function defs(build: Pick<CharacterBuild, 'race' | 'divinity' | 'classKey'>) {
  const race = getRace(build.race);
  const divinity = getDivinity(build.divinity);
  const cls = getClass(build.classKey);
  if (!race) throw new Error(`Raça desconhecida: ${build.race}`);
  if (!divinity) throw new Error(`Divindade desconhecida: ${build.divinity}`);
  if (!cls) throw new Error(`Classe desconhecida: ${build.classKey}`);
  return { race, divinity, cls };
}

/** Base do point-buy + bônus de raça + atributo favorecido do pai divino (+1). */
export function finalAbilities(base: AbilityScores, race: RaceDef, divinity: DivinityDef): AbilityScores {
  const out = { ...base };
  for (const [k, v] of Object.entries(race.abilityBonuses)) out[k as Ability] += v ?? 0;
  if (divinity.favoredAbility) out[divinity.favoredAbility] += 1;
  for (const a of ABILITIES) out[a] = Math.min(ABILITY_CAP, out[a]);
  return out;
}

export function calculateMaxHp(cls: ClassDef, level: number, conMod: number, bonusPerLevel: number): number {
  const perLevel = Math.floor(cls.hitDie / 2) + 1;
  return Math.max(1, cls.hitDie + conMod + (level - 1) * (perLevel + conMod) + bonusPerLevel * level);
}

export function calculateArmorClass(equipment: Equipment, dexMod: number, bonus = 0, custom?: Record<string, ItemDef>): number {
  let ac = 10 + dexMod;
  const armor = equipment.armor ? getItem(equipment.armor, custom) : undefined;
  if (isArmor(armor)) {
    const dex = armor.maxDexBonus === null ? dexMod : Math.min(dexMod, armor.maxDexBonus);
    ac = armor.baseAC + dex;
  }
  const shield = equipment.shield ? getItem(equipment.shield, custom) : undefined;
  if (isShield(shield)) ac += shield.baseAC;
  return ac + bonus;
}

export function deriveStats(build: CharacterBuild, custom?: Record<string, ItemDef>): DerivedStats {
  const { race, divinity, cls } = defs(build);
  const abilities = finalAbilities(build.baseAbilities, race, divinity);
  const modifiers = Object.fromEntries(ABILITIES.map((a) => [a, abilityModifier(abilities[a])])) as AbilityScores;
  const r = race.mechanics;
  const d = divinity.blessing.mechanics;
  const sum = (k: 'hpBonusPerLevel' | 'acBonus' | 'speedBonus' | 'initiativeBonus' | 'staminaBonus') => (r[k] ?? 0) + (d[k] ?? 0);
  const speed = race.speed + sum('speedBonus');

  return {
    abilities,
    modifiers,
    proficiencyBonus: proficiencyBonus(build.level),
    maxHp: calculateMaxHp(cls, build.level, modifiers.constituicao, sum('hpBonusPerLevel')),
    maxStamina: Math.max(1, cls.staminaBase + modifiers.constituicao * 2 + sum('staminaBonus') + (build.level - 1) * 2),
    armorClass: calculateArmorClass(build.equipment, modifiers.destreza, sum('acBonus'), custom),
    speed,
    speedSquares: Math.floor(speed / SQUARE_METERS),
    initiativeBonus: modifiers.destreza + sum('initiativeBonus'),
    darkvision: Math.max(r.darkvision ?? 0, d.darkvision ?? 0),
    resistances: [...new Set([...(r.resistances ?? []), ...(d.resistances ?? [])])],
    skillProficiencies: [...new Set([...build.skills, ...(r.skillProficiencies ?? []), ...(d.skillProficiencies ?? [])])],
    weaponProficiencies: [...new Set([...cls.weaponProficiencies, ...(r.weaponProficiencies ?? []), ...(d.weaponProficiencies ?? [])])],
    conditionAdvantage: [...new Set([...(r.conditionAdvantage ?? []), ...(d.conditionAdvantage ?? [])])],
    affinityTier: affinityTier(build.affinity),
  };
}

// ───────────────────────────── Restrições de itens ─────────────────────────────

export interface EquipCheck {
  allowed: boolean;
  reasons: string[];
}

/**
 * Verifica se o personagem pode usar/equipar o item.
 * No Mesa RPG, item sem proficiência fica BLOQUEADO (mais simples para novatos que a penalidade do 5e).
 */
export function canUseItem(build: CharacterBuild, item: ItemDef, custom?: Record<string, ItemDef>): EquipCheck {
  const { race, divinity, cls } = defs(build);
  const stats = deriveStats(build, custom);
  const reasons: string[] = [];
  const req = item.requirements;

  if (req?.minAbilities) {
    for (const [a, min] of Object.entries(req.minAbilities)) {
      if (stats.abilities[a as Ability] < (min ?? 0)) reasons.push(`Requer ${ABILITY_LABELS[a as Ability].label} ${min}`);
    }
  }
  if (req?.divinities?.length && !req.divinities.includes(build.divinity)) {
    const names = req.divinities.map((k) => getDivinity(k)?.label ?? k).join(' ou ');
    reasons.push(`Apenas para quem é ligado a ${names}`);
  }
  if (req?.minAffinity && build.affinity < req.minAffinity) reasons.push(`Requer afinidade divina ${req.minAffinity} (atual: ${build.affinity})`);
  if (req?.races?.length && !req.races.includes(build.race)) reasons.push(`Restrito às raças: ${req.races.map((k) => getRace(k)?.label ?? k).join(', ')}`);
  if (req?.forbiddenRaces?.includes(build.race)) reasons.push(`${race.label} não pode usar este item`);

  if (isWeapon(item)) {
    const proficient = cls.weaponCategoryProficiencies.includes(item.category) || stats.weaponProficiencies.includes(item.key);
    if (!proficient) reasons.push(`${cls.label} não tem proficiência com ${item.name} (arma ${item.category})`);
  }
  if (isArmor(item) || isShield(item)) {
    const a = item as ArmorItem;
    if (!cls.armorProficiencies.includes(a.category)) {
      reasons.push(a.category === 'escudo' ? `${cls.label} não sabe usar escudos` : `${cls.label} não tem proficiência em armadura ${a.category}`);
    }
    if (cls.forbidsMetalArmor && a.metal) reasons.push(`${cls.label} recusa armaduras e escudos de metal`);
    if (a.strengthRequirement && stats.abilities.forca < a.strengthRequirement) reasons.push(`Requer Força ${a.strengthRequirement}`);
  }
  void divinity;
  return { allowed: reasons.length === 0, reasons };
}

export interface EquipmentViolation {
  slot: EquipmentSlot;
  itemKey: string;
  reason: string;
}

/** Valida todos os slots equipados e as regras de mãos (duas mãos, arma leve, escudo). */
export function validateEquipment(build: CharacterBuild, custom?: Record<string, ItemDef>): EquipmentViolation[] {
  const out: EquipmentViolation[] = [];
  const eq = build.equipment;
  const get = (k?: string | null) => (k ? getItem(k, custom) : undefined);

  const expected: Record<EquipmentSlot, (i: ItemDef) => boolean> = {
    mainHand: isWeapon, offHand: isWeapon, armor: isArmor, shield: isShield,
  };

  for (const slot of EQUIPMENT_SLOTS) {
    const key = eq[slot];
    if (!key) continue;
    const item = get(key);
    if (!item) {
      out.push({ slot, itemKey: key, reason: 'Item desconhecido' });
      continue;
    }
    if (!expected[slot](item)) {
      out.push({ slot, itemKey: key, reason: `${item.name} não pode ir neste espaço` });
      continue;
    }
    for (const reason of canUseItem(build, item, custom).reasons) out.push({ slot, itemKey: key, reason });
  }

  const main = get(eq.mainHand) as WeaponItem | undefined;
  const off = get(eq.offHand) as WeaponItem | undefined;
  if (isWeapon(main) && main.properties.includes('duas_maos')) {
    if (eq.offHand) out.push({ slot: 'offHand', itemKey: eq.offHand, reason: 'Arma de duas mãos ocupa a mão secundária' });
    if (eq.shield) out.push({ slot: 'shield', itemKey: eq.shield, reason: 'Não dá para usar escudo com arma de duas mãos' });
  }
  if (isWeapon(off)) {
    if (!off.properties.includes('leve')) out.push({ slot: 'offHand', itemKey: off.key, reason: 'A arma da mão secundária precisa ser leve' });
    if (eq.shield) out.push({ slot: 'shield', itemKey: eq.shield, reason: 'Escudo e arma na mão secundária ao mesmo tempo' });
  }
  return out;
}

/** Status de cada item do inventário para a UI (bloqueado visualmente quando não permitido). */
export function inventoryStatus(build: CharacterBuild, itemKeys: string[], custom?: Record<string, ItemDef>) {
  return itemKeys.map((key) => {
    const item = getItem(key, custom);
    if (!item) return { itemKey: key, allowed: false, reasons: ['Item desconhecido'] };
    return { itemKey: key, ...canUseItem(build, item, custom) };
  });
}

// ───────────────────────────── Criação completa ─────────────────────────────

export interface CreationValidation {
  ok: boolean;
  errors: string[];
  violations: EquipmentViolation[];
  stats?: DerivedStats;
}

export function validateCharacterCreation(input: CharacterCreationInput, custom?: Record<string, ItemDef>): CreationValidation {
  const errors: string[] = [];
  const race = getRace(input.race)!;
  const divinity = getDivinity(input.divinity)!;
  const cls = getClass(input.classKey)!;

  // Passo 1 → 2: a raça pode restringir as divindades
  if (race.allowedDivinities && !race.allowedDivinities.includes(input.divinity)) {
    const names = race.allowedDivinities.map((k) => getDivinity(k)?.label ?? k).join(', ');
    errors.push(`${race.label} só pode ter como patrono: ${names}`);
  }

  // Passo 3: point-buy e perícias
  const pb = validatePointBuy(input.baseAbilities);
  errors.push(...pb.errors);

  const granted = new Set([...(race.mechanics.skillProficiencies ?? []), ...(divinity.blessing.mechanics.skillProficiencies ?? [])]);
  const chosen = input.skills.filter((s) => !granted.has(s as Skill));
  if (new Set(input.skills).size !== input.skills.length) errors.push('Perícias repetidas');
  const invalid = chosen.filter((s) => !(cls.skillChoices.from as readonly string[]).includes(s));
  if (invalid.length) errors.push(`Perícias fora da lista de ${cls.label}: ${invalid.map((s) => SKILLS[s as Skill].label).join(', ')}`);
  if (chosen.length !== cls.skillChoices.count) errors.push(`${cls.label} escolhe exatamente ${cls.skillChoices.count} perícias da classe (você escolheu ${chosen.length})`);

  // Passo 4: inventário e equipamento
  const inventoryKeys = new Set(input.inventory.map((i) => i.itemKey));
  for (const i of input.inventory) if (!getItem(i.itemKey, custom)) errors.push(`Item desconhecido: ${i.itemKey}`);
  for (const slot of EQUIPMENT_SLOTS) {
    const key = input.equipment[slot];
    if (key && !inventoryKeys.has(key)) errors.push(`Item equipado em ${slot} precisa estar no inventário`);
  }

  const build: CharacterBuild = {
    race: input.race, divinity: input.divinity, classKey: input.classKey, level: 1,
    affinity: divinity.startingAffinity, baseAbilities: input.baseAbilities, skills: input.skills, equipment: input.equipment,
  };
  const violations = pb.ok ? validateEquipment(build, custom) : [];
  const stats = pb.ok ? deriveStats(build, custom) : undefined;
  return { ok: errors.length === 0 && violations.length === 0, errors, violations, stats };
}

export { AFFINITY_MAX, AFFINITY_MIN, CLASSES };
