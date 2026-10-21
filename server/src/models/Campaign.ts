import {
  CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute,
} from 'sequelize';
import { sequelize } from '../config/database';
import type { User } from './User';

export class Campaign extends Model<InferAttributes<Campaign>, InferCreationAttributes<Campaign>> {
  declare id: CreationOptional<string>;
  declare masterId: ForeignKey<User['id']>;
  declare name: string;
  declare description: CreationOptional<string>;
  declare joinCode: string;
  declare settings: CreationOptional<Record<string, unknown>>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  declare master?: NonAttribute<User>;
}

Campaign.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING(80), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    joinCode: { type: DataTypes.STRING(8), allowNull: false },
    settings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'campaigns', paranoid: true },
);

export type MemberStatus = 'ativo' | 'banido';

export class CampaignMember extends Model<InferAttributes<CampaignMember>, InferCreationAttributes<CampaignMember>> {
  declare id: CreationOptional<string>;
  declare campaignId: ForeignKey<Campaign['id']>;
  declare userId: ForeignKey<User['id']>;
  declare characterId: string | null;
  declare status: CreationOptional<MemberStatus>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
}

CampaignMember.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    characterId: { type: DataTypes.UUID, allowNull: true },
    status: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ativo' },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  },
  { sequelize, tableName: 'campaign_members' },
);
