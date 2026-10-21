import { z } from 'zod';
import {
  AFFINITY_MAX, AFFINITY_MIN, CLASSES, CharacterBuild, CharacterCreationInput, CharacterSnapshot, DIVINITIES, EQUIPMENT_SLOTS,
  EquipmentSlot, ItemDef, RACES, affinityTier, characterCreationSchema, deriveStats, getDivinity, getItem, inventoryStatus,
  validateCharacterCreation, validateEquipment,
} from '@mesa/shared';
import type { Transaction } from 'sequelize';
import { sequelize } from '../config/database';
import { Character, CharacterSheet, InventoryItem } from '../models';
import { HttpError } from '../utils/HttpError';
import { ItemService } from './itemService';

export const updateCharacterSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  sheet: z.object({
    backstory: z.string().max(10_000).optional(),
    personality: z.string().max(2000).optional(),
    appearance: z.string().max(2000).optional(),
    notes: z.string().max(10_000).optional(),
    languages: z.array(z.string().max(30)).max(10).optional(),
  }).optional(),
});

export const equipSchema = z.object({
  slot: z.enum(EQUIPMENT_SLOTS),
  itemKey: z.string().max(60).nullable(),
});

const INCLUDE = [
  { model: CharacterSheet, as: 'sheet' },
  { model: InventoryItem, as: 'inventory' },
];

export function buildOf(c: Character): CharacterBuild {
  return {
    race: c.race, divinity: c.divinity, classKey: c.classKey, level: c.level, affinity: c.affinity,
    baseAbilities: c.baseAbilities, skills: c.skills, equipment: c.equipment ?? {},
  };
}

export function serializeCharacter(c: Character, custom: Record<string, ItemDef> = {}) {
  const build = buildOf(c);
  const stats = deriveStats(build, custom);
  const inventory = (c.inventory ?? []).filter((i) => i.quantity > 0);
  const status = inventoryStatus(build, inventory.map((i) => i.itemKey), custom);
  return {
    id: c.id,
    userId: c.userId,
    campaignId: c.campaignId,
    name: c.name,
    race: c.race,
    raceLabel: RACES[c.race as keyof typeof RACES]?.label ?? c.race,
    divinity: c.divinity,
    divinityLabel: DIVINITIES[c.divinity as keyof typeof DIVINITIES]?.label ?? c.divinity,
    classKey: c.classKey,
    classLabel: CLASSES[c.classKey as keyof typeof CLASSES]?.label ?? c.classKey,
    level: c.level,
    experience: c.experience,
    affinity: c.affinity,
    affinityTier: affinityTier(c.affinity),
    baseAbilities: c.baseAbilities,
    skills: c.skills,
    equipment: build.equipment,
    hp: Math.min(c.hp, stats.maxHp),
    stamina: Math.min(c.stamina, stats.maxStamina),
    stats,
    inventory: inventory.map((i, idx) => ({
      itemKey: i.itemKey,
      quantity: i.quantity,
      item: getItem(i.itemKey, custom) ?? null,
      allowed: status[idx].allowed,
      reasons: status[idx].reasons,
    })),
    sheet: c.sheet
      ? { backstory: c.sheet.backstory, personality: c.sheet.personality, appearance: c.sheet.appearance, notes: c.sheet.notes, languages: c.sheet.languages }
      : null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    deletedAt: c.deletedAt,
  };
}

