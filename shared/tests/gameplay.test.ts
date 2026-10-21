import { applyCommand, fixedRng, levelForXp, projectStateFor, seededRng, tileAt, xpForNextLevel } from '../src';
import { MASTER, PLAYER, PLAYER2, baseState, heroToken, monster, withTokens } from './helpers';

function startCombatWith(state = withTokens(baseState(), heroToken('c1', PLAYER.userId, 1, 1), monster('harpia', 6, 1, 'm1'))) {
  return applyCommand(state, MASTER, { type: 'combat.start' }, seededRng(9)).state;
}

function untilTurn(state: ReturnType<typeof startCombatWith>, tokenId: string) {
  let s = state;
  for (let i = 0; i < 6 && s.combat!.order[s.combat!.turnIndex].tokenId !== tokenId; i++) s = applyCommand(s, MASTER, { type: 'combat.next' }).state;
  return s;
}

describe('Mestre controla os monstros', () => {
  it('turno automático: o monstro anda até o herói e ataca', () => {
    let s = untilTurn(startCombatWith(), 'm1');
    const { state, ctx } = applyCommand(s, MASTER, { type: 'combat.auto', tokenId: 'm1' }, seededRng(4));
    s = state;
    const harpy = s.tokens.find((t) => t.id === 'm1')!;
    expect(Math.max(Math.abs(harpy.x - 1), Math.abs(harpy.y - 1))).toBe(1); // ficou colada no herói
    expect(ctx.newLog.some((l) => /acerta|erra/.test(l.text))).toBe(true);
    expect(s.combat!.economy.m1.action).toBe(0);
  });

  it('Mestre ataca com qualquer golpe do monstro no turno dele', () => {
    const st = withTokens(baseState(), heroToken('c1', PLAYER.userId, 1, 1), monster('minotauro', 2, 1, 'm1'));
    const s = untilTurn(startCombatWith(st), 'm1');
    const hp = s.tokens.find((t) => t.id === 'tok_c1')!.hp;
    const { state } = applyCommand(s, MASTER, { type: 'combat.attack', tokenId: 'm1', targetId: 'tok_c1', attackIndex: 1 }, fixedRng([20, 8, 8, 8, 8]));
    expect(state.tokens.find((t) => t.id === 'tok_c1')!.hp).toBeLessThan(hp);
  });

  it('não deixa o monstro agir fora do turno', () => {
    let s = startCombatWith();
    s = untilTurn(s, 'tok_c1');
    expect(() => applyCommand(s, MASTER, { type: 'combat.auto', tokenId: 'm1' })).toThrow(/turno/);
  });
});

describe('Dano e cura aplicados pelo Mestre', () => {
  it('aplica dano fixo, por fórmula, pela metade e cura', () => {
    let s = withTokens(baseState(), heroToken('c1', PLAYER.userId), heroToken('c2', PLAYER2.userId, 3, 3));
    const max = s.tokens[0].maxHp;
    s = applyCommand(s, MASTER, { type: 'token.damage', tokenIds: ['tok_c1', 'tok_c2'], amount: 5, damageType: 'cortante', heal: false, half: false }).state;
    expect(s.tokens.map((t) => t.hp)).toEqual([max - 5, max - 5]);
    s = applyCommand(s, MASTER, { type: 'token.damage', tokenIds: ['tok_c1'], formula: '4', damageType: 'fogo', heal: false, half: true }).state;
    expect(s.tokens[0].hp).toBe(max - 7);
    s = applyCommand(s, MASTER, { type: 'token.damage', tokenIds: ['tok_c1'], amount: 100, damageType: 'concussao', heal: true, half: false }).state;
    expect(s.tokens[0].hp).toBe(max);
  });

  it('jogador não aplica dano direto', () => {
    const s = withTokens(baseState(), heroToken('c1', PLAYER.userId));
    expect(() => applyCommand(s, PLAYER, { type: 'token.damage', tokenIds: ['tok_c1'], amount: 5, damageType: 'fogo', heal: false, half: false })).toThrow(/Mestre/);
  });

  it('herói com 0 PV rola salvaguardas contra a morte no turno dele', () => {
    let s = startCombatWith();
    s = applyCommand(s, MASTER, { type: 'token.damage', tokenIds: ['tok_c1'], amount: 999, damageType: 'concussao', heal: false, half: false }).state;
    expect(s.tokens[0].conditions).toContain('inconsciente');
    for (let i = 0; i < 8; i++) s = applyCommand(s, MASTER, { type: 'combat.next' }, fixedRng([5])).state;
    const hero = s.tokens.find((t) => t.id === 'tok_c1')!;
    expect(hero.dead).toBe(true); // três falhas seguidas
    expect(s.log.some((l) => /salvaguarda contra a morte/.test(l.text))).toBe(true);
  });
});

