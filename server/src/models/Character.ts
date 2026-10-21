import {
  CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute,
} from 'sequelize';
import type { AbilityScores, Equipment } from '@mesa/shared';
import { sequelize } from '../config/database';
import type { User } from './User';

export class Character extends Model<InferAttributes<Character>, InferCreationAttributes<Character>> {
  declare id: CreationOptional<string>;
  declare userId: ForeignKey<User['id']>;
  declare campaignId: string | null;
  declare name: string;
  declare race: string;
  declare divinity: string;
  declare classKey: string;
  declare level: CreationOptional<number>;
  declare experience: CreationOptional<number>;
  declare affinity: CreationOptional<number>;
  declare baseAbilities: AbilityScores;
  declare skills: string[];
  declare equipment: Equipment;
  declare hp: number;
  declare stamina: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  declare sheet?: NonAttribute<CharacterSheet>;
  declare inventory?: NonAttribute<InventoryItem[]>;
}

Character.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    campaignId: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING(60), allowNull: false },
    race: { type: DataTypes.STRING(32), allowNull: false },
    divinity: { type: DataTypes.STRING(32), allowNull: false },
    classKey: { type: DataTypes.STRING(32), allowNull: false },
    level: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 1 },
    experience: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    affinity: { type: DataTypes.SMALLINT, allowNull: false, defaultValue: 0 },
    baseAbilities: { type: DataTypes.JSONB, allowNull: false },
    skills: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    equipment: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    hp: { type: DataTypes.INTEGER, allowNull: false },
    stamina: { type: DataTypes.INTEGER, allowNull: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'characters', paranoid: true },
);

/** A "ficha" narrativa do personagem (história, personalidade, anotações). */
export class CharacterSheet extends Model<InferAttributes<CharacterSheet>, InferCreationAttributes<CharacterSheet>> {
  declare id: CreationOptional<string>;
  declare characterId: ForeignKey<Character['id']>;
  declare backstory: CreationOptional<string>;
  declare personality: CreationOptional<string>;
  declare appearance: CreationOptional<string>;
  declare notes: CreationOptional<string>;
  declare languages: CreationOptional<string[]>;
  declare extra: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;
}

CharacterSheet.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    backstory: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    personality: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    appearance: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    notes: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    languages: { type: DataTypes.JSONB, allowNull: false, defaultValue: ['Comum', 'Grego Antigo'] },
    extra: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'character_sheets', paranoid: true },
);

export class InventoryItem extends Model<InferAttributes<InventoryItem>, InferCreationAttributes<InventoryItem>> {
  declare id: CreationOptional<string>;
  declare characterId: ForeignKey<Character['id']>;
  declare itemKey: string;
  declare quantity: number;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

InventoryItem.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    itemKey: { type: DataTypes.STRING(60), allowNull: false },
    quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'inventory_items' },
);
