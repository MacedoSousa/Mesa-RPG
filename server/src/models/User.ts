import {
  CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model,
} from 'sequelize';
import type { Role } from '@mesa/shared';
import { sequelize } from '../config/database';

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>;
  declare username: string;
  declare email: string;
  declare passwordHash: string;
  declare displayName: string | null;
  declare role: CreationOptional<Role>;
  /** Incrementar invalida todos os refresh tokens ("sair de todos os dispositivos"). */
  declare tokenVersion: CreationOptional<number>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date | null>;

  toPublic() {
    return {
      id: this.id,
      username: this.username,
      email: this.email,
      displayName: this.displayName,
      role: this.role,
      createdAt: this.createdAt,
    };
  }
}

User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    username: { type: DataTypes.STRING(32), allowNull: false },
    email: { type: DataTypes.STRING(255), allowNull: false },
    passwordHash: { type: DataTypes.TEXT, allowNull: false },
    displayName: { type: DataTypes.STRING(60), allowNull: true },
    role: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'PLAYER' },
    tokenVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
    deletedAt: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'users',
    paranoid: true, // Soft Delete: destroy() preenche deleted_at; consultas ignoram removidos
    defaultScope: { attributes: { exclude: [] } },
  },
);
