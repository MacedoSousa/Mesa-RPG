import type { AttackDef } from '../content/monsters';
import { averageOf, criticalFormula, d20Formula, resolveAdvantage, roll } from '../dice';
import { CommandError, EngineContext } from './context';
import {
  OBJECTS, TERRAIN, applyElementArea, damageObject, damageTile, decaySurfaces, elementDamageType, elevationAt,
  fallInto, isWalkableTile, moveCost, surfaceEffects, tileAt,
} from './map';
import { Point, findPath, gridDistance, hasLineOfSight } from './pathfinding';
import { tickQuestsByRound } from './quests';
import { addCondition, damageToken, deathSave, findToken, hasCondition, isHostile, removeCondition, tokenAt } from './tokens';
import type { CombatState, Economy, Token } from './types';

/** Movimento máximo fora de combate por comando (quadrados). */
export const EXPLORATION_MOVE_LIMIT = 40;

export function freshEconomy(t: Token): Economy {
  return { action: 1, bonusAction: 1, reaction: 1, movement: t.speed };
}

export function currentTurnTokenId(combat: CombatState | null): string | null {
  if (!combat || !combat.order.length) return null;
  return combat.order[combat.turnIndex]?.tokenId ?? null;
}

export function economyOf(ctx: EngineContext, t: Token): Economy | null {
  return ctx.state.combat?.economy[t.id] ?? null;
}

function spend(ctx: EngineContext, t: Token, resource: 'action' | 'bonusAction') {
  const eco = economyOf(ctx, t);
  if (!eco) return; // fora de combate não há economia
  if (eco[resource] < 1) throw new CommandError(resource === 'action' ? 'Você já usou sua Ação neste turno' : 'Você já usou sua Ação Bônus neste turno');
  eco[resource] -= 1;
}

// ───────────────────────────── Iniciativa e turnos ─────────────────────────────

export function startCombat(ctx: EngineContext, tokenIds?: string[]) {
  const { state } = ctx;
  if (state.combat) throw new CommandError('Já existe um combate em andamento');
  const participants = state.tokens.filter((t) => !t.dead && (!tokenIds || tokenIds.includes(t.id)));
  if (participants.length < 1) throw new CommandError('Nenhum participante para o combate');

  const rolls = participants.map((t) => {
    const r = roll('1d20', ctx.rng).total;
    return { t, initiative: r + t.initiativeBonus, dex: t.abilityMods.destreza, tie: ctx.rng() };
  });
  rolls.sort((a, b) => b.initiative - a.initiative || b.dex - a.dex || b.tie - a.tie);

  state.combat = {
    round: 1,
    turnIndex: 0,
    order: rolls.map((r) => ({ tokenId: r.t.id, initiative: r.initiative })),
    economy: Object.fromEntries(participants.map((t) => [t.id, freshEconomy(t)])),
  };
  state.phase = 'combate';
  ctx.log(`⚔️ Combate iniciado! Ordem: ${rolls.map((r) => `${r.t.name} (${r.initiative})`).join(', ')}`, { type: 'combate' });
  beginTurn(ctx);
}

export function endCombat(ctx: EngineContext) {
  if (!ctx.state.combat) throw new CommandError('Não há combate em andamento');
  ctx.state.combat = null;
  ctx.state.phase = 'exploracao';
  for (const t of ctx.state.tokens) {
    removeCondition(t, 'esquivando');
    removeCondition(t, 'desengajado');
  }
  ctx.log('🏳️ Combate encerrado.', { type: 'combate' });
}

