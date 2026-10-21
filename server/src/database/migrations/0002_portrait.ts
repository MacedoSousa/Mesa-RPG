import type { QueryInterface } from 'sequelize';

/** Retrato gerado do personagem (PortraitSpec em JSONB) e ambiente/semente dos mapas. */
export const name = '0002_portrait';

export async function up({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.query(`
    ALTER TABLE characters ADD COLUMN IF NOT EXISTS portrait JSONB;
    ALTER TABLE game_maps ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}'::jsonb;
  `);
}

export async function down({ context: qi }: { context: QueryInterface }) {
  await qi.sequelize.query(`
    ALTER TABLE characters DROP COLUMN IF EXISTS portrait;
    ALTER TABLE game_maps DROP COLUMN IF EXISTS meta;
  `);
}