describe('Testes pedidos pelo Mestre (a rolagem vale!)', () => {
  it('jogador rola o teste pedido com a perícia treinada e o resultado é registrado', () => {
    let s = withTokens(baseState(), heroToken('c1', PLAYER.userId));
    s = applyCommand(s, MASTER, { type: 'check.request', userIds: 'todos', kind: 'pericia', key: 'atletismo', dc: 10, secretDc: false }).state;
    const check = s.checks![0];
    expect(check.status).toBe('pendente');
    const { state, ctx } = applyCommand(s, PLAYER, { type: 'check.roll', checkId: check.id, advantage: 'normal' }, fixedRng([8]));
    const done = state.checks![0];
    // Força 15 (+2) + proficiência em Atletismo (+2) + d20 = 8 → 12 ≥ 10
    expect(done.total).toBe(12);
    expect(done.status).toBe('sucesso');
    expect(ctx.newLog.at(-1)!.text).toMatch(/SUCESSO/);
  });

  it('não dá para rolar o teste de outro jogador nem rolar duas vezes', () => {
    let s = withTokens(baseState(), heroToken('c1', PLAYER.userId), heroToken('c2', PLAYER2.userId, 4, 4));
    s = applyCommand(s, MASTER, { type: 'check.request', userIds: [PLAYER.userId], kind: 'atributo', key: 'sabedoria', dc: 15, secretDc: true }).state;
    const id = s.checks![0].id;
    expect(() => applyCommand(s, PLAYER2, { type: 'check.roll', checkId: id, advantage: 'normal' })).toThrow(/outro jogador/);
    s = applyCommand(s, PLAYER, { type: 'check.roll', checkId: id, advantage: 'normal' }).state;
    expect(() => applyCommand(s, PLAYER, { type: 'check.roll', checkId: id, advantage: 'normal' })).toThrow(/já foi rolado/);
  });

  it('CD secreta não chega ao jogador', () => {
    let s = withTokens(baseState(), heroToken('c1', PLAYER.userId));
    s = applyCommand(s, MASTER, { type: 'check.request', userIds: 'todos', kind: 'pericia', key: 'percepcao', dc: 17, secretDc: true }).state;
    expect(projectStateFor(s, PLAYER).checks![0].dc).toBe(0);
    expect(projectStateFor(s, MASTER).checks![0].dc).toBe(17);
  });
});

describe('XP, níveis e recompensas', () => {
  it('tabela de XP do SRD', () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(299)).toBe(1);
    expect(levelForXp(300)).toBe(2);
    expect(levelForXp(2700)).toBe(4);
    expect(xpForNextLevel(1)).toBe(300);
  });

  it('derrotar um monstro divide o XP entre os heróis', () => {
    let s = withTokens(baseState(), heroToken('c1', PLAYER.userId), heroToken('c2', PLAYER2.userId, 3, 3), monster('harpia', 5, 5, 'm1'));
    const { ctx } = applyCommand(s, MASTER, { type: 'token.damage', tokenIds: ['m1'], amount: 999, damageType: 'cortante', heal: false, half: false });
    const rewards = ctx.sideEffects.filter((e) => e.type === 'reward');
    expect(rewards).toHaveLength(2);
    expect(rewards[0]).toMatchObject({ xp: 100 }); // harpia = 200 XP / 2 heróis
    void s;
  });

  it('quest concluída entrega XP, dracmas e itens a todos', () => {
    let s = withTokens(baseState(), heroToken('c1', PLAYER.userId), heroToken('c2', PLAYER2.userId, 3, 3));
    s = applyCommand(s, MASTER, {
      type: 'quest.create', title: 'Salve o sátiro', description: '', hidden: false, target: 1, reward: 'gratidão',
      rewardXp: 150, rewardDracmas: 10, rewardItems: [{ itemKey: 'nectar', quantity: 1 }],
    }).state;
    const { state, ctx } = applyCommand(s, MASTER, { type: 'quest.update', id: s.sideQuests[0].id, status: 'concluida' });
    expect(state.sideQuests[0].status).toBe('concluida');
    const rewards = ctx.sideEffects.filter((e) => e.type === 'reward');
    expect(rewards).toHaveLength(2);
    expect(rewards[0]).toMatchObject({ xp: 150, dracmas: 10, items: [{ itemKey: 'nectar', quantity: 1 }] });
    expect(state.tokens[0].consumables.nectar).toBe(1);
  });

  it('Mestre dá recompensa avulsa e item desconhecido é recusado', () => {
    const s = withTokens(baseState(), heroToken('c1', PLAYER.userId));
    const { ctx } = applyCommand(s, MASTER, { type: 'reward.grant', tokenIds: ['tok_c1'], xp: 300, dracmas: 0, items: [], reason: 'boa ideia' });
    expect(ctx.sideEffects).toContainEqual(expect.objectContaining({ type: 'reward', characterId: 'c1', xp: 300 }));
    expect(() => applyCommand(s, MASTER, { type: 'reward.grant', tokenIds: 'todos', xp: 0, dracmas: 0, items: [{ itemKey: 'nao_existe', quantity: 1 }], reason: 'x' })).toThrow(/desconhecido/);
  });
});