function beginTurn(ctx: EngineContext) {
  const combat = ctx.state.combat!;
  const id = currentTurnTokenId(combat);
  const t = id ? findToken(ctx.state, id) : undefined;
  if (!t) return;
  combat.economy[t.id] = freshEconomy(t);
  removeCondition(t, 'esquivando');
  removeCondition(t, 'desengajado');
  if (hasCondition(t, 'caido') && !hasCondition(t, 'inconsciente')) {
    combat.economy[t.id].movement = Math.floor(t.speed / 2);
    removeCondition(t, 'caido');
    ctx.log(`${t.name} se levanta (metade do movimento).`, { type: 'turno' });
  }
  ctx.log(`▶️ Turno de ${t.name} (rodada ${combat.round})`, { type: 'turno', data: { tokenId: t.id } });
  surfaceEffects(ctx, t, 'inicio_turno');
}

function shouldSkip(t: Token | undefined): boolean {
  return !t || t.dead || hasCondition(t, 'inconsciente') || hasCondition(t, 'atordoado');
}

export function nextTurn(ctx: EngineContext) {
  const combat = ctx.state.combat;
  if (!combat) throw new CommandError('Não há combate em andamento');
  combat.order = combat.order.filter((e) => findToken(ctx.state, e.tokenId));
  if (!combat.order.length) return endCombat(ctx);

  for (let guard = 0; guard <= combat.order.length; guard++) {
    combat.turnIndex += 1;
    if (combat.turnIndex >= combat.order.length) {
      combat.turnIndex = 0;
      combat.round += 1;
      decaySurfaces(ctx);
      tickQuestsByRound(ctx, combat.round);
      ctx.log(`🔁 Rodada ${combat.round}`, { type: 'turno' });
    }
    const t = findToken(ctx.state, combat.order[combat.turnIndex].tokenId);
    if (t && hasCondition(t, 'atordoado')) {
      removeCondition(t, 'atordoado');
      ctx.log(`${t.name} está atordoado e perde o turno.`, { type: 'turno' });
      continue;
    }
    // Herói caído: o turno dele é a salvaguarda contra a morte (automática)
    if (t && t.kind === 'personagem' && !t.dead && hasCondition(t, 'inconsciente')) {
      deathSave(ctx, t);
      continue;
    }
    if (!shouldSkip(t)) break;
  }
  beginTurn(ctx);
}

// ───────────────────────────── Movimento ─────────────────────────────

/** Ataque de oportunidade quando sai do alcance de um inimigo sem Desengajar. */
function opportunityAttacks(ctx: EngineContext, mover: Token, from: Point, to: Point) {
  if (!ctx.state.combat || hasCondition(mover, 'desengajado')) return;
  for (const enemy of ctx.state.tokens) {
    if (enemy.dead || enemy.id === mover.id || !isHostile(enemy, mover) || hasCondition(enemy, 'inconsciente')) continue;
    const reach = Math.max(1, ...enemy.attacks.filter((a) => !a.ranged).map((a) => a.range));
    const wasIn = gridDistance(enemy, from) <= reach;
    const nowIn = gridDistance(enemy, to) <= reach;
    const eco = ctx.state.combat.economy[enemy.id];
    if (wasIn && !nowIn && eco && eco.reaction > 0) {
      const attack = enemy.attacks.find((a) => !a.ranged);
      if (!attack) continue;
      eco.reaction -= 1;
      ctx.log(`⚡ ${enemy.name} faz um ataque de oportunidade em ${mover.name}!`, { type: 'combate' });
      resolveAttackRoll(ctx, enemy, mover, attack, enemy.attacks.indexOf(attack));
    }
  }
}