export const CharacterService = {
  async create(userId: string, input: CharacterCreationInput) {
    const data = characterCreationSchema.parse(input);
    const result = validateCharacterCreation(data);
    if (!result.ok) throw new HttpError(422, 'Ficha inválida', { errors: result.errors, violations: result.violations });
    const stats = result.stats!;
    const divinity = getDivinity(data.divinity)!;

    const id = await sequelize.transaction(async (transaction) => {
      const character = await Character.create({
        userId,
        campaignId: null,
        name: data.name,
        race: data.race,
        divinity: data.divinity,
        classKey: data.classKey,
        affinity: divinity.startingAffinity,
        baseAbilities: data.baseAbilities,
        skills: data.skills,
        equipment: data.equipment,
        hp: stats.maxHp,
        stamina: stats.maxStamina,
      }, { transaction });
      await CharacterSheet.create({ characterId: character.id, backstory: data.backstory ?? '' }, { transaction });
      const merged = new Map<string, number>();
      for (const i of data.inventory) merged.set(i.itemKey, (merged.get(i.itemKey) ?? 0) + i.quantity);
      await InventoryItem.bulkCreate([...merged].map(([itemKey, quantity]) => ({ characterId: character.id, itemKey, quantity })), { transaction });
      return character.id;
    });
    return this.get(userId, id);
  },

  async list(userId: string, includeDeleted = false) {
    const rows = await Character.findAll({
      where: { userId }, include: INCLUDE, paranoid: !includeDeleted, order: [['createdAt', 'DESC']],
    });
    return rows.map((c) => serializeCharacter(c));
  },

  async findOwned(userId: string, id: string, opts: { transaction?: Transaction } = {}) {
    const c = await Character.findOne({ where: { id, userId }, include: INCLUDE, transaction: opts.transaction });
    if (!c) throw new HttpError(404, 'Personagem não encontrado');
    return c;
  },

  async get(userId: string, id: string) {
    const c = await this.findOwned(userId, id);
    return serializeCharacter(c, await ItemService.customItems(c.campaignId));
  },

  async update(userId: string, id: string, input: unknown) {
    const data = updateCharacterSchema.parse(input);
    const c = await this.findOwned(userId, id);
    await sequelize.transaction(async (transaction) => {
      if (data.name) await c.update({ name: data.name }, { transaction });
      if (data.sheet) {
        if (c.sheet) await c.sheet.update(data.sheet, { transaction });
        else await CharacterSheet.create({ characterId: c.id, ...data.sheet }, { transaction });
      }
    });
    return this.get(userId, id);
  },

  /** Equipa/desequipa validando as restrições de classe, atributos e divindade. */
  async equip(userId: string, id: string, input: unknown) {
    const { slot, itemKey } = equipSchema.parse(input);
    const c = await this.findOwned(userId, id);
    const custom = await ItemService.customItems(c.campaignId);
    if (itemKey && !(c.inventory ?? []).some((i) => i.itemKey === itemKey && i.quantity > 0)) {
      throw new HttpError(422, 'O item precisa estar no inventário');
    }
    const equipment = { ...(c.equipment ?? {}), [slot as EquipmentSlot]: itemKey };
    const violations = validateEquipment({ ...buildOf(c), equipment }, custom);
    if (violations.length) throw new HttpError(422, 'Equipamento não permitido', { violations });
    const stats = deriveStats({ ...buildOf(c), equipment }, custom);
    await c.update({ equipment, hp: Math.min(c.hp, stats.maxHp) });
    return this.get(userId, id);
  },

  async softDelete(userId: string, id: string) {
    await sequelize.transaction(async (transaction) => {
      const c = await Character.findOne({ where: { id, userId }, transaction });
      if (!c) throw new HttpError(404, 'Personagem não encontrado');
      await CharacterSheet.destroy({ where: { characterId: id }, transaction });
      await c.destroy({ transaction });
    });
  },

  async restore(userId: string, id: string) {
    await sequelize.transaction(async (transaction) => {
      const c = await Character.findOne({ where: { id, userId }, paranoid: false, transaction });
      if (!c || !c.deletedAt) throw new HttpError(404, 'Personagem não encontrado na lixeira');
      await c.restore({ transaction });
      await CharacterSheet.restore({ where: { characterId: id }, transaction });
    });
    return this.get(userId, id);
  },

  // ───────────── Integração com a mesa (efeitos colaterais do motor) ─────────────

  async snapshot(characterId: string): Promise<{ snapshot: CharacterSnapshot; custom: Record<string, ItemDef> } | null> {
    const c = await Character.findByPk(characterId, { include: INCLUDE });
    if (!c) return null;
    return {
      snapshot: {
        id: c.id, userId: c.userId, name: c.name, build: buildOf(c), hp: c.hp, stamina: c.stamina,
        inventory: (c.inventory ?? []).map((i) => ({ itemKey: i.itemKey, quantity: i.quantity })),
      },
      custom: await ItemService.customItems(c.campaignId),
    };
  },

  async setVitals(characterId: string, hp: number, stamina: number) {
    await Character.update({ hp: Math.max(0, hp), stamina: Math.max(0, stamina) }, { where: { id: characterId } });
  },

  async consumeItem(characterId: string, itemKey: string, quantity: number) {
    const inv = await InventoryItem.findOne({ where: { characterId, itemKey } });
    if (inv) await inv.update({ quantity: Math.max(0, inv.quantity - quantity) });
  },

  async adjustAffinity(characterId: string, delta: number) {
    const c = await Character.findByPk(characterId);
    if (!c) return null;
    const affinity = Math.max(AFFINITY_MIN, Math.min(AFFINITY_MAX, c.affinity + delta));
    await c.update({ affinity });
    return affinity;
  },
};
