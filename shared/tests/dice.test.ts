import {
  DiceError, averageOf, criticalFormula, d20Formula, fixedRng, parseFormula, resolveAdvantage, roll, seededRng,
} from '../src';

describe('Motor de rolagem de dados', () => {
  it('interpreta fórmulas com vários termos', () => {
    const terms = parseFormula('1d20 + 1d6 - 2');
    expect(terms).toHaveLength(3);
    expect(terms[0]).toMatchObject({ kind: 'dice', count: 1, sides: 20, sign: 1 });
    expect(terms[2]).toMatchObject({ kind: 'const', value: 2, sign: -1 });
  });

  it('rola dentro dos limites com RNG determinístico', () => {
    const rng = seededRng(42);
    for (let i = 0; i < 500; i++) {
      const r = roll('3d6+2', rng);
      expect(r.total).toBeGreaterThanOrEqual(5);
      expect(r.total).toBeLessThanOrEqual(20);
    }
  });

  it('a mesma semente produz o mesmo resultado', () => {
    expect(roll('4d8', seededRng(7)).total).toBe(roll('4d8', seededRng(7)).total);
  });

  it('vantagem mantém o maior e desvantagem o menor d20', () => {
    const adv = roll('2d20kh1', fixedRng([5, 17]));
    expect(adv.total).toBe(17);
    expect(adv.natural).toBe(17);
    const dis = roll('2d20kl1', fixedRng([5, 17]));
    expect(dis.total).toBe(5);
  });

  it('marca crítico no 20 natural e falha no 1 natural', () => {
    expect(roll('1d20+3', fixedRng([20])).critical).toBe(true);
    expect(roll('1d20+3', fixedRng([20])).total).toBe(23);
    expect(roll('1d20+3', fixedRng([1])).fumble).toBe(true);
  });

  it('4d6kh3 descarta o menor dado', () => {
    const r = roll('4d6kh3', fixedRng([1, 6, 4, 3], 6));
    expect(r.terms[0].kept.sort()).toEqual([3, 4, 6]);
    expect(r.total).toBe(13);
  });

  it('rejeita fórmulas inválidas ou abusivas', () => {
    expect(() => parseFormula('')).toThrow(DiceError);
    expect(() => parseFormula('1d7')).toThrow(DiceError);
    expect(() => parseFormula('1000d6')).toThrow(DiceError);
    expect(() => parseFormula('2d20kh3')).toThrow(DiceError);
    expect(() => parseFormula('rm -rf')).toThrow(DiceError);
  });

  it('monta fórmulas de d20 com vantagem e modificador', () => {
    expect(d20Formula(5)).toBe('1d20+5');
    expect(d20Formula(-1, 'vantagem')).toBe('2d20kh1-1');
    expect(d20Formula(0, 'desvantagem')).toBe('2d20kl1');
  });

  it('crítico dobra apenas os dados', () => {
    expect(criticalFormula('1d8+3')).toBe('2d8+3');
    expect(criticalFormula('2d6+1d4-1')).toBe('4d6+2d4-1');
  });

  it('vantagem e desvantagem se anulam', () => {
    expect(resolveAdvantage(1, 0)).toBe('vantagem');
    expect(resolveAdvantage(2, 1)).toBe('normal');
    expect(resolveAdvantage(0, 3)).toBe('desvantagem');
  });

  it('calcula média esperada', () => {
    expect(averageOf('2d6+3')).toBe(10);
  });
});
