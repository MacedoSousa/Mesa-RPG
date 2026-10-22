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

/**
 * Conecta no banco. Logo depois de ligar o PC o PostgreSQL (ou o Docker) pode ainda estar
 * subindo: tenta de novo por até ~2 minutos antes de desistir.
 */
export async function connectDatabase(tries = env.NODE_ENV === 'test' ? 1 : 40): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      await sequelize.authenticate();
      break;
    } catch (e) {
      if (i >= tries) throw e;
      if (i === 1 || i % 5 === 0) console.log(`⏳ Esperando o banco de dados ligar (tentativa ${i}/${tries}): ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const [rows] = await sequelize.query('SELECT version() AS version');
  const version = (rows as { version: string }[])[0]?.version.split(',')[0] ?? 'PostgreSQL';
  console.log(`🐘 Conectado: ${version}`);
}

export async function closeDatabase(): Promise<void> {
  await sequelize.close();
}
