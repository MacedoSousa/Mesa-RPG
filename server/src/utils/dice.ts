export interface DiceRoll {
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
}

const DICE_REGEX = /^(\d{1,2})?d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/i;

/**
 * Rola dados no formato NdX+M (ex.: "1d20+5", "2d6", "d8-1").
 * A rolagem acontece no servidor para ninguém "trapacear" no cliente.
 */
export function rollDice(expression: string): DiceRoll {
  const clean = expression.replace(/\s+/g, '');
  const match = DICE_REGEX.exec(clean);
  if (!match) throw new Error('Expressão de dado inválida. Use o formato NdX+M, ex.: 1d20+3');

  const count = Math.min(Math.max(Number(match[1] ?? 1), 1), 50);
  const sides = Number(match[2]);
  const modifier = Number(match[3] ?? 0);

  const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((a, b) => a + b, 0) + modifier;

  return { expression: clean.toLowerCase(), rolls, modifier, total };
}
