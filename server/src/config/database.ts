import { Pool, PoolClient, QueryResultRow } from 'pg';
import { env } from './env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool do PostgreSQL:', err);
});

/** Executa uma query simples usando o pool. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return pool.query<T>(text, params);
}

/** Executa um bloco dentro de uma transação (BEGIN/COMMIT/ROLLBACK). */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Testa a conexão na inicialização do servidor. */
export async function connectDatabase(): Promise<void> {
  const { rows } = await pool.query<{ now: Date; version: string }>(
    'SELECT NOW() AS now, version() AS version',
  );
  console.log(`🐘 PostgreSQL conectado (${rows[0].version.split(',')[0]})`);
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
