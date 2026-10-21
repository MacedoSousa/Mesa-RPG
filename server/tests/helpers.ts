import request from 'supertest';
import { createApp } from '../src/app';
import { sequelize } from '../src/config/database';
import { migrator } from '../src/database/migrator';
import { seedItems } from '../src/database/seed';
import { tableManager } from '../src/game/TableManager';

export const app = createApp({ authRateLimit: false, serveClients: false });

let migrated = false;
export async function setupDatabase() {
  if (!migrated) {
    await migrator.up();
    await seedItems();
    migrated = true;
  }
}

export async function resetData() {
  tableManager.clear();
  await sequelize.query(`
    TRUNCATE game_events, save_games, game_maps, campaign_members, inventory_items, character_sheets, characters, campaigns, users
    RESTART IDENTITY CASCADE;
    DELETE FROM items WHERE campaign_id IS NOT NULL;
  `);
}

export interface TestUser {
  id: string;
  username: string;
  role: 'MASTER' | 'PLAYER';
  accessToken: string;
  cookie: string;
}

export async function registerUser(username: string, extra: Record<string, unknown> = {}): Promise<TestUser> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username, email: `${username}@mesa.test`, password: 'senha-forte-123', ...extra })
    .expect(201);
  const cookie = ([] as string[]).concat(res.headers['set-cookie'] ?? []).find((c) => c.startsWith('mesa_rt=')) ?? '';
  return { id: res.body.user.id, username, role: res.body.user.role, accessToken: res.body.accessToken, cookie: cookie.split(';')[0] };
}

export const auth = (u: TestUser) => ({ Authorization: `Bearer ${u.accessToken}` });

export const validCharacter = {
  name: 'Kai das Marés',
  race: 'semideus',
  divinity: 'poseidon',
  classKey: 'guerreiro',
  baseAbilities: { forca: 15, destreza: 14, constituicao: 13, inteligencia: 12, sabedoria: 10, carisma: 8 },
  skills: ['atletismo', 'percepcao'],
  equipment: { mainHand: 'espada_bronze_celestial', armor: 'cota_de_malha', shield: 'escudo_bronze' },
  inventory: [
    { itemKey: 'espada_bronze_celestial', quantity: 1 },
    { itemKey: 'cota_de_malha', quantity: 1 },
    { itemKey: 'escudo_bronze', quantity: 1 },
    { itemKey: 'montante', quantity: 1 },
    { itemKey: 'pocao_cura', quantity: 2 },
  ],
  backstory: 'Cresceu numa vila de pescadores e sempre soube prender a respiração por tempo demais.',
};

export async function createCharacter(u: TestUser, overrides: Record<string, unknown> = {}) {
  const res = await request(app).post('/api/characters').set(auth(u)).send({ ...validCharacter, ...overrides }).expect(201);
  return res.body.character as { id: string; name: string; [k: string]: unknown };
}

export async function closeAll() {
  await sequelize.close();
}