describe('Baús de tesouro', () => {
  it('Mestre coloca, jogador vê só que existe; herói ao lado abre e recebe o loot', () => {
    let s = withTokens(baseState(), heroToken('c1', PLAYER.userId, 1, 1));
    s = applyCommand(s, MASTER, { type: 'chest.place', x: 2, y: 1, loot: [{ itemKey: 'pocao_cura', quantity: 2 }], dracmas: 25 }).state;
    const playerTile = projectStateFor(s, PLAYER).map.tiles[1 * s.map.width + 2];
    expect(playerTile.o).toEqual({ type: 'bau', hp: 999 });
    const { state, ctx } = applyCommand(s, PLAYER, { type: 'object.open', tokenId: 'tok_c1', x: 2, y: 1 });
    expect(tileAt(state.map, 2, 1)!.o!.type).toBe('bau_aberto');
    expect(ctx.sideEffects).toContainEqual(expect.objectContaining({ type: 'reward', characterId: 'c1', dracmas: 25, items: [{ itemKey: 'pocao_cura', quantity: 2 }] }));
    expect(state.tokens[0].consumables.pocao_cura).toBe(4);
    expect(() => applyCommand(state, PLAYER, { type: 'object.open', tokenId: 'tok_c1', x: 2, y: 1 })).toThrow(/já foi aberto/);
  });

  it('baú longe não abre; trancado exige teste; tabela sorteia conteúdo', () => {
    let s = withTokens(baseState(), heroToken('c1', PLAYER.userId, 1, 1));
    s = applyCommand(s, MASTER, { type: 'chest.place', x: 5, y: 5, loot: [], dracmas: 0, tier: 'raro' }, seededRng(3)).state;
    expect(tileAt(s.map, 5, 5)!.o!.loot!.length).toBe(4); // 3 itens da tabela + 1 arma/armadura com rank
    expect(() => applyCommand(s, PLAYER, { type: 'object.open', tokenId: 'tok_c1', x: 5, y: 5 })).toThrow(/ao lado/);
    s = applyCommand(s, MASTER, { type: 'chest.place', x: 2, y: 2, loot: [{ itemKey: 'tocha', quantity: 1 }], dracmas: 0, lockDc: 30 }).state;
    const fail = applyCommand(s, PLAYER, { type: 'object.open', tokenId: 'tok_c1', x: 2, y: 2 }, fixedRng([5])).state;
    expect(tileAt(fail.map, 2, 2)!.o!.type).toBe('bau');
  });

  it('baú não é destruído por explosões', () => {
    let s = baseState(4, 1);
    s = applyCommand(s, MASTER, { type: 'chest.place', x: 1, y: 0, loot: [], dracmas: 5 }).state;
    s = applyCommand(s, MASTER, { type: 'map.damage', x: 1, y: 0, amount: 500, damageType: 'fogo' }).state;
    expect(tileAt(s.map, 1, 0)!.o!.type).toBe('bau');
  });
});

describe('Carregar aventura', () => {
  it('cria capítulos e quests de uma vez', () => {
    const { state } = applyCommand(baseState(), MASTER, {
      type: 'adventure.load', replace: true,
      chapters: [{ title: 'Cap 1', description: 'a' }, { title: 'Cap 2', description: 'b' }],
      quests: [{ title: 'Q', description: '', hidden: true, target: 1, reward: '', rewardXp: 50, rewardDracmas: 0, rewardItems: [] }],
    });
    expect(state.chapters.map((c) => c.title)).toEqual(['Cap 1', 'Cap 2']);
    expect(state.sideQuests[0]).toMatchObject({ title: 'Q', rewardXp: 50, hidden: true });
  });
});
