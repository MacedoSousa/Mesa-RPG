import request from 'supertest';
import { User } from '../../src/models';
import { hashPassword, verifyAccessToken, verifyPassword } from '../../src/utils/security';
import { app, auth, closeAll, registerUser, resetData, setupDatabase } from '../helpers';

beforeAll(setupDatabase);
beforeEach(resetData);
afterAll(closeAll);

describe('Senhas (Argon2id)', () => {
  it('gera hash argon2id e verifica corretamente', async () => {
    const hash = await hashPassword('minha-senha');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(hash, 'minha-senha')).toBe(true);
    expect(await verifyPassword(hash, 'outra')).toBe(false);
  });
});

describe('Cadastro', () => {
  it('o primeiro cadastro vira MESTRE; os seguintes, JOGADOR', async () => {
    const master = await registerUser('quiron');
    const player = await registerUser('percy');
    expect(master.role).toBe('MASTER');
    expect(player.role).toBe('PLAYER');
  });

  it('código de convite cria um segundo Mestre; código errado é recusado', async () => {
    await registerUser('quiron');
    const second = await registerUser('dionisio', { masterCode: 'codigo-mestre-teste' });
    expect(second.role).toBe('MASTER');
    await request(app).post('/api/auth/register')
      .send({ username: 'impostor', email: 'i@mesa.test', password: 'senha-forte-123', masterCode: 'chute' })
      .expect(403);
  });

  it('não guarda a senha em texto puro e não devolve o hash', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ username: 'annabeth', email: 'Annabeth@Mesa.test', password: 'sabedoria-123' }).expect(201);
    expect(res.body.user.passwordHash).toBeUndefined();
    const row = await User.findByPk(res.body.user.id);
    expect(row!.passwordHash).not.toContain('sabedoria-123');
    expect(row!.email).toBe('annabeth@mesa.test');
  });

  it('valida dados e recusa duplicados (sem diferenciar maiúsculas)', async () => {
    await request(app).post('/api/auth/register').send({ username: 'x', email: 'ruim', password: '123' }).expect(400);
    await registerUser('grover');
    const dup = await request(app).post('/api/auth/register').send({ username: 'GROVER', email: 'novo@mesa.test', password: 'senha-forte-123' });
    expect(dup.status).toBe(409);
    expect(dup.body.details).toMatchObject({ username: true, email: false });
  });
});

describe('Login, JWT e refresh', () => {
  it('faz login por username ou e-mail e emite JWT de acesso', async () => {
    await registerUser('percy');
    const byName = await request(app).post('/api/auth/login').send({ login: 'percy', password: 'senha-forte-123' }).expect(200);
    const byEmail = await request(app).post('/api/auth/login').send({ login: 'PERCY@mesa.test', password: 'senha-forte-123' }).expect(200);
    expect(verifyAccessToken(byName.body.accessToken).username).toBe('percy');
    expect(byEmail.body.user.username).toBe('percy');
    expect(byName.headers['set-cookie']?.[0]).toMatch(/mesa_rt=.*HttpOnly/);
  });

  it('recusa senha errada e usuário inexistente com a mesma mensagem', async () => {
    await registerUser('percy');
    const a = await request(app).post('/api/auth/login').send({ login: 'percy', password: 'errada' }).expect(401);
    const b = await request(app).post('/api/auth/login').send({ login: 'ninguem', password: 'errada' }).expect(401);
    expect(a.body.error).toBe(b.body.error);
  });

  it('rotas protegidas exigem token válido', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer lixo').expect(401);
    const u = await registerUser('percy');
    const me = await request(app).get('/api/auth/me').set(auth(u)).expect(200);
    expect(me.body.user.username).toBe('percy');
  });

  it('refresh usa o cookie HttpOnly e "sair de todos os dispositivos" revoga', async () => {
    const u = await registerUser('percy');
    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', u.cookie).expect(200);
    expect(r1.body.accessToken).toBeTruthy();
    await request(app).post('/api/auth/logout-all').set(auth(u)).expect(204);
    await request(app).post('/api/auth/refresh').set('Cookie', u.cookie).expect(401);
    await request(app).get('/api/auth/me').set(auth(u)).expect(401);
  });

  it('jogador não acessa rotas de Mestre (RBAC)', async () => {
    await registerUser('quiron');
    const player = await registerUser('percy');
    await request(app).post('/api/campaigns').set(auth(player)).send({ name: 'Golpe' }).expect(403);
    await request(app).get('/api/host/info').set(auth(player)).expect(403);
  });
});
