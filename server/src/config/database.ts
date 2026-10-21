import { Sequelize } from 'sequelize';
import { databaseUrl, env } from './env';

export const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: env.DATABASE_LOGGING ? (sql) => console.log(`🐘 ${sql}`) : false,
  dialectOptions: env.DATABASE_SSL ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  pool: { max: 10, idle: 30_000, acquire: 10_000 },
  define: {
    underscored: true, // createdAt → created_at, deletedAt → deleted_at
    timestamps: true,
  },
});

export async function connectDatabase(): Promise<void> {
  await sequelize.authenticate();
  const [rows] = await sequelize.query('SELECT version() AS version');
  const version = (rows as { version: string }[])[0]?.version.split(',')[0] ?? 'PostgreSQL';
  console.log(`🐘 Conectado: ${version}`);
}

export async function closeDatabase(): Promise<void> {
  await sequelize.close();
}
