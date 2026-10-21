import { Client } from 'pg';
import './setupEnv';

/** Recria o schema do banco de testes do zero antes da bateria. */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL!;
  if (!/test/i.test(url)) throw new Error(`Por segurança, TEST_DATABASE_URL precisa conter "test" no nome: ${url}`);
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(`Não consegui conectar no banco de testes (${url}). Rode "docker compose up -d". Detalhe: ${(err as Error).message}`);
  }
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await client.end();
}
