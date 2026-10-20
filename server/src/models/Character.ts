import { z } from 'zod';
import { query } from '../config/database';
import {
  AFFINITY_MAX,
  AFFINITY_MIN,
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  Attributes,
  CLASSES,
  CLASS_KEYS,
  ClassKey,
  GODLY_PARENT_KEYS,
  GodlyParentKey,
  RACE_KEYS,
  RaceKey,
  attributeModifier,
} from './gameData';
import { Equipment, calculateArmorClass, validateEquipment } from './equipmentRules';

// ───────────────────────────── Tipos ─────────────────────────────

export interface CharacterRow {
  id: string;
  user_id: string;
  name: string;
  race: RaceKey;
  class: ClassKey;
  subclass: string | null;
  level: number;
  experience: number;
  godly_parent: GodlyParentKey;
  godly_affinity: number;
  forca: number;
  destreza: number;
  constituicao: number;
  inteligencia: number;
  sabedoria: number;
  carisma: number;
  max_hp: number;
  current_hp: number;
  temp_hp: number;
  armor_class: number;
  equipment: Equipment;
  inventory: InventoryItem[];
  sheet: CharacterSheet;
  backstory: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface InventoryItem {
  item: string;
  quantity: number;
  notes?: string;
}

/** Parte flexível da ficha (perícias, magias, talentos, anotações). */
export interface CharacterSheet {
  skills?: string[];
  savingThrows?: string[];
  spells?: string[];
  feats?: string[];
  languages?: string[];
  notes?: string;
  [key: string]: unknown;
}

// ───────────────────────────── Validação (zod) ─────────────────────────────

const attributeSchema = z.number().int().min(ATTRIBUTE_MIN).max(ATTRIBUTE_MAX);

export const attributesSchema = z.object({
  forca: attributeSchema,
  destreza: attributeSchema,
  constituicao: attributeSchema,
  inteligencia: attributeSchema,
  sabedoria: attributeSchema,
  carisma: attributeSchema,
});

const equipmentSchema = z
  .object({
    mainHand: z.string().nullable().optional(),
    offHand: z.string().nullable().optional(),
    armor: z.string().nullable().optional(),
    shield: z.string().nullable().optional(),
  })
  .default({});

const inventorySchema = z
  .array(z.object({ item: z.string().min(1), quantity: z.number().int().min(0), notes: z.string().optional() }))
  .default([]);

const sheetSchema = z.record(z.unknown()).default({});

export const createCharacterSchema = z.object({
  name: z.string().trim().min(2).max(60),
  race: z.enum(RACE_KEYS as [RaceKey, ...RaceKey[]]),
  class: z.enum(CLASS_KEYS as [ClassKey, ...ClassKey[]]),
  subclass: z.string().trim().max(60).nullable().optional(),
  level: z.number().int().min(1).max(20).default(1),
  experience: z.number().int().min(0).default(0),
  godlyParent: z.enum(GODLY_PARENT_KEYS as [GodlyParentKey, ...GodlyParentKey[]]).default('nao_reclamado'),
  godlyAffinity: z.number().int().min(AFFINITY_MIN).max(AFFINITY_MAX).default(0),
  attributes: attributesSchema,
  equipment: equipmentSchema,
  inventory: inventorySchema,
  sheet: sheetSchema,
  backstory: z.string().max(10_000).nullable().optional(),
});

export const updateCharacterSchema = createCharacterSchema
  .partial()
  .extend({
    currentHp: z.number().int().min(0).optional(),
    tempHp: z.number().int().min(0).optional(),
  });

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;

export class EquipmentRestrictionError extends Error {
  constructor(public violations: ReturnType<typeof validateEquipment>) {
    super('Equipamento não permitido para a classe');
  }
}

// ───────────────────────────── Regras derivadas ─────────────────────────────

/** PV máximo: dado cheio no nível 1 + média arredondada para cima nos demais, somando CON. */
export function calculateMaxHp(classKey: ClassKey, level: number, constituicao: number): number {
  const hitDie = CLASSES[classKey].hitDie;
  const con = attributeModifier(constituicao);
  const perLevel = Math.floor(hitDie / 2) + 1;
  return Math.max(1, hitDie + con + (level - 1) * (perLevel + con));
}

function rowAttributes(row: CharacterRow): Attributes {
  return {
    forca: row.forca,
    destreza: row.destreza,
    constituicao: row.constituicao,
    inteligencia: row.inteligencia,
    sabedoria: row.sabedoria,
    carisma: row.carisma,
  };
}

function assertEquipment(classKey: ClassKey, equipment: Equipment, attributes: Attributes) {
  const violations = validateEquipment(classKey, equipment, attributes);
  if (violations.length) throw new EquipmentRestrictionError(violations);
}

// ───────────────────────────── Acesso a dados ─────────────────────────────

export const CharacterModel = {
  async listByUser(userId: string, includeDeleted = false): Promise<CharacterRow[]> {
    const { rows } = await query<CharacterRow>(
      `SELECT * FROM characters
        WHERE user_id = $1 ${includeDeleted ? '' : 'AND deleted_at IS NULL'}
        ORDER BY created_at DESC`,
      [userId],
    );
    return rows;
  },

  async findById(id: string, userId?: string): Promise<CharacterRow | null> {
    const params: unknown[] = [id];
    let sql = 'SELECT * FROM characters WHERE id = $1 AND deleted_at IS NULL';
    if (userId) {
      params.push(userId);
      sql += ' AND user_id = $2';
    }
    const { rows } = await query<CharacterRow>(sql, params);
    return rows[0] ?? null;
  },

  async create(userId: string, input: CreateCharacterInput): Promise<CharacterRow> {
    const equipment = input.equipment as Equipment;
    assertEquipment(input.class, equipment, input.attributes);

    const maxHp = calculateMaxHp(input.class, input.level, input.attributes.constituicao);
    const ac = calculateArmorClass(equipment, input.attributes);
    const a = input.attributes;

    const { rows } = await query<CharacterRow>(
      `INSERT INTO characters (
         user_id, name, race, class, subclass, level, experience,
         godly_parent, godly_affinity,
         forca, destreza, constituicao, inteligencia, sabedoria, carisma,
         max_hp, current_hp, armor_class, equipment, inventory, sheet, backstory
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7,
         $8, $9,
         $10, $11, $12, $13, $14, $15,
         $16, $16, $17, $18, $19, $20, $21
       ) RETURNING *`,
      [
        userId, input.name, input.race, input.class, input.subclass ?? null, input.level, input.experience,
        input.godlyParent, input.godlyAffinity,
        a.forca, a.destreza, a.constituicao, a.inteligencia, a.sabedoria, a.carisma,
        maxHp, ac, JSON.stringify(equipment), JSON.stringify(input.inventory), JSON.stringify(input.sheet),
        input.backstory ?? null,
      ],
    );
    return rows[0];
  },

  async update(id: string, userId: string, input: UpdateCharacterInput): Promise<CharacterRow | null> {
    const current = await this.findById(id, userId);
    if (!current) return null;

    const classKey = input.class ?? current.class;
    const level = input.level ?? current.level;
    const attributes = input.attributes ?? rowAttributes(current);
    const equipment = (input.equipment as Equipment | undefined) ?? current.equipment;

    // Revalida sempre: mudar a classe ou a Força pode invalidar o equipamento atual
    assertEquipment(classKey, equipment, attributes);

    const maxHp = calculateMaxHp(classKey, level, attributes.constituicao);
    const ac = calculateArmorClass(equipment, attributes);
    const currentHp = Math.min(input.currentHp ?? current.current_hp, maxHp);

    const { rows } = await query<CharacterRow>(
      `UPDATE characters SET
         name = $3, race = $4, class = $5, subclass = $6, level = $7, experience = $8,
         godly_parent = $9, godly_affinity = $10,
         forca = $11, destreza = $12, constituicao = $13, inteligencia = $14, sabedoria = $15, carisma = $16,
         max_hp = $17, current_hp = $18, temp_hp = $19, armor_class = $20,
         equipment = $21, inventory = $22, sheet = $23, backstory = $24
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [
        id, userId,
        input.name ?? current.name,
        input.race ?? current.race,
        classKey,
        input.subclass !== undefined ? input.subclass : current.subclass,
        level,
        input.experience ?? current.experience,
        input.godlyParent ?? current.godly_parent,
        input.godlyAffinity ?? current.godly_affinity,
        attributes.forca, attributes.destreza, attributes.constituicao,
        attributes.inteligencia, attributes.sabedoria, attributes.carisma,
        maxHp, currentHp, input.tempHp ?? current.temp_hp, ac,
        JSON.stringify(equipment),
        JSON.stringify(input.inventory ?? current.inventory),
        JSON.stringify(input.sheet ?? current.sheet),
        input.backstory !== undefined ? input.backstory : current.backstory,
      ],
    );
    return rows[0] ?? null;
  },

  /** Soft delete: a ficha some das listagens mas continua no banco. */
  async softDelete(id: string, userId: string): Promise<boolean> {
    const { rowCount } = await query(
      'UPDATE characters SET deleted_at = NOW() WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [id, userId],
    );
    return (rowCount ?? 0) > 0;
  },

  async restore(id: string, userId: string): Promise<CharacterRow | null> {
    const { rows } = await query<CharacterRow>(
      `UPDATE characters SET deleted_at = NULL
        WHERE id = $1 AND user_id = $2 AND deleted_at IS NOT NULL
        RETURNING *`,
      [id, userId],
    );
    return rows[0] ?? null;
  },
};
