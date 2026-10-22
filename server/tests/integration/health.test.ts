import request from 'supertest';
import { app, closeAll, resetData, setupDatabase } from '../helpers';

beforeAll(setupDatabase);
beforeEach(resetData);
afterAll(closeAll);

describe('Checagem do sistema', () => {
  it('lista banco, configs, imagens, telas e IA (no próprio PC, sem login)', async () => {
    const { body } = await request(app).get('/api/health/detalhe').expect(200);
    const keys = body.checks.map((c: { key: string }) => c.key);
    expect(keys).toEqual(expect.arrayContaining(['banco', 'migracoes', 'dados', 'saves', 'config', 'imagens', 'telas', 'ia']));
    expect(body.checks.find((c: { key: string }) => c.key === 'banco').level).toBe('ok');
    // ComfyUI desligado é só aviso: o jogo funciona sem ele
    expect(body.checks.find((c: { key: string }) => c.key === 'ia').level).not.toBe('erro');
  });
});
