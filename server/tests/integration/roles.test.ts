import request from 'supertest';
import { app, auth, closeAll, createCharacter, registerUser, resetData, setupDatabase } from '../helpers';

beforeAll(setupDatabase);
beforeEach(resetData);
afterAll(closeAll);

describe('Código de Mestre e papéis por campanha', () => {
  it('aceita o código com espaços nas pontas e maiúsculas/minúsculas diferentes', async () => {
    await registerUser('quiron');
    const second = await registerUser('dionisio', { masterCode: '  CODIGO-Mestre-Teste ' });
    expect(second.role).toBe('MASTER');
  });

  it('o primeiro cadastro vira Mestre mesmo com um código errado digitado', async () => {
    const first = await registerUser('quiron', { masterCode: 'K7QX2M' });
    expect(first.role).toBe('MASTER');
  });

  it('código errado explica onde achar o código certo', async () => {
    await registerUser('quiron');
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'impostor', email: 'i@mesa.test', password: 'senha-forte-123', masterCode: 'K7QX2M' })
      .expect(403);
    expect(res.body.error).toMatch(/server\/\.env/);
    expect(res.body.error).toMatch(/código de 6 letras da campanha/);
  });

  it('conta de Jogador existente vira Mestre com o código (novo token já tem o papel)', async () => {
    await registerUser('quiron');
    const player = await registerUser('percy');
    await request(app).post('/api/campaigns').set(auth(player)).send({ name: 'Proibido' }).expect(403);
    await request(app).post('/api/auth/promote').set(auth(player)).send({ masterCode: 'errado' }).expect(403);
    const res = await request(app).post('/api/auth/promote').set(auth(player)).send({ masterCode: 'codigo-mestre-teste' }).expect(200);
    expect(res.body.user.role).toBe('MASTER');
    await request(app).post('/api/campaigns').set({ Authorization: `Bearer ${res.body.accessToken}` }).send({ name: 'Minha aventura' }).expect(201);
  });

  it('Mestre joga na campanha de outro Mestre e vê as duas listas separadas', async () => {
    const a = await registerUser('quiron');
    const b = await registerUser('dionisio', { masterCode: 'codigo-mestre-teste' });
    const mine = (await request(app).post('/api/campaigns').set(auth(a)).send({ name: 'Campanha do Quíron' }).expect(201)).body.campaign;
    const theirs = (await request(app).post('/api/campaigns').set(auth(b)).send({ name: 'Campanha do Dionísio' }).expect(201)).body.campaign;
    const hero = await createCharacter(a);
    await request(app).post('/api/campaigns/join').set(auth(a)).send({ code: theirs.joinCode, characterId: hero.id }).expect(200);
    const list = (await request(app).get('/api/campaigns').set(auth(a)).expect(200)).body.campaigns as { id: string; isMaster: boolean; joinCode?: string }[];
    expect(list.find((c) => c.id === mine.id)).toMatchObject({ isMaster: true, joinCode: mine.joinCode });
    const joined = list.find((c) => c.id === theirs.id)!;
    expect(joined.isMaster).toBe(false);
    expect(joined.joinCode).toBeUndefined(); // jogador não vê o código de convite alheio
  });

  it('health informa se o banco responde', async () => {
    const res = await request(app).get('/api/health').expect(200);
    expect(res.body.database).toBe('ok');
  });
});
