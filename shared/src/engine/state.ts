import { createBlankMap } from './map';
import { TABLE_SCHEMA_VERSION, type MapState, type TableState } from './types';

export function createTableState(campaignId: string, name: string, map?: MapState, now = Date.now()): TableState {
  return {
    schemaVersion: TABLE_SCHEMA_VERSION,
    campaignId,
    name,
    phase: 'exploracao',
    paused: false,
    chapters: [],
    activeChapterId: null,
    map: map ?? createBlankMap(20, 14),
    tokens: [],
    combat: null,
    sideQuests: [],
    players: {},
    log: [],
    seq: 0,
    logSeq: 0,
    updatedAt: now,
  };
}

export class SaveMigrationError extends Error {}

/**
 * Migrações de saves antigos. Cada função leva da versão N para N+1.
 * Adicione novas entradas aqui quando o formato do TableState mudar.
 */
const MIGRATIONS: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // 0 → 1: saves de protótipo sem capítulos/quests/players
  0: (raw) => ({
    ...raw,
    chapters: raw.chapters ?? [],
    activeChapterId: raw.activeChapterId ?? null,
    sideQuests: raw.sideQuests ?? [],
    players: raw.players ?? {},
    logSeq: raw.logSeq ?? 0,
    schemaVersion: 1,
  }),
};

export function migrateTableState(input: unknown): TableState {
  if (!input || typeof input !== 'object') throw new SaveMigrationError('Save inválido');
  let raw = { ...(input as Record<string, unknown>) };
  let version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0;
  if (version > TABLE_SCHEMA_VERSION) throw new SaveMigrationError(`Save da versão ${version} é mais novo que o servidor (${TABLE_SCHEMA_VERSION})`);
  while (version < TABLE_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new SaveMigrationError(`Sem migração da versão ${version}`);
    raw = step(raw);
    version = raw.schemaVersion as number;
  }
  const state = raw as unknown as TableState;
  if (!state.map || !Array.isArray(state.map.tiles) || !Array.isArray(state.tokens)) throw new SaveMigrationError('Save corrompido: mapa ou tokens ausentes');
  // Conexões não fazem parte do save
  for (const p of Object.values(state.players)) p.connected = false;
  return state;
}