export function moveToken(ctx: EngineContext, t: Token, to: Point) {
  if (t.dead || hasCondition(t, 'inconsciente')) throw new CommandError(`${t.name} não pode se mover`);
  const eco = economyOf(ctx, t);
  const budget = eco ? eco.movement : EXPLORATION_MOVE_LIMIT;
  const result = findPath(ctx.state, t.id, t, to, budget);
  if (!result) throw new CommandError(eco ? 'Destino fora do alcance de movimento' : 'Não há caminho até o destino');

  const walked: Point[] = [];
  let spent = 0;
  for (const step of result.path) {
    const from = { x: t.x, y: t.y };
    const stepCost = moveCost(tileAt(ctx.state.map, step.x, step.y)!);
    t.x = step.x;
    t.y = step.y;
    spent += stepCost;
    walked.push(step);
    opportunityAttacks(ctx, t, from, step);
    if (t.dead || hasCondition(t, 'inconsciente')) break;
    const fell = surfaceEffects(ctx, t, 'entrar');
    if (fell) break;
  }
  if (eco) eco.movement = Math.max(0, eco.movement - spent);
  ctx.emit({ type: 'movimento', tokenId: t.id, path: walked });
}

// ───────────────────────────── Ataques ─────────────────────────────

export interface AttackOutcome {
  hit: boolean;
  critical: boolean;
  attackTotal: number;
  natural: number | null;
  damage: number;
}

function attackAdvantage(ctx: EngineContext, attacker: Token, target: Token, attack: AttackDef, long: boolean) {
  let adv = 0;
  let dis = 0;
  const ranged = attack.ranged || attack.range > 2;
  const dist = gridDistance(attacker, target);
  if (hasCondition(target, 'caido')) (dist <= 1 ? adv++ : dis++);
  if (hasCondition(target, 'esquivando')) dis++;
  if (hasCondition(target, 'atordoado') || hasCondition(target, 'inconsciente')) adv++;
  if (hasCondition(attacker, 'envenenado') || hasCondition(attacker, 'amedrontado')) dis++;
  if (long) dis++;
  if (ranged) {
    const adjacentEnemy = ctx.state.tokens.some((o) => !o.dead && isHostile(o, attacker) && !hasCondition(o, 'inconsciente') && gridDistance(o, attacker) <= 1);
    if (adjacentEnemy) dis++;
  }
  return resolveAdvantage(adv, dis);
}

/** Terreno elevado (estilo BG3): +2 para quem ataca de cima, −2 de baixo. */
export function highGroundBonus(ctx: EngineContext, attacker: Point, target: Point): number {
  const diff = elevationAt(ctx.state.map, attacker.x, attacker.y) - elevationAt(ctx.state.map, target.x, target.y);
  if (diff > 0) return 2;
  if (diff < 0) return -2;
  return 0;
}

export function resolveAttackRoll(ctx: EngineContext, attacker: Token, target: Token, attack: AttackDef, attackIndex: number): AttackOutcome {
  const dist = gridDistance(attacker, target);
  const long = dist > attack.range;
  const adv = attackAdvantage(ctx, attacker, target, attack, long);
  const hg = highGroundBonus(ctx, attacker, target);
  const r = roll(d20Formula(attack.toHit + hg, adv), ctx.rng);
  const autoCrit = hasCondition(target, 'inconsciente') && dist <= 1;
  const hit = r.critical || autoCrit || (!r.fumble && r.total >= target.ac);
  const critical = hit && (r.critical || autoCrit);

  let damage = 0;
  if (hit) {
    const formula = critical ? criticalFormula(attack.damage) : attack.damage;
    damage = roll(formula, ctx.rng).total;
    if (attack.bonusVsMonsters && target.kind === 'monstro') {
      damage += roll(critical ? criticalFormula(attack.bonusVsMonsters) : attack.bonusVsMonsters, ctx.rng).total;
    }
    damage = damageToken(ctx, target, damage, attack.damageType, `${attacker.name} — ${attack.name}`);
  } else {
    ctx.emit({ type: 'errou', tokenId: target.id });
  }

  const advTxt = adv === 'normal' ? '' : ` com ${adv}`;
  const hgTxt = hg ? ` (terreno ${hg > 0 ? 'elevado +2' : 'baixo −2'})` : '';
  ctx.log(
    hit
      ? `🎯 ${attacker.name} ${critical ? 'acerta CRITICAMENTE' : 'acerta'} ${target.name} com ${attack.name} (${r.total} vs CA ${target.ac}${advTxt}${hgTxt}): ${damage} de dano ${attack.damageType}`
      : `❌ ${attacker.name} erra ${target.name} com ${attack.name} (${r.total} vs CA ${target.ac}${advTxt}${hgTxt})`,
    { type: 'combate', data: { attackerId: attacker.id, targetId: target.id, attackIndex, roll: r.total, natural: r.natural, hit, critical, damage } },
  );
  return { hit, critical, attackTotal: r.total, natural: r.natural, damage };
}

