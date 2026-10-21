import { CommandError, applyCommand, fixedRng, projectStateFor, seededRng, migrateTableState, TABLE_SCHEMA_VERSION } from '../src';
import { MASTER, PLAYER, PLAYER2, baseState, heroToken, monster, withTokens } from './helpers';

function combatState() {
  const state = withTokens(
    baseState(),
    heroToken('c1', PLAYER.userId, 1, 1),
    heroToken('c2', PLAYER2.userId, 2, 1),
    monster('harpia', 6, 6, 'm1'),
  );
  return applyCommand(state, MASTER, { type: 'combat.start' }, seededRng(5)).state;
}

describe('Iniciativa e turnos estritos', () => {
  it('ordena por iniciativa e dá a vez ao primeiro', () => {
    const s = combatState();
    expect(s.phase).toBe('combate');
    expect(s.combat!.order).toHaveLength(3);
    const inits = s.combat!.order.map((e) => e.initiative);
    expect([...inits].sort((a, b) => b - a)).toEqual(inits);
  });

  it('jogador não pode agir fora do seu turno', () => {
    let s = combatState();
    // garante que o turno atual NÃO é de c1
    while (s.combat!.order[s.combat!.turnIndex].tokenId === 'tok_c1') s = applyCommand(s, MASTER, { type: 'combat.next' }).state;
    expect(() => applyCommand(s, PLAYER, { type: 'token.move', tokenId: 'tok_c1', x: 1, y: 2 })).toThrow(/Aguarde o seu turno/);
  });

  it('jogador não controla o personagem de outro jogador', () => {
    let s = combatState();
    while (s.combat!.order[s.combat!.turnIndex].tokenId !== 'tok_c2') s = applyCommand(s, MASTER, { type: 'combat.next' }).state;
    expect(() => applyCommand(s, PLAYER, { type: 'token.move', tokenId: 'tok_c2', x: 2, y: 2 })).toThrow(/próprio personagem/);
  });

  it('economia de ações: uma Ação por turno e movimento limitado', () => {
    let s = combatState();
    while (s.combat!.order[s.combat!.turnIndex].tokenId !== 'tok_c1') s = applyCommand(s, MASTER, { type: 'combat.next' }).state;
    s = applyCommand(s, PLAYER, { type: 'combat.action', tokenId: 'tok_c1', action: 'esquivar' }).state;
    expect(s.tokens.find((t) => t.id === 'tok_c1')!.conditions).toContain('esquivando');
    expect(() => applyCommand(s, PLAYER, { type: 'combat.action', tokenId: 'tok_c1', action: 'disparada' })).toThrow(/já usou sua Ação/);
    // velocidade 6 quadrados: (1,1) → (8,1) custa 7
    expect(() => applyCommand(s, PLAYER, { type: 'token.move', tokenId: 'tok_c1', x: 8, y: 1 })).toThrow(/fora do alcance/);
    s = applyCommand(s, PLAYER, { type: 'token.move', tokenId: 'tok_c1', x: 1, y: 7 }).state;
    expect(s.combat!.economy.tok_c1.movement).toBe(0);
  });

  it('encerrar o turno passa a vez e renova a economia; rodada avança', () => {
    let s = combatState();
    const first = s.combat!.order[0].tokenId;
    const round = s.combat!.round;
    for (let i = 0; i < 3; i++) {
      const current = s.combat!.order[s.combat!.turnIndex].tokenId;
      s = applyCommand(s, MASTER, current.startsWith('tok_') ? { type: 'combat.endTurn', tokenId: current } : { type: 'combat.next' }).state;
    }
    expect(s.combat!.round).toBe(round + 1);
    expect(s.combat!.order[s.combat!.turnIndex].tokenId).toBe(first);
  });
});

