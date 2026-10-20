import {
  ARMORS,
  ArmorKey,
  Attributes,
  CLASSES,
  ClassDefinition,
  ClassKey,
  WEAPONS,
  WeaponKey,
  attributeModifier,
} from './gameData';

export interface Equipment {
  mainHand?: WeaponKey | null;
  offHand?: WeaponKey | null;
  armor?: ArmorKey | null;
  shield?: ArmorKey | null;
}

export interface EquipmentViolation {
  slot: keyof Equipment;
  item: string;
  reason: string;
}

export function isWeaponKey(v: unknown): v is WeaponKey {
  return typeof v === 'string' && v in WEAPONS;
}

export function isArmorKey(v: unknown): v is ArmorKey {
  return typeof v === 'string' && v in ARMORS;
}

export function canUseWeapon(classKey: ClassKey, weapon: WeaponKey): boolean {
  const cls: ClassDefinition = CLASSES[classKey];
  const w = WEAPONS[weapon];
  return cls.weaponCategoryProficiencies.includes(w.category) || cls.weaponProficiencies.includes(weapon);
}

export function canUseArmor(classKey: ClassKey, armor: ArmorKey): { ok: boolean; reason?: string } {
  const cls: ClassDefinition = CLASSES[classKey];
  const a = ARMORS[armor];
  if (!cls.armorProficiencies.includes(a.category)) {
    return { ok: false, reason: `${cls.label} não tem proficiência em armadura ${a.category}` };
  }
  if (cls.forbidsMetalArmor && a.metal) {
    return { ok: false, reason: `${cls.label} não pode usar itens de metal` };
  }
  return { ok: true };
}

/**
 * Valida o equipamento de uma ficha contra as restrições da classe.
 * Retorna a lista de violações (vazia = válido).
 */
export function validateEquipment(
  classKey: ClassKey,
  equipment: Equipment,
  attributes: Attributes,
): EquipmentViolation[] {
  const violations: EquipmentViolation[] = [];
  const cls = CLASSES[classKey];

  for (const slot of ['mainHand', 'offHand'] as const) {
    const item = equipment[slot];
    if (!item) continue;
    if (!isWeaponKey(item)) {
      violations.push({ slot, item, reason: 'Arma desconhecida' });
      continue;
    }
    if (!canUseWeapon(classKey, item)) {
      violations.push({ slot, item, reason: `${cls.label} não tem proficiência com ${WEAPONS[item].label}` });
    }
  }

  // Arma de duas mãos impede mão secundária e escudo
  const main = equipment.mainHand;
  if (main && isWeaponKey(main) && (WEAPONS[main].properties as readonly string[]).includes('duas_maos')) {
    if (equipment.offHand) {
      violations.push({ slot: 'offHand', item: equipment.offHand, reason: 'Arma de duas mãos ocupa a mão secundária' });
    }
    if (equipment.shield) {
      violations.push({ slot: 'shield', item: equipment.shield, reason: 'Não é possível usar escudo com arma de duas mãos' });
    }
  }

  // Duas armas: a secundária precisa ser leve
  if (equipment.offHand && isWeaponKey(equipment.offHand)) {
    const props = WEAPONS[equipment.offHand].properties as readonly string[];
    if (!props.includes('leve')) {
      violations.push({ slot: 'offHand', item: equipment.offHand, reason: 'A arma da mão secundária precisa ser leve' });
    }
    if (equipment.shield) {
      violations.push({ slot: 'shield', item: equipment.shield, reason: 'Não é possível usar escudo e arma na mão secundária' });
    }
  }

  if (equipment.armor) {
    const armor = equipment.armor;
    if (!isArmorKey(armor) || ARMORS[armor].category === 'escudo') {
      violations.push({ slot: 'armor', item: armor, reason: 'Armadura inválida' });
    } else {
      const check = canUseArmor(classKey, armor);
      if (!check.ok) violations.push({ slot: 'armor', item: armor, reason: check.reason! });
      const req = (ARMORS[armor] as { strengthRequirement?: number }).strengthRequirement;
      if (req && attributes.forca < req) {
        violations.push({ slot: 'armor', item: armor, reason: `Requer Força ${req}` });
      }
    }
  }

  if (equipment.shield) {
    const shield = equipment.shield;
    if (!isArmorKey(shield) || ARMORS[shield].category !== 'escudo') {
      violations.push({ slot: 'shield', item: shield, reason: 'Escudo inválido' });
    } else {
      const check = canUseArmor(classKey, shield);
      if (!check.ok) violations.push({ slot: 'shield', item: shield, reason: check.reason! });
    }
  }

  return violations;
}

/** Calcula a Classe de Armadura (CA) com base no equipamento. */
export function calculateArmorClass(equipment: Equipment, attributes: Attributes): number {
  const dex = attributeModifier(attributes.destreza);
  let ac = 10 + dex;

  if (equipment.armor && isArmorKey(equipment.armor)) {
    const a = ARMORS[equipment.armor];
    const dexBonus = a.maxDexBonus === null ? dex : Math.min(dex, a.maxDexBonus);
    ac = a.baseAC + dexBonus;
  }
  if (equipment.shield && isArmorKey(equipment.shield)) {
    ac += ARMORS[equipment.shield].baseAC;
  }
  return ac;
}
