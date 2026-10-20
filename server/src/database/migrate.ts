import { closeDatabase, withTransaction, query } from '../config/database';
import * as m001 from './migrations/001_initial_schema';

/** Lista ordenada de migrações. Adicione novas no final. */
const migrations: { name: string; up: string }[] = [m001];

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const { rows } = await query<{ name: string }>('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  let count = 0;
  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    console.log(`▶ Aplicando ${migration.name}...`);
    await withTransaction(async (client) => {
      await client.query(migration.up);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [migration.name]);
    });
    count++;
  }

  console.log(count ? `✅ ${count} migração(ões) aplicada(s).` : '✅ Banco já está atualizado.');
}

migrate()
  .catch((err) => {
    console.error('❌ Falha na migração:', err);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