function validateAttackRange(ctx: EngineContext, attacker: Token, target: Point, attack: AttackDef) {
  const dist = gridDistance(attacker, target);
  const max = attack.longRange ?? attack.range;
  if (dist > max) throw new CommandError(`Alvo fora de alcance (${dist} quadrados; alcance ${max})`);
  if (dist > 1 && !hasLineOfSight(ctx.state, attacker, target)) throw new CommandError('Sem linha de visão até o alvo');
}

export function attack(ctx: EngineContext, attacker: Token, target: Token, attackIndex: number): AttackOutcome {
  const atk = attacker.attacks[attackIndex];
  if (!atk) throw new CommandError('Ataque inválido');
  if (target.dead) throw new CommandError(`${target.name} já foi derrotado`);
  if (target.id === attacker.id) throw new CommandError('Você não pode atacar a si mesmo');
  validateAttackRange(ctx, attacker, target, atk);
  spend(ctx, attacker, 'action');
  return resolveAttackRoll(ctx, attacker, target, atk, attackIndex);
}

/** Atacar o cenário: paredes, árvores, pontes, barris (CA 10). */
export function attackTile(ctx: EngineContext, attacker: Token, at: Point, attackIndex: number) {
  const atk = attacker.attacks[attackIndex];
  if (!atk) throw new CommandError('Ataque inválido');
  const tile = tileAt(ctx.state.map, at.x, at.y);
  if (!tile) throw new CommandError('Casa fora do mapa');
  const destructible = !!tile.o || !!TERRAIN[tile.t].maxHp;
  if (!destructible) throw new CommandError(`${TERRAIN[tile.t].label} não pode ser destruído`);
  validateAttackRange(ctx, attacker, at, atk);
  spend(ctx, attacker, 'action');

  const r = roll(d20Formula(atk.toHit), ctx.rng);
  const label = tile.o ? OBJECTS[tile.o.type].label : TERRAIN[tile.t].label;
  if (!r.critical && (r.fumble || r.total < 10)) {
    ctx.log(`❌ ${attacker.name} erra o golpe em ${label} (${r.total})`, { type: 'mapa' });
    return;
  }
  const dmg = roll(r.critical ? criticalFormula(atk.damage) : atk.damage, ctx.rng).total;
  ctx.log(`🪓 ${attacker.name} golpeia ${label} com ${atk.name}: ${dmg} de dano`, { type: 'mapa' });
  if (tile.o) damageObject(ctx, at.x, at.y, dmg, atk.damageType);
  else damageTile(ctx, at.x, at.y, dmg, atk.damageType);
}

// ───────────────────────────── Ações padrão ─────────────────────────────

export type StandardAction = 'disparada' | 'desengajar' | 'esquivar';

export function standardAction(ctx: EngineContext, t: Token, action: StandardAction) {
  spend(ctx, t, 'action');
  const eco = economyOf(ctx, t);
  switch (action) {
    case 'disparada':
      if (eco) eco.movement += t.speed;
      ctx.log(`🏃 ${t.name} usa Disparada (movimento dobrado).`, { type: 'combate' });
      break;
    case 'desengajar':
      addCondition(t, 'desengajado');
      ctx.log(`🛡️ ${t.name} se desengaja (sem ataques de oportunidade).`, { type: 'combate' });
      break;
    case 'esquivar':
      addCondition(t, 'esquivando');
      ctx.log(`🌀 ${t.name} entra em posição de esquiva.`, { type: 'combate' });
      break;
  }
}

