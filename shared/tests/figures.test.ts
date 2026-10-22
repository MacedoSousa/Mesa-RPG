import { FIGURE_BASE_KEYS, applyCommand, figureRecipeSchema, generateFigureRecipe, projectStateFor } from '../src';
import { MASTER, PLAYER, baseState, heroToken, monster, withTokens } from './helpers';

describe('Oficina de bonecos', () => {
  it('mesma base + semente = mesmo boneco; sementes diferentes variam', () => {
    for (const base of FIGURE_BASE_KEYS) {
      const a = generateFigureRecipe(base, 'olimpo');
      expect(generateFigureRecipe(base, 'olimpo')).toEqual(a);
      expect(figureRecipeSchema.parse(a)).toEqual(a);
      const variants = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((s) => JSON.stringify(generateFigureRecipe(base, s))));
      expect(variants.size).toBeGreaterThan(3);
    }
    expect(generateFigureRecipe('hidra', 'x').heads).toBeGreaterThanOrEqual(3);
  });

  it('salva na biblioteca (só o Mestre vê) e aplica na espécie e nos tokens', () => {
    const recipe = generateFigureRecipe('quadrupede', 'lobo');
    let s = withTokens(baseState(), heroToken('c1', PLAYER.userId, 1, 1), monster('cao_infernal', 5, 5, 'm1'));
    s = applyCommand(s, MASTER, { type: 'figure.save', name: 'Lobo de Ares', recipe }).state;
    expect(s.figures?.[0].name).toBe('Lobo de Ares');
    expect(projectStateFor(s, PLAYER).figures).toBeUndefined();
    s = applyCommand(s, MASTER, { type: 'figure.assign', monsterKey: 'cao_infernal', recipe }).state;
    expect(s.tokens.find((t) => t.id === 'm1')!.figure).toEqual(recipe);
    // novos da espécie já nascem com o visual
    s = applyCommand(s, MASTER, { type: 'monster.spawn', monsterKey: 'cao_infernal', x: 7, y: 7, hidden: false, rollHp: false }).state;
    expect(s.tokens.at(-1)!.figure).toEqual(recipe);
    // jogador vê o visual no token
    expect(projectStateFor(s, PLAYER).tokens.find((t) => t.id === 'm1')!.figure).toEqual(recipe);
    // voltar ao padrão
    s = applyCommand(s, MASTER, { type: 'figure.assign', monsterKey: 'cao_infernal', recipe: null }).state;
    expect(s.tokens.find((t) => t.id === 'm1')!.figure).toBeNull();
    expect(() => applyCommand(s, PLAYER, { type: 'figure.save', name: 'x', recipe })).toThrow();
  });
});
