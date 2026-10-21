import { createServer, Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import request from 'supertest';
import { io as connect, Socket } from 'socket.io-client';
import { EVENTS, type Command, type StatePayload } from '@mesa/shared';
import { type TableManager, tableManager } from '../../src/game/TableManager';
import { createSocketServer } from '../../src/sockets';
import { app, auth, closeAll, createCharacter, registerUser, resetData, setupDatabase, type TestUser } from '../helpers';
import type { Server } from 'socket.io';
import { SaveGame } from '../../src/models';

let http: HttpServer;
let io: Server;
let tables: TableManager;
let url: string;
const sockets: Socket[] = [];

beforeAll(async () => {
  await setupDatabase();
  http = createServer(app);
  // mesma instância usada pelas rotas REST (save/load)
  tables = tableManager;
  io = createSocketServer(http, tables);
  await new Promise<void>((r) => http.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterEach(() => {
  for (const s of sockets.splice(0)) s.disconnect();
});

afterAll(async () => {
  io.close();
  await new Promise<void>((r) => http.close(() => r()));
  await closeAll();
});

function socketFor(u: TestUser): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = connect(url, { auth: { token: u.accessToken }, transports: ['websocket'], forceNew: true });
    sockets.push(s);
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}

type AckRes<T> = { ok: true; data: T } | { ok: false; error: string; code?: string };
function emit<T>(s: Socket, event: string, payload: unknown): Promise<AckRes<T>> {
  return new Promise((resolve) => s.emit(event, payload, resolve));
}
let n = 0;
const cmd = (s: Socket, command: Command) => emit<{ seq: number }>(s, EVENTS.COMMAND, { commandId: `c${++n}`, command });

function nextState(s: Socket, predicate: (p: StatePayload) => boolean = () => true): Promise<StatePayload> {
  return new Promise((resolve) => {
    const handler = (p: StatePayload) => {
      if (predicate(p)) {
        s.off(EVENTS.STATE, handler);
        resolve(p);
      }
    };
    s.on(EVENTS.STATE, handler);
  });
}

async function loginAs(username: string): Promise<TestUser> {
  const res = await request(app).post('/api/auth/login').send({ login: username, password: 'senha-forte-123' }).expect(200);
  return { id: res.body.user.id, username, role: res.body.user.role, accessToken: res.body.accessToken, cookie: '' };
}

async function setupTable() {
  await resetData();
  const master = await registerUser('quiron');
  const player = await registerUser('percy');
  const outsider = await registerUser('luke');
  const char = await createCharacter(player);
  const camp = (await request(app).post('/api/campaigns').set(auth(master)).send({ name: 'O Ladrão de Raios' }).expect(201)).body.campaign;
  await request(app).post('/api/campaigns/join').set(auth(player)).send({ code: camp.joinCode, characterId: char.id }).expect(200);
  tables.unload(camp.id);
  const ms = await socketFor(master);
  const ps = await socketFor(player);
  const mj = await emit<StatePayload>(ms, EVENTS.JOIN, { campaignId: camp.id });
  const pj = await emit<StatePayload>(ps, EVENTS.JOIN, { campaignId: camp.id });
  if (!mj.ok || !pj.ok) throw new Error('join falhou');
  return { master, player, outsider, char, camp, ms, ps, playerState: pj.data };
}

describe('WebSockets: Host ↔ Jogadores', () => {
  it('recusa conexão sem token válido', async () => {
    await expect(new Promise((resolve, reject) => {
      const s = connect(url, { auth: { token: 'lixo' }, transports: ['websocket'], forceNew: true });
      sockets.push(s);
      s.once('connect', () => resolve(true));
      s.once('connect_error', (e) => reject(e));
    })).rejects.toThrow(/Token inválido/);
  });

  it('jogador entra na mesa e recebe o próprio token posicionado no mapa padrão', async () => {
    const { playerState, char, player } = await setupTable();
    expect(playerState.state.map.preset).toBe('acampamento');
    const token = playerState.state.tokens.find((t) => t.characterId === char.id)!;
    expect(token.ownerUserId).toBe(player.id);
    expect(playerState.state.viewer.role).toBe('PLAYER');
  });

  it('quem não é membro não entra na mesa', async () => {
    const { outsider, camp } = await setupTable();
    const os = await socketFor(outsider);
    const r = await emit(os, EVENTS.JOIN, { campaignId: camp.id });
    expect(r.ok).toBe(false);
  });

  it('jogador não executa comandos de Mestre; Mestre injeta monstro oculto invisível ao jogador', async () => {
    const { ms, ps } = await setupTable();
    const denied = await cmd(ps, { type: 'monster.spawn', monsterKey: 'minotauro', x: 5, y: 7, hidden: true, rollHp: false });
    expect(denied).toMatchObject({ ok: false, code: 'forbidden' });

    const playerUpdate = nextState(ps, (p) => p.state.log.some((l) => l.text.includes('Minotauro')) || p.seq > 0);
    const masterUpdate = nextState(ms, (p) => p.state.tokens.some((t) => t.monsterKey === 'minotauro'));
    const ok = await cmd(ms, { type: 'monster.spawn', monsterKey: 'minotauro', x: 5, y: 7, hidden: true, rollHp: false });
    expect(ok.ok).toBe(true);
    const [pv, mv] = await Promise.all([playerUpdate, masterUpdate]);
    expect(mv.state.tokens.some((t) => t.monsterKey === 'minotauro')).toBe(true);
    expect(pv.state.tokens.some((t) => t.monsterKey === 'minotauro')).toBe(false);
    expect(pv.state.log.some((l) => l.text.includes('Minotauro'))).toBe(false);
  });

  it('rolagem secreta do Mestre não chega ao jogador; rolagem pública chega a todos', async () => {
    const { ms, ps } = await setupTable();
    await cmd(ms, { type: 'dice.roll', formula: '1d20+5', visibility: 'secreto', label: 'Percepção do monstro' });
    const pub = nextState(ps, (p) => p.state.log.some((l) => l.type === 'dado'));
    await cmd(ps, { type: 'dice.roll', formula: '2d6', visibility: 'publico' });
    const view = await pub;
    const dice = view.state.log.filter((l) => l.type === 'dado');
    expect(dice).toHaveLength(1);
    expect(dice[0].text).toMatch(/percy/);
  });

  it('comando reenviado com o mesmo id não é aplicado duas vezes', async () => {
    const { ps } = await setupTable();
    const a = await emit<{ seq: number }>(ps, EVENTS.COMMAND, { commandId: 'dup-1', command: { type: 'chat.say', text: 'Olá!' } });
    const b = await emit<{ seq: number }>(ps, EVENTS.COMMAND, { commandId: 'dup-1', command: { type: 'chat.say', text: 'Olá!' } });
    expect(a.ok && b.ok && a.data.seq === b.data.seq).toBe(true);
  });

  it('Mestre pausa o jogador e depois bane: o jogador é expulso e não volta', async () => {
    const { ms, ps, player, camp } = await setupTable();
    await cmd(ms, { type: 'player.pause', userId: player.id, paused: true });
    const denied = await cmd(ps, { type: 'dice.roll', formula: '1d20', visibility: 'publico' });
    expect(denied).toMatchObject({ ok: false, code: 'paused' });

    const kicked = new Promise<{ reason: string }>((r) => ps.once(EVENTS.KICKED, r));
    await cmd(ms, { type: 'player.ban', userId: player.id });
    expect((await kicked).reason).toMatch(/banido/);

    const again = await socketFor(player);
    const r = await emit(again, EVENTS.JOIN, { campaignId: camp.id });
    expect(r.ok).toBe(false);
  });

  it('save e load restauram a mesa exatamente como estava', async () => {
    const { ms, master, camp } = await setupTable();
    await cmd(ms, { type: 'monster.spawn', monsterKey: 'harpia', x: 12, y: 3, hidden: false, rollHp: false });
    const save = await request(app).post(`/api/campaigns/${camp.id}/saves`).set(auth(master)).send({ name: 'Antes da emboscada' }).expect(201);
    expect(await SaveGame.count()).toBe(1);

    const harpy = tables.getState(camp.id)!.tokens.find((t) => t.monsterKey === 'harpia')!;
    await cmd(ms, { type: 'token.update', tokenId: harpy.id, patch: { hp: 1, x: 13, y: 3 } });
    await cmd(ms, { type: 'map.damage', x: 6, y: 2, amount: 50, damageType: 'concussao' });
    expect(tables.getState(camp.id)!.tokens.find((t) => t.id === harpy.id)!.hp).toBe(1);

    await request(app).post(`/api/campaigns/${camp.id}/saves/${save.body.save.id}/load`).set(auth(master)).expect(200);
    const restored = tables.getState(camp.id)!;
    const h = restored.tokens.find((t) => t.id === harpy.id)!;
    expect(h.hp).toBe(h.maxHp);
    expect(h.x).toBe(12);
    expect(restored.map.tiles[2 * restored.map.width + 6].t).toBe('portao');

    // e sobrevive a um "reinício" do servidor
    tables.unload(camp.id);
    await tables.autosaveAll();
    const reloaded = await tables.load(camp.id);
    expect(reloaded.state.tokens.some((t) => t.id === harpy.id)).toBe(true);
  });

  it('histórico de turnos é persistido e filtrado por visibilidade', async () => {
    const { ms, ps, master, player, camp } = await setupTable();
    await cmd(ms, { type: 'dice.roll', formula: '1d20', visibility: 'secreto' });
    await cmd(ps, { type: 'chat.say', text: 'Vamos pela ponte!' });
    const asMaster = await request(app).get(`/api/campaigns/${camp.id}/history`).set(auth(master)).expect(200);
    const asPlayer = await request(app).get(`/api/campaigns/${camp.id}/history`).set(auth(player)).expect(200);
    expect(asMaster.body.events.some((e: { type: string }) => e.type === 'dado')).toBe(true);
    expect(asPlayer.body.events.some((e: { type: string }) => e.type === 'dado')).toBe(false);
    expect(asPlayer.body.events.some((e: { text: string }) => e.text.includes('ponte'))).toBe(true);
  });

  it('XP de quest e de recompensa salva na ficha, sobe de nível e entrega itens/dracmas', async () => {
    const { char, ms, ps, playerState } = await setupTable();
    const tokenId = playerState.state.tokens.find((t) => t.characterId === char.id)!.id;
    const before = await request(app).get(`/api/characters/${char.id}`).set(auth(await loginAs('percy')));
    expect(before.body.character.level).toBe(1);

    const r1 = await cmd(ms, { type: 'reward.grant', tokenIds: 'todos', xp: 300, dracmas: 15, items: [{ itemKey: 'nectar', quantity: 2 }], reason: 'teste' });
    expect(r1.ok).toBe(true);
    const after = (await request(app).get(`/api/characters/${char.id}`).set(auth(await loginAs('percy')))).body.character;
    expect(after.level).toBe(2);
    expect(after.experience).toBe(300);
    expect(after.stats.maxHp).toBeGreaterThan(before.body.character.stats.maxHp);
    expect(after.inventory.find((i: { itemKey: string }) => i.itemKey === 'dracmas').quantity).toBe(15);
    expect(after.inventory.find((i: { itemKey: string }) => i.itemKey === 'nectar').quantity).toBe(2);
    const tok = tables.getState(playerState.state.campaignId)!.tokens.find((t) => t.id === tokenId)!;
    expect(tok.level).toBe(2);
    expect(tok.maxHp).toBe(after.stats.maxHp);

    // Baú ao lado do herói: abrir guarda o loot no inventário
    const st = tables.getState(playerState.state.campaignId)!;
    const free = [[1, 0], [0, 1], [-1, 0], [0, -1]].map(([dx, dy]) => ({ x: tok.x + dx, y: tok.y + dy }))
      .find((c) => st.map.tiles[c.y * st.map.width + c.x] && ['grama', 'terra', 'pedra'].includes(st.map.tiles[c.y * st.map.width + c.x].t) && !st.map.tiles[c.y * st.map.width + c.x].o)!;
    expect((await cmd(ms, { type: 'chest.place', x: free.x, y: free.y, loot: [{ itemKey: 'ambrosia', quantity: 1 }], dracmas: 5 })).ok).toBe(true);
    const open = await cmd(ps, { type: 'object.open', tokenId, x: free.x, y: free.y });
    expect(open.ok).toBe(true);
    const inv = (await request(app).get(`/api/characters/${char.id}`).set(auth(await loginAs('percy')))).body.character.inventory;
    expect(inv.find((i: { itemKey: string }) => i.itemKey === 'ambrosia').quantity).toBe(1);
    expect(inv.find((i: { itemKey: string }) => i.itemKey === 'dracmas').quantity).toBe(20);
  });

  it('teste pedido pelo Mestre é rolado pelo jogador e registrado', async () => {
    const { ms, ps, player } = await setupTable();
    expect((await cmd(ms, { type: 'check.request', userIds: 'todos', kind: 'pericia', key: 'percepcao', dc: 1, secretDc: false })).ok).toBe(true);
    const waiting = nextState(ps, (p) => (p.state.checks ?? []).some((c) => c.status !== 'pendente'));
    const st = (await emit<StatePayload>(ps, EVENTS.RESYNC, {})) as { ok: true; data: StatePayload };
    const check = st.data.state.checks!.find((c) => c.userId === player.id)!;
    expect((await cmd(ps, { type: 'check.roll', checkId: check.id, advantage: 'normal' })).ok).toBe(true);
    const done = (await waiting).state.checks!.find((c) => c.id === check.id)!;
    expect(done.status).toBe('sucesso');
  });
});