/** Empurrar (Ação Bônus, como no BG3): teste resistido de Atletismo. */
export function shove(ctx: EngineContext, t: Token, target: Token) {
  if (gridDistance(t, target) > 1) throw new CommandError('O alvo precisa estar adjacente');
  if (target.id === t.id || target.dead) throw new CommandError('Alvo inválido');
  spend(ctx, t, 'bonusAction');
  const atk = roll('1d20', ctx.rng).total + t.abilityMods.forca + t.proficiency;
  const def = roll('1d20', ctx.rng).total + Math.max(target.abilityMods.forca, target.abilityMods.destreza);
  if (atk < def) {
    ctx.log(`✋ ${t.name} tenta empurrar ${target.name}, mas falha (${atk} vs ${def}).`, { type: 'combate' });
    return false;
  }
  const dx = Math.sign(target.x - t.x);
  const dy = Math.sign(target.y - t.y);
  const nx = target.x + dx;
  const ny = target.y + dy;
  const tile = tileAt(ctx.state.map, nx, ny);
  if (!tile || tokenAt(ctx.state, nx, ny) || (tile.o && OBJECTS[tile.o.type].blocksMovement) || (!TERRAIN[tile.t].walkable && !TERRAIN[tile.t].liquid && tile.t !== 'abismo' && tile.t !== 'lava')) {
    ctx.log(`✋ ${t.name} empurra ${target.name} contra um obstáculo (${atk} vs ${def}).`, { type: 'combate' });
    addCondition(target, 'caido');
    return true;
  }
  target.x = nx;
  target.y = ny;
  ctx.emit({ type: 'movimento', tokenId: target.id, path: [{ x: nx, y: ny }] });
  ctx.log(`✋ ${t.name} empurra ${target.name}! (${atk} vs ${def})`, { type: 'combate' });
  if (!isWalkableTile(tile)) fallInto(ctx, target, tile);
  else surfaceEffects(ctx, target, 'entrar');
  return true;
}

/** Poder divino do pai olímpico: elemento numa área (Ação + Estamina). */
export function castDivinePower(ctx: EngineContext, t: Token, at: Point) {
  const p = t.power;
  if (!p || !p.element) throw new CommandError(`${t.name} não tem um poder divino elemental`);
  if (t.stamina < p.staminaCost) throw new CommandError(`Estamina insuficiente (${t.stamina}/${p.staminaCost})`);
  const dist = gridDistance(t, at);
  if (dist > (p.range ?? 6)) throw new CommandError(`Fora do alcance do poder (${p.range} quadrados)`);
  if (dist > 1 && !hasLineOfSight(ctx.state, t, at)) throw new CommandError('Sem linha de visão');
  spend(ctx, t, 'action');
  t.stamina -= p.staminaCost;
  const best = Math.max(t.abilityMods.carisma, t.abilityMods.sabedoria, t.abilityMods.inteligencia);
  const dc = 8 + t.proficiency + best;
  ctx.log(`✨ ${t.name} invoca ${p.label}!`, { type: 'combate' });
  applyElementArea(ctx, at.x, at.y, p.radius ?? 0, p.element, {
    damage: p.damage, damageType: elementDamageType(p.element), saveDc: dc, source: p.label,
  });
  // Fogo e raio também danificam o cenário no ponto de impacto
  if (p.damage && (p.element === 'fogo' || p.element === 'raio')) {
    const tile = tileAt(ctx.state.map, at.x, at.y);
    if (tile?.o) damageObject(ctx, at.x, at.y, roll(p.damage, ctx.rng).total, elementDamageType(p.element));
  }
}

// ───────────────────────────── Turno automático (IA simples para o Mestre) ─────────────────────────────

function attackReach(a: AttackDef) {
  return a.longRange ?? a.range;
}