describe('Ataques', () => {
  it('20 natural é crítico e aplica dano extra do bronze celestial em monstros', () => {
    const state = withTokens(baseState(), heroToken('c1', PLAYER.userId, 1, 1), monster('minotauro', 2, 1, 'm1'));
    const hp = state.tokens[1].hp;
    const { state: s, ctx } = applyCommand(state, PLAYER, { type: 'combat.attack', tokenId: 'tok_c1', targetId: 'm1', attackIndex: 0 }, fixedRng([20, 8, 8, 4, 4]));
    const log = ctx.newLog.find((l) => l.type === 'combate')!;
    expect(log.data).toMatchObject({ hit: true, critical: true });
    expect(s.tokens[1].hp).toBeLessThan(hp);
  });

  it('1 natural sempre erra', () => {
    const state = withTokens(baseState(), heroToken('c1', PLAYER.userId, 1, 1), monster('harpia', 2, 1, 'm1'));
    const { ctx } = applyCommand(state, PLAYER, { type: 'combat.attack', tokenId: 'tok_c1', targetId: 'm1', attackIndex: 0 }, fixedRng([1]));
    expect(ctx.newLog[0].data).toMatchObject({ hit: false });
  });

  it('não ataca fora do alcance da arma', () => {
    const state = withTokens(baseState(), heroToken('c1', PLAYER.userId, 0, 0), monster('harpia', 5, 5, 'm1'));
    expect(() => applyCommand(state, PLAYER, { type: 'combat.attack', tokenId: 'tok_c1', targetId: 'm1', attackIndex: 0 })).toThrow(/fora de alcance/);
  });

  it('empurrar para o abismo causa dano de queda', () => {
    const state = withTokens(baseState(4, 1), heroToken('c1', PLAYER.userId, 0, 0), monster('harpia', 1, 0, 'm1'));
    state.map.tiles[2] = { t: 'abismo' };
    const hp = state.tokens[1].hp;
    const { state: s } = applyCommand(state, PLAYER, { type: 'combat.shove', tokenId: 'tok_c1', targetId: 'm1' }, fixedRng([20, 1, 6, 6, 6, 6, 6, 6]));
    expect(s.tokens[1].x).toBe(2);
    expect(s.tokens[1].hp).toBeLessThan(hp);
  });

  it('poder divino de Poseidon gasta estamina e molha a área', () => {
    const state = withTokens(baseState(), heroToken('c1', PLAYER.userId, 1, 1), monster('harpia', 4, 4, 'm1'));
    const stamina = state.tokens[0].stamina;
    const { state: s } = applyCommand(state, PLAYER, { type: 'combat.power', tokenId: 'tok_c1', x: 4, y: 4 }, seededRng(2));
    expect(s.tokens[0].stamina).toBe(stamina - 2);
    expect(s.tokens[1].conditions).toContain('molhado');
  });

  it('usar poção consome o item e gera efeito colateral para o servidor', () => {
    const state = withTokens(baseState(), heroToken('c1', PLAYER.userId, 1, 1));
    state.tokens[0].hp = 3;
    const { state: s, ctx } = applyCommand(state, PLAYER, { type: 'item.use', tokenId: 'tok_c1', itemKey: 'pocao_cura' }, seededRng(1));
    expect(s.tokens[0].hp).toBeGreaterThan(3);
    expect(s.tokens[0].consumables.pocao_cura).toBe(1);
    expect(ctx.sideEffects).toContainEqual({ type: 'consumable_used', characterId: 'c1', itemKey: 'pocao_cura', quantity: 1 });
  });
});

