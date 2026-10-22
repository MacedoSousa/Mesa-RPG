import { SCENES, getItem, MONSTERS, LOOT_TABLES, PRESET_MAPS, ADVENTURES } from '../src';

describe('cenas da aventura', () => {
  it('referenciam itens, monstros, mapas e capítulos que existem', () => {
    const chapters = ADVENTURES[0].chapters.length;
    for (const s of SCENES) {
      expect(s.chapter).toBeGreaterThanOrEqual(1);
      expect(s.chapter).toBeLessThanOrEqual(chapters);
      if ('preset' in s.map) { const k = s.map.preset; expect(PRESET_MAPS.find((p) => p.key === k)).toBeTruthy(); }
      for (const m of s.monsters) expect(MONSTERS[m.key]).toBeTruthy();
      for (const c of s.chests) {
        for (const l of c.loot ?? []) expect(getItem(l.itemKey)).toBeTruthy();
        if (c.tier) expect(LOOT_TABLES[c.tier]).toBeTruthy();
      }
      expect(s.quests.some((q) => q.required)).toBe(true);
    }
  });
});

import { applyCommand, projectStateFor, tileAt as tileAt2 } from '../src';
import { MASTER, PLAYER, baseState, heroToken, withTokens } from './helpers';

describe('carregar cena', () => {
  it('monta mapa, esconde baús e monstros dos jogadores e cria quests obrigatórias', () => {
    const s0 = withTokens(baseState(), heroToken('c1', PLAYER.userId, 1, 1));
    const { state, ctx } = applyCommand(s0, MASTER, { type: 'scene.load', sceneKey: 'c1_fuga', keepMonsters: false });
    expect(state.map.width).toBe(24);
    expect(state.sceneKey).toBe('c1_fuga');
    expect(state.tokens.some((t) => t.monsterKey === 'minotauro')).toBe(true);
    const hiddenChests = state.map.tiles.filter((t) => t.o?.type === 'bau' && t.o.hidden);
    const shownChests = state.map.tiles.filter((t) => t.o?.type === 'bau' && !t.o.hidden);
    expect(hiddenChests.length).toBe(1);
    expect(shownChests.length).toBe(1);
    const view = projectStateFor(state, PLAYER);
    expect(view.map.tiles.filter((t) => t.o?.type === 'bau').length).toBe(1);
    expect(state.sideQuests.find((q) => q.title === 'Chegar ao pinheiro')?.required).toBe(true);
    expect(state.sideQuests.find((q) => q.title === 'Ninguém fica para trás')?.required).toBe(false);
    expect(ctx.fx).toContainEqual(expect.objectContaining({ type: 'banner', kind: 'capitulo' }));
    // revelar o baú escondido
    const idx = state.map.tiles.findIndex((t) => t.o?.type === 'bau' && t.o.hidden);
    const x = idx % state.map.width, y = Math.floor(idx / state.map.width);
    const r = applyCommand(state, MASTER, { type: 'object.reveal', x, y, hidden: false });
    expect(tileAt2(r.state.map, x, y)!.o!.hidden).toBeUndefined();
    expect(projectStateFor(r.state, PLAYER).map.tiles.filter((t) => t.o?.type === 'bau').length).toBe(2);
    // recarregar não duplica quests
    const again = applyCommand(r.state, MASTER, { type: 'scene.load', sceneKey: 'c1_fuga', keepMonsters: false }).state;
    expect(again.sideQuests.filter((q) => q.title === 'Chegar ao pinheiro').length).toBe(1);
  });

  it('todas as cenas carregam sem erro', () => {
    for (const sc of SCENES) {
      const s0 = withTokens(baseState(), heroToken('c1', PLAYER.userId, 1, 1));
      const { state } = applyCommand(s0, MASTER, { type: 'scene.load', sceneKey: sc.key, keepMonsters: false });
      expect(state.tokens.filter((t) => t.kind === 'monstro').length).toBe(sc.monsters.length);
      expect(state.map.tiles.filter((t) => t.o?.type === 'bau').length).toBe(sc.chests.length);
    }
  });

  it('narração vira fx para todos', () => {
    const { ctx } = applyCommand(baseState(), MASTER, { type: 'table.narrate', title: 'Prólogo', text: 'Era uma vez…' });
    expect(ctx.fx).toContainEqual({ type: 'narracao', title: 'Prólogo', text: 'Era uma vez…' });
  });
});
