import {
  CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model,
} from 'sequelize';
import type { ItemDef } from '@mesa/shared';
import { sequelize } from '../config/database';

/** Catálogo de itens (base semeada + itens personalizados do Mestre por campanha). */
export class Item extends Model<InferAttributes<Item>, InferCreationAttributes<Item>> {
  declare id: CreationOptional<string>;
  declare key: string;
  declare campaignId: string | null;
  declare kind: string;
  declare name: string;
  declare definition: ItemDef;
  declare isCustom: CreationOptional<boolean>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;
}

Item.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    key: { type: DataTypes.STRING(60), allowNull: false },
    campaignId: { type: DataTypes.UUID, allowNull: true },
    kind: { type: DataTypes.STRING(20), allowNull: false },
    name: { type: DataTypes.STRING(80), allowNull: false },
    definition: { type: DataTypes.JSONB, allowNull: false },
    isCustom: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'items', paranoid: true },
);