/**
 * O monstro (ou NPC) age sozinho: escolhe o inimigo visível mais próximo, ataca se alcançar,
 * senão anda até ficar ao alcance e então ataca. Ótimo para o Mestre iniciante.
 */
export function autoAct(ctx: EngineContext, t: Token) {
  if (t.kind === 'personagem') throw new CommandError('Heróis são controlados pelos jogadores');
  if (t.dead || hasCondition(t, 'inconsciente')) throw new CommandError(`${t.name} não pode agir`);
  if (!t.attacks.length) throw new CommandError(`${t.name} não tem ataques`);
  const targets = ctx.state.tokens.filter((o) => !o.dead && !o.hidden && isHostile(t, o) && o.id !== t.id);
  if (!targets.length) {
    ctx.log(`${t.name} não encontra ninguém para atacar.`, { type: 'combate' });
    return;
  }
  // Prioriza quem está de pé; heróis caídos só se não houver outro alvo
  const standing = targets.filter((o) => !hasCondition(o, 'inconsciente'));
  const pool = standing.length ? standing : targets;
  pool.sort((a, b) => gridDistance(t, a) - gridDistance(t, b) || a.hp - b.hp);
  const target = pool[0];

  const best = (dist: number) => {
    const usable = t.attacks
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => dist <= attackReach(a) && (dist <= 1 || hasLineOfSight(ctx.state, t, target)));
    // Corpo a corpo quando colado; senão a de maior dano médio
    usable.sort((x, y) => Number(dist <= 1 ? y.a.range <= 2 : 0) - Number(dist <= 1 ? x.a.range <= 2 : 0) || avg(y.a.damage) - avg(x.a.damage));
    return usable[0];
  };

  let choice = best(gridDistance(t, target));
  if (!choice) {
    const melee = Math.max(1, ...t.attacks.filter((a) => !a.ranged).map((a) => a.range));
    const eco = economyOf(ctx, t);
    const budget = eco ? eco.movement : EXPLORATION_MOVE_LIMIT;
    // Casa livre mais perto do alvo, dentro do movimento
    let bestCell: Point | null = null;
    let bestScore = Infinity;
    for (let dy = -melee; dy <= melee; dy++) {
      for (let dx = -melee; dx <= melee; dx++) {
        const c = { x: target.x + dx, y: target.y + dy };
        if (c.x === target.x && c.y === target.y) continue;
        const path = findPath(ctx.state, t.id, t, c, Infinity);
        if (!path) continue;
        const score = path.cost;
        if (score < bestScore) {
          bestScore = score;
          bestCell = c;
        }
      }
    }
    if (!bestCell) {
      ctx.log(`${t.name} não encontra caminho até ${target.name}.`, { type: 'combate' });
      return;
    }
    // Anda o máximo possível ao longo do caminho
    const full = findPath(ctx.state, t.id, t, bestCell, Infinity)!;
    let spent = 0;
    let stop: Point = { x: t.x, y: t.y };
    for (const step of full.path) {
      const c = moveCost(tileAt(ctx.state.map, step.x, step.y)!);
      if (spent + c > budget) break;
      spent += c;
      stop = step;
    }
    if (stop.x !== t.x || stop.y !== t.y) moveToken(ctx, t, stop);
    if (t.dead || hasCondition(t, 'inconsciente') || hasCondition(t, 'caido')) return;
    choice = best(gridDistance(t, target));
    if (!choice) {
      ctx.log(`${t.name} avança em direção a ${target.name}.`, { type: 'combate' });
      return;
    }
  }
  const eco = economyOf(ctx, t);
  if (eco && eco.action < 1) return;
  if (eco) eco.action -= 1;
  resolveAttackRoll(ctx, t, target, choice.a, choice.i);
}

function avg(formula: string) {
  try {
    return averageOf(formula);
  } catch {
    return 0;
  }
}
