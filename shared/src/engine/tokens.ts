import type { Condition } from '../content/conditions';
import type { DamageType } from '../content/items';
import { roll } from '../dice';
import type { EngineContext } from './context';
import type { TableState, Token } from './types';

export function findToken(state: TableState, id: string): Token | undefined {
  return state.tokens.find((t) => t.id === id);
}

export function tokenAt(state: TableState, x: number, y: number, ignoreId?: string): Token | undefined {
  return state.tokens.find((t) => t.x === x && t.y === y && !t.dead && t.id !== ignoreId);
}

export function hasCondition(t: Token, c: Condition): boolean {
  return t.conditions.includes(c);
}

export function addCondition(t: Token, c: Condition) {
  if (!t.conditions.includes(c)) t.conditions.push(c);
}

export function removeCondition(t: Token, c: Condition) {
  t.conditions = t.conditions.filter((x) => x !== c);
}

export function isHostile(a: Token, b: Token): boolean {
  const side = (t: Token) => (t.kind === 'monstro' ? 'monstro' : 'heroi');
  return side(a) !== side(b);
}

/** Ajusta o dano por resistência e pela condição Molhado (estilo BG3). */
export function adjustDamage(t: Token, amount: number, type: DamageType): number {
  let dmg = amount;
  const wet = hasCondition(t, 'molhado');
  const resistant = t.resistances.includes(type) || (wet && type === 'fogo');
  const vulnerable = wet && (type === 'eletrico' || type === 'frio');
  if (resistant && !vulnerable) dmg = Math.floor(dmg / 2);
  if (vulnerable && !resistant) dmg *= 2;
  return Math.max(0, dmg);
}

/** Aplica dano a um token. Retorna o dano efetivo. */
export function damageToken(ctx: EngineContext, t: Token, amount: number, type: DamageType, source: string): number {
  if (t.dead) return 0;
  const dmg = adjustDamage(t, amount, type);
  let remaining = dmg;
  if (t.tempHp > 0) {
    const absorbed = Math.min(t.tempHp, remaining);
    t.tempHp -= absorbed;
    remaining -= absorbed;
  }
  t.hp = Math.max(0, t.hp - remaining);
  ctx.emit({ type: 'dano', tokenId: t.id, amount: dmg, damageType: type });

  if (type === 'fogo') removeCondition(t, 'molhado');

  if (t.hp === 0) {
    if (t.kind === 'personagem') {
      addCondition(t, 'inconsciente');
      addCondition(t, 'caido');
      ctx.log(`${t.name} cai inconsciente! (${source})`, { type: 'combate' });
    } else {
      t.dead = true;
      ctx.log(`${t.name} foi derrotado! (${source})`, { type: 'combate' });
    }
  }
  syncCharacter(ctx, t);
  return dmg;
}

export function healToken(ctx: EngineContext, t: Token, amount: number) {
  if (t.dead) return 0;
  const before = t.hp;
  t.hp = Math.min(t.maxHp, t.hp + amount);
  if (t.hp > 0) removeCondition(t, 'inconsciente');
  const healed = t.hp - before;
  ctx.emit({ type: 'cura', tokenId: t.id, amount: healed });
  syncCharacter(ctx, t);
  return healed;
}

/** Teste de resistência simples: d20 + mod >= CD. Aplica vantagem de raça/divindade. */
export function savingThrow(ctx: EngineContext, t: Token, ability: keyof Token['abilityMods'], dc: number, againstCondition?: string): boolean {
  const adv = againstCondition && t.conditionAdvantage.includes(againstCondition);
  const r = roll(adv ? '2d20kh1' : '1d20', ctx.rng);
  return r.total + t.abilityMods[ability] >= dc;
}

/** Registra para o servidor persistir PV/estamina na ficha do personagem. */
export function syncCharacter(ctx: EngineContext, t: Token) {
  if (t.kind !== 'personagem' || !t.characterId) return;
  const existing = ctx.sideEffects.find((e) => e.type === 'character_hp' && e.characterId === t.characterId);
  if (existing && existing.type === 'character_hp') {
    existing.hp = t.hp;
    existing.stamina = t.stamina;
  } else {
    ctx.sideEffects.push({ type: 'character_hp', characterId: t.characterId, hp: t.hp, stamina: t.stamina });
  }
}

export function hpStatus(t: Token): 'ileso' | 'ferido' | 'gravemente ferido' | 'caido' | 'morto' {
  if (t.dead) return 'morto';
  if (t.hp <= 0) return 'caido';
  const ratio = t.hp / t.maxHp;
  if (ratio >= 1) return 'ileso';
  if (ratio > 0.5) return 'ferido';
  return 'gravemente ferido';
}
