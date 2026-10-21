import {
  CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model,
} from 'sequelize';
import type { TableState, Tile } from '@mesa/shared';
import { sequelize } from '../config/database';

/** Mapas salvos da campanha (padrão do livro ou desenhados pelo Mestre). */
export class GameMap extends Model<InferAttributes<GameMap>, InferCreationAttributes<GameMap>> {
  declare id: CreationOptional<string>;
  declare campaignId: string;
  declare name: string;
  declare preset: string | null;
  declare width: number;
  declare height: number;
  declare tiles: Tile[];
  declare createdBy: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;
}

GameMap.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    campaignId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(80), allowNull: false },
    preset: { type: DataTypes.STRING(40), allowNull: true },
    width: { type: DataTypes.SMALLINT, allowNull: false },
    height: { type: DataTypes.SMALLINT, allowNull: false },
    tiles: { type: DataTypes.JSONB, allowNull: false },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'game_maps', paranoid: true },
);

/** Snapshot completo e versionado do estado da mesa (Save/Load). */
export class SaveGame extends Model<InferAttributes<SaveGame>, InferCreationAttributes<SaveGame>> {
  declare id: CreationOptional<string>;
  declare campaignId: string;
  declare name: string;
  declare kind: 'manual' | 'auto';
  declare schemaVersion: number;
  declare seq: number;
  declare state: TableState;
  declare createdBy: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;
}

SaveGame.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    campaignId: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(80), allowNull: false },
    kind: { type: DataTypes.STRING(10), allowNull: false },
    schemaVersion: { type: DataTypes.INTEGER, allowNull: false },
    seq: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    state: { type: DataTypes.JSONB, allowNull: false },
    createdBy: { type: DataTypes.UUID, allowNull: true },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'save_games', paranoid: true },
);

/** Histórico de turnos/eventos (append-only), além do log recente que vive no estado. */
export class GameEvent extends Model<InferAttributes<GameEvent>, InferCreationAttributes<GameEvent>> {
  declare id: CreationOptional<number>;
  declare campaignId: string;
  declare logId: number;
  declare type: string;
  declare visibility: string;
  declare actorUserId: string | null;
  declare text: string;
  declare data: Record<string, unknown> | null;
  declare createdAt: CreationOptional<Date>;
}

GameEvent.init(
  {
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    campaignId: { type: DataTypes.UUID, allowNull: false },
    logId: { type: DataTypes.INTEGER, allowNull: false },
    type: { type: DataTypes.STRING(20), allowNull: false },
    visibility: { type: DataTypes.STRING(10), allowNull: false },
    actorUserId: { type: DataTypes.UUID, allowNull: true },
    text: { type: DataTypes.TEXT, allowNull: false },
    data: { type: DataTypes.JSONB, allowNull: true },
    createdAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'game_events', updatedAt: false },
);