describe('RBAC e informação oculta', () => {
  it('jogador não executa comandos de Mestre', () => {
    const state = baseState();
    for (const cmd of [
      { type: 'monster.spawn', monsterKey: 'harpia', x: 1, y: 1, hidden: false, rollHp: false } as const,
      { type: 'combat.start' } as const,
      { type: 'table.setPaused', paused: true } as const,
      { type: 'player.ban', userId: PLAYER2.userId } as const,
    ]) {
      expect(() => applyCommand(state, PLAYER, cmd)).toThrow(CommandError);
    }
  });

  it('rolagem secreta é exclusiva do Mestre e invisível para jogadores', () => {
    const state = baseState();
    expect(() => applyCommand(state, PLAYER, { type: 'dice.roll', formula: '1d20', visibility: 'secreto' })).toThrow(/exclusivas do Mestre/);
    const { state: s } = applyCommand(state, MASTER, { type: 'dice.roll', formula: '1d20', visibility: 'secreto' });
    expect(projectStateFor(s, MASTER).log).toHaveLength(1);
    expect(projectStateFor(s, PLAYER).log).toHaveLength(0);
  });

  it('rolagem privada aparece só para o autor e o Mestre', () => {
    const { state: s } = applyCommand(baseState(), PLAYER, { type: 'dice.roll', formula: '1d20+2', visibility: 'privado' });
    expect(projectStateFor(s, PLAYER).log).toHaveLength(1);
    expect(projectStateFor(s, PLAYER2).log).toHaveLength(0);
    expect(projectStateFor(s, MASTER).log).toHaveLength(1);
  });

  it('monstro oculto e PV de monstros não chegam ao jogador', () => {
    const state = withTokens(baseState(), heroToken('c1', PLAYER.userId), monster('harpia', 3, 3, 'm1'), monster('minotauro', 5, 5, 'm2', true));
    const view = projectStateFor(state, PLAYER);
    expect(view.tokens.map((t) => t.id)).toEqual(['tok_c1', 'm1']);
    const harpy = view.tokens.find((t) => t.id === 'm1')!;
    expect(harpy.hp).toBeNull();
    expect(harpy.attacks).toEqual([]);
    expect(projectStateFor(state, MASTER).tokens).toHaveLength(3);
  });

  it('mesa pausada bloqueia ações de jogadores (mas não o chat)', () => {
    const state = withTokens(baseState(), heroToken('c1', PLAYER.userId));
    const { state: paused } = applyCommand(state, MASTER, { type: 'table.setPaused', paused: true });
    expect(() => applyCommand(paused, PLAYER, { type: 'token.move', tokenId: 'tok_c1', x: 2, y: 2 })).toThrow(/pausada/);
    expect(() => applyCommand(paused, PLAYER, { type: 'chat.say', text: 'oi' })).not.toThrow();
  });

  it('comando inválido não altera o estado original', () => {
    const state = withTokens(baseState(), heroToken('c1', PLAYER.userId));
    const before = JSON.stringify(state);
    expect(() => applyCommand(state, PLAYER, { type: 'token.move', tokenId: 'tok_c1', x: 99, y: 99 })).toThrow();
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('Side quests temporárias', () => {
  it('expira por rodada e dispara o gatilho de invocar monstro', () => {
    let s = combatState();
    s = applyCommand(s, MASTER, {
      type: 'quest.create', title: 'Proteja o estandarte', description: '', hidden: false, target: 1, reward: '50 dracmas',
      expiresInRounds: 1, onExpire: { message: 'Reforços inimigos!', spawn: { monsterKey: 'esqueleto_spartoi', x: 8, y: 8 } },
    }).state;
    const count = s.tokens.length;
    for (let i = 0; i < 3; i++) s = applyCommand(s, MASTER, { type: 'combat.next' }).state;
    expect(s.sideQuests[0].status).toBe('expirada');
    expect(s.tokens.length).toBe(count + 1);
  });

  it('conclui ao atingir o progresso alvo', () => {
    let s = applyCommand(baseState(), MASTER, { type: 'quest.create', title: 'Derrote 2 harpias', description: '', hidden: false, target: 2, reward: '' }).state;
    const id = s.sideQuests[0].id;
    s = applyCommand(s, MASTER, { type: 'quest.progress', id, delta: 2 }).state;
    expect(s.sideQuests[0].status).toBe('concluida');
  });
});

describe('Save/Load', () => {
  it('migra saves antigos para a versão atual', () => {
    const old = { ...baseState(), schemaVersion: 0 } as Record<string, unknown>;
    delete old.chapters;
    delete old.sideQuests;
    const migrated = migrateTableState(JSON.parse(JSON.stringify(old)));
    expect(migrated.schemaVersion).toBe(TABLE_SCHEMA_VERSION);
    expect(migrated.chapters).toEqual([]);
    expect(Object.values(migrated.players).every((p) => !p.connected)).toBe(true);
  });

  it('recusa saves de versões futuras', () => {
    expect(() => migrateTableState({ ...baseState(), schemaVersion: 999 })).toThrow(/mais novo/);
  });
});
