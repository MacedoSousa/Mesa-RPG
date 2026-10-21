import request from 'supertest';
import { sequelize } from '../../src/config/database';
import { Campaign, Character, CharacterSheet, Item, User } from '../../src/models';
import { app, auth, closeAll, createCharacter, registerUser, resetData, setupDatabase } from '../helpers';

beforeAll(setupDatabase);
beforeEach(resetData);
afterAll(closeAll);

async function rawRow(table: string, id: string) {
  const [rows] = await sequelize.query(`SELECT * FROM ${table} WHERE id = :id`, { replacements: { id } });
  return (rows as Record<string, unknown>[])[0];
}

describe('Soft Delete de personagens e fichas', () => {
  it('apagar só marca deleted_at: some da listagem, continua no banco e pode ser restaurado', async () => {
    const u = await registerUser('percy');
    const c = await createCharacter(u);

    await request(app).delete(`/api/characters/${c.id}`).set(auth(u)).expect(204);
    const list = await request(app).get('/api/characters').set(auth(u)).expect(200);
    expect(list.body.characters).toHaveLength(0);
    await request(app).get(`/api/characters/${c.id}`).set(auth(u)).expect(404);

    const row = await rawRow('characters', c.id);
    expect(row).toBeDefined();
    expect(row.deleted_at).not.toBeNull();
    const sheet = await CharacterSheet.findOne({ where: { characterId: c.id }, paranoid: false });
    expect(sheet!.deletedAt).not.toBeNull();

    const trash = await request(app).get('/api/characters?includeDeleted=true').set(auth(u)).expect(200);
    expect(trash.body.characters[0].deletedAt).not.toBeNull();

    const restored = await request(app).post(`/api/characters/${c.id}/restore`).set(auth(u)).expect(200);
    expect(restored.body.character.deletedAt).toBeNull();
    expect(restored.body.character.sheet.backstory).toMatch(/pescadores/);
    expect((await Character.findByPk(c.id))!.deletedAt).toBeNull();
  });

  it('outro usuário não apaga nem restaura a ficha alheia', async () => {
    const a = await registerUser('percy');
    const b = await registerUser('luke');
    const c = await createCharacter(a);
    await request(app).delete(`/api/characters/${c.id}`).set(auth(b)).expect(404);
    await request(app).delete(`/api/characters/${c.id}`).set(auth(a)).expect(204);
    await request(app).post(`/api/characters/${c.id}/restore`).set(auth(b)).expect(404);
  });
});

describe('Soft Delete de usuários', () => {
  it('excluir a conta remove (logicamente) usuário e fichas, e libera username/e-mail', async () => {
    const u = await registerUser('percy');
    const c = await createCharacter(u);
    await request(app).delete('/api/auth/me').set(auth(u)).expect(204);

    expect(await User.findByPk(u.id)).toBeNull();
    const ghost = await User.findByPk(u.id, { paranoid: false });
    expect(ghost!.deletedAt).not.toBeNull();
    expect((await Character.findByPk(c.id, { paranoid: false }))!.deletedAt).not.toBeNull();

    await request(app).post('/api/auth/login').send({ login: 'percy', password: 'senha-forte-123' }).expect(401);
    await request(app).get('/api/auth/me').set(auth(u)).expect(401);
    // índice único parcial: o nome pode ser reutilizado
    const again = await registerUser('percy');
    expect(again.id).not.toBe(u.id);
  });
});

describe('Soft Delete de campanhas e itens', () => {
  it('campanha apagada some para o Mestre e é restaurável; o código de convite deixa de funcionar', async () => {
    const master = await registerUser('quiron');
    const player = await registerUser('percy');
    const char = await createCharacter(player);
    const camp = (await request(app).post('/api/campaigns').set(auth(master)).send({ name: 'O Ladrão de Raios' }).expect(201)).body.campaign;
    await request(app).post(`/api/campaigns/${camp.id}/maps`).set(auth(master)).send({ preset: 'olimpo' }).expect(201);

    await request(app).delete(`/api/campaigns/${camp.id}`).set(auth(master)).expect(204);
    expect((await request(app).get('/api/campaigns').set(auth(master))).body.campaigns).toHaveLength(0);
    await request(app).post('/api/campaigns/join').set(auth(player)).send({ code: camp.joinCode, characterId: char.id }).expect(404);
    expect((await Campaign.findByPk(camp.id, { paranoid: false }))!.deletedAt).not.toBeNull();

    await request(app).post(`/api/campaigns/${camp.id}/restore`).set(auth(master)).expect(200);
    const maps = await request(app).get(`/api/campaigns/${camp.id}/maps`).set(auth(master)).expect(200);
    expect(maps.body.maps).toHaveLength(1);
  });

  it('item personalizado do Mestre usa soft delete', async () => {
    const master = await registerUser('quiron');
    const camp = (await request(app).post('/api/campaigns').set(auth(master)).send({ name: 'Mar de Monstros' })).body.campaign;
    const created = await request(app).post(`/api/campaigns/${camp.id}/items`).set(auth(master)).send({
      kind: 'arma', key: 'remo_magico', name: 'Remo Mágico', category: 'simples', damage: '1d6', damageType: 'concussao',
    }).expect(201);
    expect(created.body.item.key).toBe('remo_magico');
    const row = await Item.findOne({ where: { key: 'remo_magico' } });
    await request(app).delete(`/api/campaigns/${camp.id}/items/${row!.id}`).set(auth(master)).expect(204);
    expect(await Item.findOne({ where: { key: 'remo_magico' } })).toBeNull();
    expect((await Item.findOne({ where: { key: 'remo_magico' }, paranoid: false }))!.deletedAt).not.toBeNull();
  });
});
