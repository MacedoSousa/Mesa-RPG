import {
  OBJECTS, PRESET_MAPS, applyCommand, buildPresetMap, createContext, elementReaction, findPath, hasLineOfSight, seededRng, tileAt,
} from '../src';
import { MASTER, baseState, heroToken, withTokens } from './helpers';

describe('Mapas padrão', () => {
  it.each(PRESET_MAPS.map((p) => p.key))('%s é construído com dimensões consistentes', (key) => {
    const map = buildPresetMap(key);
    expect(map.tiles).toHaveLength(map.width * map.height);
    expect(map.width).toBe(24);
    const preset = PRESET_MAPS.find((p) => p.key === key)!;
    for (const s of preset.spawns) {
      const t = tileAt(map, s.x, s.y)!;
      expect(['grama', 'terra', 'pedra', 'marmore', 'nuvem', 'areia', 'madeira']).toContain(t.t);
    }
  });
});

describe('Reações de superfície (estilo BG3)', () => {
  it('fogo + água = vapor; raio + água = água eletrificada; gelo + água = gelo', () => {
    expect(elementReaction({ t: 'terra', s: { type: 'agua', rounds: 3 } }, 'fogo').surface).toBe('vapor');
    expect(elementReaction({ t: 'terra', s: { type: 'agua', rounds: 3 } }, 'raio').surface).toBe('agua_eletrificada');
    expect(elementReaction({ t: 'terra', s: { type: 'agua', rounds: 3 } }, 'gelo').surface).toBe('gelo');
  });

  it('fogo em óleo inflama; água em lava resfria em pedra', () => {
    expect(elementReaction({ t: 'terra', s: { type: 'oleo', rounds: 3 } }, 'fogo')).toMatchObject({ surface: 'fogo', ignite: true });
    expect(elementReaction({ t: 'lava' }, 'agua')).toMatchObject({ surface: 'vapor', terrain: 'pedra' });
  });

  it('água eletrificada dobra dano elétrico em quem está molhado', () => {
    const state = withTokens(baseState(), heroToken('c1', 'u_p1', 2, 2));
    let { state: s1 } = applyCommand(state, MASTER, { type: 'map.element', x: 2, y: 2, radius: 1, element: 'agua' }, seededRng(1));
    expect(s1.tokens[0].conditions).toContain('molhado');
    const hpBefore = s1.tokens[0].hp;
    ({ state: s1 } = applyCommand(s1, MASTER, { type: 'map.element', x: 2, y: 2, radius: 0, element: 'raio', damage: '6' }, seededRng(1)));
    expect(tileAt(s1.map, 2, 2)!.s!.type).toBe('agua_eletrificada');
    // 6 de dano elétrico dobrado = 12 (ou 6 se passou no teste de DES)
    const lost = hpBefore - s1.tokens[0].hp;
    expect([6, 12]).toContain(lost);
  });
});

describe('Mapa destrutível', () => {
  it('parede destruída vira escombros e libera a passagem e a visão', () => {
    const state = baseState(5, 3);
    for (let y = 0; y < 3; y++) state.map.tiles[y * 5 + 2] = { t: 'parede' };
    withTokens(state, heroToken('c1', 'u_p1', 0, 1));
    expect(findPath(state, 'tok_c1', { x: 0, y: 1 }, { x: 4, y: 1 })).toBeNull();
    expect(hasLineOfSight(state, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(false);

    const { state: after, ctx } = applyCommand(state, MASTER, { type: 'map.damage', x: 2, y: 1, amount: 30, damageType: 'concussao' });
    expect(tileAt(after.map, 2, 1)!.t).toBe('escombros');
    expect(ctx.fx.some((f) => f.type === 'destruicao')).toBe(true);
    expect(findPath(after, 'tok_c1', { x: 0, y: 1 }, { x: 4, y: 1 })).not.toBeNull();
    expect(hasLineOfSight(after, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(true);
  });

  it('parede é imune a fogo, árvore queima com dano dobrado', () => {
    const state = baseState(4, 1);
    state.map.tiles[0] = { t: 'parede' };
    state.map.tiles[1] = { t: 'arvore' };
    const { state: s1 } = applyCommand(state, MASTER, { type: 'map.damage', x: 0, y: 0, amount: 50, damageType: 'fogo' });
    expect(tileAt(s1.map, 0, 0)!.t).toBe('parede');
    const { state: s2 } = applyCommand(s1, MASTER, { type: 'map.damage', x: 1, y: 0, amount: 6, damageType: 'fogo' });
    expect(tileAt(s2.map, 1, 0)!.t).toBe('toco');
  });

  it('barril explosivo explode em cadeia e espalha fogo', () => {
    const state = baseState(6, 1);
    state.map.tiles[1].o = { type: 'barril_explosivo', hp: OBJECTS.barril_explosivo.maxHp };
    state.map.tiles[2].o = { type: 'barril_explosivo', hp: OBJECTS.barril_explosivo.maxHp };
    const { state: after, ctx } = applyCommand(state, MASTER, { type: 'map.damage', x: 1, y: 0, amount: 10, damageType: 'concussao' }, seededRng(3));
    expect(tileAt(after.map, 1, 0)!.o).toBeNull();
    expect(tileAt(after.map, 2, 0)!.o).toBeNull();
    expect(ctx.fx.filter((f) => f.type === 'explosao')).toHaveLength(2);
    expect(tileAt(after.map, 3, 0)!.s?.type).toBe('fogo');
  });

  it('ponte destruída derruba quem está em cima na água', () => {
    const state = baseState(3, 1);
    state.map.tiles[1] = { t: 'ponte' };
    withTokens(state, heroToken('c1', 'u_p1', 1, 0));
    const { state: after } = applyCommand(state, MASTER, { type: 'map.damage', x: 1, y: 0, amount: 20, damageType: 'cortante' });
    expect(tileAt(after.map, 1, 0)!.t).toBe('agua_profunda');
    expect(after.tokens[0].conditions).toEqual(expect.arrayContaining(['molhado', 'caido']));
  });

  it('água profunda congelada vira caminho', () => {
    const state = baseState(3, 1);
    state.map.tiles[1] = { t: 'agua_profunda' };
    withTokens(state, heroToken('c1', 'u_p1', 0, 0));
    expect(findPath(state, 'tok_c1', { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
    const ctx = createContext(state, MASTER);
    void ctx;
    const { state: frozen } = applyCommand(state, MASTER, { type: 'map.element', x: 1, y: 0, radius: 0, element: 'gelo' });
    expect(findPath(frozen, 'tok_c1', { x: 0, y: 0 }, { x: 2, y: 0 })).not.toBeNull();
  });
});
