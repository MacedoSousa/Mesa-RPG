import { SequelizeStorage, Umzug } from 'umzug';
import { sequelize } from '../config/database';
import * as m0001 from './migrations/0001_initial';

/** Migrações em ordem. Para criar uma nova: adicione o arquivo em migrations/ e registre aqui. */
const MIGRATIONS = [m0001];

export const migrator = new Umzug({
  migrations: MIGRATIONS.map((m) => ({ name: m.name, up: m.up, down: m.down })),
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize, tableName: 'schema_migrations' }),
  logger: process.env.NODE_ENV === 'test' ? undefined : console,
});
