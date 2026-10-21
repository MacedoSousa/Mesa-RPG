import { getItem } from '../content/items';
import { getMonster } from '../content/monsters';
import { AFFINITY_MAX, AFFINITY_MIN } from '../content/divinities';
import { DiceError, Rng, defaultRng, roll } from '../dice';
import {
  attack, attackTile, castDivinePower, currentTurnTokenId, economyOf, endCombat, moveToken, nextTurn, shove,
  standardAction, startCombat,
} from './combat';
import { Command, TOKEN_COMMANDS, canIssue } from './commands';
import { CommandError, EngineContext, createContext } from './context';
import { createMonsterToken } from './factory';
import { OBJECTS, SURFACES, TERRAIN, applyElementArea, damageTile, inBounds, isWalkableTile, tileAt } from './map';
import { completeQuest, progressQuest } from './quests';
import { damageToken, findToken, healToken, removeCondition, tokenAt } from './tokens';
import { requestChecks, rollCheck } from './checks';
import { grantToHeroes, openChest, placeChest } from './interact';
import { autoAct } from './combat';
import { generateMap } from './mapgen';
import { DAMAGE_TYPES } from '../content/items';
import type { Condition } from '../content/conditions';
import type { Actor, TableState, Token } from './types';

export interface ApplyResult {
  state: TableState;
  ctx: EngineContext;
}

function requireToken(state: TableState, id: string): Token {
  const t = findToken(state, id);
  if (!t) throw new CommandError('Token não encontrado', 'not_found');
  return t;
}

/** Permissões contextuais: posse do token, pausa, turno estrito em combate. */
export function authorize(state: TableState, actor: Actor, cmd: Command) {
  if (!canIssue(actor.role, cmd.type)) throw new CommandError('Comando exclusivo do Mestre', 'forbidden');
  if (actor.role === 'MASTER') {
    if (TOKEN_COMMANDS.includes(cmd.type) && state.combat && cmd.type !== 'combat.endTurn') {
      const tokenId = (cmd as { tokenId: string }).tokenId;
      const inCombat = state.combat.order.some((e) => e.tokenId === tokenId);
      if (inCombat && currentTurnTokenId(state.combat) !== tokenId) throw new CommandError('Não é o turno deste token', 'not_your_turn');
    }
    return;
  }

  const player = state.players[actor.userId];
  if (player?.paused) throw new CommandError('O Mestre pausou você temporariamente', 'paused');
  if (state.paused && cmd.type !== 'chat.say') throw new CommandError('A mesa está pausada pelo Mestre', 'paused');

  if (TOKEN_COMMANDS.includes(cmd.type)) {
    const t = requireToken(state, (cmd as { tokenId: string }).tokenId);
    if (t.ownerUserId !== actor.userId) throw new CommandError('Você só controla o seu próprio personagem', 'forbidden');
    if (state.combat && currentTurnTokenId(state.combat) !== t.id) throw new CommandError('Aguarde o seu turno', 'not_your_turn');
  }
  if (cmd.type === 'dice.roll' && cmd.visibility === 'secreto') throw new CommandError('Rolagens secretas são exclusivas do Mestre', 'forbidden');
}

/**
 * Aplica um comando sobre uma CÓPIA do estado. Se der erro, o estado original fica intacto.
 * O servidor é a única autoridade: clientes só enviam intenções.
 */
export function applyCommand(state: TableState, actor: Actor, cmd: Command, rng: Rng = defaultRng, now = Date.now()): ApplyResult {
  authorize(state, actor, cmd);
  const draft: TableState = structuredClone(state);
  const ctx = createContext(draft, actor, rng, now);
  execute(ctx, cmd);
  draft.seq += 1;
  draft.updatedAt = now;
  return { state: draft, ctx };
}

function execute(ctx: EngineContext, cmd: Command) {
  const { state, actor } = ctx;
  switch (cmd.type) {
    case 'token.move': {
      const t = requireToken(state, cmd.tokenId);
      moveToken(ctx, t, { x: cmd.x, y: cmd.y });
      return;
    }
    case 'combat.attack': {
      attack(ctx, requireToken(state, cmd.tokenId), requireToken(state, cmd.targetId), cmd.attackIndex ?? 0);
      return;
    }
    case 'combat.attackTile':
      attackTile(ctx, requireToken(state, cmd.tokenId), { x: cmd.x, y: cmd.y }, cmd.attackIndex ?? 0);
      return;
    case 'combat.action':
      if (!state.combat) throw new CommandError('Ações de combate só valem durante o combate');
      standardAction(ctx, requireToken(state, cmd.tokenId), cmd.action);
      return;
    case 'combat.shove':
      shove(ctx, requireToken(state, cmd.tokenId), requireToken(state, cmd.targetId));
      return;
    case 'combat.power':
      castDivinePower(ctx, requireToken(state, cmd.tokenId), { x: cmd.x, y: cmd.y });
      return;
    case 'combat.endTurn': {
      if (!state.combat) throw new CommandError('Não há combate em andamento');
      if (currentTurnTokenId(state.combat) !== cmd.tokenId) throw new CommandError('Não é o turno deste token', 'not_your_turn');
      ctx.log(`⏭️ ${requireToken(state, cmd.tokenId).name} encerra o turno.`, { type: 'turno' });
      nextTurn(ctx);
      return;
    }
    case 'item.use': {
      const t = requireToken(state, cmd.tokenId);
      const qty = t.consumables[cmd.itemKey] ?? 0;
      const item = getItem(cmd.itemKey);
      if (!item || item.kind !== 'consumivel') throw new CommandError('Item não é consumível');
      if (qty < 1) throw new CommandError(`Você não tem ${item.name}`);
      const target = cmd.targetId ? requireToken(state, cmd.targetId) : t;
      if (target.id !== t.id && Math.max(Math.abs(target.x - t.x), Math.abs(target.y - t.y)) > 1) throw new CommandError('O alvo precisa estar adjacente');
      const eco = economyOf(ctx, t);
      if (eco) {
        if (eco.bonusAction < 1) throw new CommandError('Você já usou sua Ação Bônus neste turno');
        eco.bonusAction -= 1;
      }
      t.consumables[cmd.itemKey] = qty - 1;
      const parts: string[] = [];
      if (item.effect.heal) parts.push(`cura ${healToken(ctx, target, roll(item.effect.heal, ctx.rng).total)} PV`);
      if (item.effect.stamina) {
        const before = target.stamina;
        target.stamina = Math.min(target.maxStamina, target.stamina + roll(item.effect.stamina, ctx.rng).total);
        parts.push(`recupera ${target.stamina - before} de Estamina`);
      }
      for (const c of item.effect.removeConditions ?? []) removeCondition(target, c as Condition);
      ctx.log(`🧪 ${t.name} usa ${item.name}${target.id !== t.id ? ` em ${target.name}` : ''}: ${parts.join(', ') || 'efeito aplicado'}`, { type: 'item' });
      if (t.characterId) ctx.sideEffects.push({ type: 'consumable_used', characterId: t.characterId, itemKey: cmd.itemKey, quantity: 1 });
      return;
    }
    case 'object.open':
      openChest(ctx, requireToken(state, cmd.tokenId), cmd.x, cmd.y);
      return;
    case 'check.roll':
      rollCheck(ctx, cmd.checkId, cmd.advantage);
      return;
    case 'combat.auto': {
      const t = requireToken(state, cmd.tokenId);
      if (state.combat) {
        const inCombat = state.combat.order.some((e) => e.tokenId === t.id);
        if (inCombat && currentTurnTokenId(state.combat) !== t.id) throw new CommandError('Não é o turno deste token', 'not_your_turn');
      }
      autoAct(ctx, t);
      return;
    }
    case 'token.damage': {
      if (cmd.amount === undefined && !cmd.formula) throw new CommandError('Informe o valor ou a fórmula');
      let base = cmd.amount ?? 0;
      let detail = '';
      if (cmd.formula) {
        try {
          const r = roll(cmd.formula, ctx.rng);
          base = r.total;
          detail = ` (${r.formula} = ${r.total})`;
        } catch (e) {
          throw new CommandError(e instanceof DiceError ? e.message : 'Fórmula inválida');
        }
      }
      const amount = cmd.half ? Math.floor(base / 2) : base;
      const src = cmd.source ?? 'Mestre';
      for (const tid of cmd.tokenIds) {
        const t = requireToken(state, tid);
        if (cmd.heal) {
          const healed = healToken(ctx, t, amount);
          ctx.log(`💚 ${t.name} recupera ${healed} PV${detail} — ${src}. PV: ${t.hp}/${t.maxHp}`, { type: 'combate', visibility: t.hidden ? 'mestre' : 'publico' });
        } else {
          const dealt = damageToken(ctx, t, amount, DAMAGE_TYPES.includes(cmd.damageType) ? cmd.damageType : 'concussao', src);
          const shown = t.kind === 'monstro' ? '' : ` PV: ${t.hp}/${t.maxHp}`;
          ctx.log(`💥 ${t.name} sofre ${dealt} de dano ${cmd.damageType}${detail}${cmd.half ? ' (metade)' : ''} — ${src}.${shown}`, { type: 'combate', visibility: t.hidden ? 'mestre' : 'publico' });
        }
      }
      return;
    }
    case 'check.request':
      requestChecks(ctx, { userIds: cmd.userIds, kind: cmd.kind, key: cmd.key, dc: cmd.dc, secretDc: cmd.secretDc, label: cmd.label });
      return;
    case 'item.take': {
      const item = getItem(cmd.itemKey);
      if (!item) throw new CommandError('Item desconhecido');
      const heroes = cmd.tokenIds === 'todos'
        ? state.tokens.filter((t) => t.kind === 'personagem' && t.characterId && !t.hidden && !t.dead)
        : cmd.tokenIds.map((tid) => requireToken(state, tid)).filter((t) => t.characterId);
      if (!heroes.length) throw new CommandError('Nenhum herói selecionado');
      for (const t of heroes) {
        if (t.consumables[cmd.itemKey] !== undefined) t.consumables[cmd.itemKey] = Math.max(0, t.consumables[cmd.itemKey] - cmd.quantity);
        ctx.sideEffects.push({ type: 'consumable_used', characterId: t.characterId!, itemKey: cmd.itemKey, quantity: cmd.quantity });
      }
      ctx.log(`💸 ${cmd.reason}: ${cmd.quantity}× ${item.name} de ${heroes.map((h) => h.name).join(', ')}`, { type: 'recompensa' });
      return;
    }
    case 'party.rest': {
      if (state.combat) throw new CommandError('Não dá para descansar no meio do combate');
      const heroes = state.tokens.filter((t) => t.kind === 'personagem' && !t.dead);
      for (const t of heroes) {
        if (cmd.kind === 'longo') {
          t.hp = t.maxHp;
          t.stamina = t.maxStamina;
          t.tempHp = 0;
          t.deathSaves = undefined;
          t.conditions = t.conditions.filter((c) => c === 'molhado');
        } else {
          t.hp = Math.min(t.maxHp, t.hp + Math.max(1, Math.ceil(t.maxHp / 4)));
          t.stamina = Math.min(t.maxStamina, t.stamina + Math.ceil(t.maxStamina / 2));
          if (t.hp > 0) {
            removeCondition(t, 'inconsciente');
            t.deathSaves = undefined;
          }
        }
        if (t.characterId) ctx.sideEffects.push({ type: 'character_hp', characterId: t.characterId, hp: t.hp, stamina: t.stamina });
      }
      ctx.log(
        cmd.kind === 'longo'
          ? '🌙 Descanso longo: uma noite inteira de sono. PV e Estamina totalmente recuperados.'
          : '☕ Descanso curto (1 hora): cada herói recupera ¼ do PV máximo e metade da Estamina.',
        { type: 'sistema' },
      );
      return;
    }
    case 'check.clear':
      state.checks = (state.checks ?? []).filter((c) => c.status === 'pendente');
      return;
    case 'reward.grant':
      grantToHeroes(ctx, { tokenIds: cmd.tokenIds, xp: cmd.xp, dracmas: cmd.dracmas, items: cmd.items, reason: cmd.reason });
      return;
    case 'chest.place':
      placeChest(ctx, { x: cmd.x, y: cmd.y, loot: cmd.loot, dracmas: cmd.dracmas, lockDc: cmd.lockDc, tier: cmd.tier });
      return;
    case 'adventure.load': {
      if (cmd.replace) {
        state.chapters = [];
        state.activeChapterId = null;
        state.sideQuests = state.sideQuests.filter((q) => q.status !== 'ativa' || !q.hidden);
      }
      const base = state.chapters.length;
      cmd.chapters.forEach((c, i) => state.chapters.push({ id: ctx.id(`cap${i}`), title: c.title, description: c.description, status: 'pendente', order: base + i + 1 }));
      cmd.quests.forEach((q, i) => state.sideQuests.push({
        id: ctx.id(`qst${i}`), title: q.title, description: q.description, status: 'ativa', hidden: q.hidden, progress: 0, target: q.target,
        reward: q.reward, rewardXp: q.rewardXp, rewardDracmas: q.rewardDracmas, rewardItems: q.rewardItems,
        expiresAtRound: null, expiresAt: null, onExpire: null, createdAt: ctx.now,
      }));
      ctx.log(`📚 Aventura carregada: ${cmd.chapters.length} capítulo(s) e ${cmd.quests.length} quest(s).`, { type: 'capitulo', visibility: 'mestre' });
      return;
    }
    case 'dice.roll': {
      let r;
      try {
        r = roll(cmd.formula, ctx.rng);
      } catch (e) {
        throw new CommandError(e instanceof DiceError ? e.message : 'Fórmula inválida');
      }
      const visibility = cmd.visibility === 'secreto' ? 'mestre' : cmd.visibility;
      const detail = r.terms.filter((x) => x.rolls.length).map((x) => `[${x.rolls.join(', ')}]`).join(' ');
      const tag = r.critical ? ' — CRÍTICO! 🌟' : r.fumble ? ' — falha crítica 💀' : '';
      const who = cmd.visibility === 'secreto' ? '🔒 Mestre (secreto)' : cmd.visibility === 'privado' ? `🔒 ${actor.username} (privado)` : `🎲 ${actor.username}`;
      ctx.log(`${who}${cmd.label ? ` — ${cmd.label}` : ''}: ${r.formula} = ${r.total} ${detail}${tag}`, { type: 'dado', visibility, data: { ...r, label: cmd.label ?? null } });
      ctx.emit({ type: 'dado', total: r.total, formula: r.formula, visibility });
      return;
    }
    case 'chat.say':
      ctx.log(`💬 ${actor.username}: ${cmd.text}`, { type: 'chat' });
      return;

    // ─────────── Mestre ───────────
    case 'table.setPaused':
      state.paused = cmd.paused;
      ctx.log(cmd.paused ? '⏸️ O Mestre pausou a mesa.' : '▶️ A mesa foi retomada.', { type: 'sistema' });
      return;
    case 'table.options':
      state.options = { ...state.options, ...(cmd.monsterLoot !== undefined ? { monsterLoot: cmd.monsterLoot } : {}) };
      ctx.log(`⚙️ Espólio dos monstros: ${state.options.monsterLoot === false ? 'desligado' : 'ligado'}`, { type: 'sistema', visibility: 'mestre' });
      return;
    case 'chapter.create':
      state.chapters.push({ id: ctx.id('cap'), title: cmd.title, description: cmd.description, status: 'pendente', order: state.chapters.length + 1 });
      ctx.log(`📖 Capítulo criado: ${cmd.title}`, { type: 'capitulo', visibility: 'mestre' });
      return;
    case 'chapter.update': {
      const c = state.chapters.find((x) => x.id === cmd.id);
      if (!c) throw new CommandError('Capítulo não encontrado');
      if (cmd.title !== undefined) c.title = cmd.title;
      if (cmd.description !== undefined) c.description = cmd.description;
      if (cmd.status !== undefined) c.status = cmd.status;
      return;
    }
    case 'chapter.delete':
      if (!state.chapters.some((c) => c.id === cmd.id)) throw new CommandError('Capítulo não encontrado');
      state.chapters = state.chapters.filter((c) => c.id !== cmd.id).map((c, i) => ({ ...c, order: i + 1 }));
      if (state.activeChapterId === cmd.id) state.activeChapterId = null;
      return;
    case 'chapter.activate': {
      const c = state.chapters.find((x) => x.id === cmd.id);
      if (!c) throw new CommandError('Capítulo não encontrado');
      for (const other of state.chapters) if (other.status === 'ativo') other.status = 'concluido';
      c.status = 'ativo';
      state.activeChapterId = c.id;
      ctx.log(`📖 Começa o capítulo: ${c.title}`, { type: 'capitulo' });
      return;
    }
    case 'monster.spawn': {
      if (!getMonster(cmd.monsterKey)) throw new CommandError('Monstro desconhecido');
      assertFreeCell(state, cmd.x, cmd.y);
      const tok = createMonsterToken(cmd.monsterKey, cmd.x, cmd.y, ctx.id('mon'), { hidden: cmd.hidden, rng: ctx.rng, rollHp: cmd.rollHp, name: cmd.name });
      state.tokens.push(tok);
      if (state.combat) {
        const init = roll('1d20', ctx.rng).total + tok.initiativeBonus;
        state.combat.order.push({ tokenId: tok.id, initiative: init });
        state.combat.economy[tok.id] = { action: 1, bonusAction: 1, reaction: 1, movement: tok.speed };
      }
      ctx.log(`👹 ${tok.name} entra em cena${cmd.hidden ? ' (oculto)' : ''}!`, { type: 'combate', visibility: cmd.hidden ? 'mestre' : 'publico' });
      return;
    }
    case 'token.update': {
      const t = requireToken(state, cmd.tokenId);
      const p = cmd.patch;
      if (p.x !== undefined || p.y !== undefined) {
        const nx = p.x ?? t.x;
        const ny = p.y ?? t.y;
        if (!inBounds(state.map, nx, ny)) throw new CommandError('Fora do mapa');
        const other = tokenAt(state, nx, ny, t.id);
        if (other) throw new CommandError(`Casa ocupada por ${other.name}`);
        t.x = nx;
        t.y = ny;
      }
      if (p.name !== undefined) t.name = p.name;
      if (p.hp !== undefined) {
        t.hp = Math.min(p.hp, t.maxHp);
        if (t.hp > 0) {
          t.dead = false;
          removeCondition(t, 'inconsciente');
        }
      }
      if (p.tempHp !== undefined) t.tempHp = p.tempHp;
      if (p.stamina !== undefined) t.stamina = Math.min(p.stamina, t.maxStamina);
      if (p.ac !== undefined) t.ac = p.ac;
      if (p.hidden !== undefined) t.hidden = p.hidden;
      if (p.conditions !== undefined) t.conditions = p.conditions as Condition[];
      if (t.characterId) ctx.sideEffects.push({ type: 'character_hp', characterId: t.characterId, hp: t.hp, stamina: t.stamina });
      ctx.log(`🛠️ Mestre ajustou ${t.name}`, { type: 'sistema', visibility: 'mestre' });
      return;
    }
    case 'token.remove': {
      const t = requireToken(state, cmd.tokenId);
      if (t.kind === 'personagem') throw new CommandError('Personagens de jogadores não podem ser removidos da mesa (use pausar/banir)');
      state.tokens = state.tokens.filter((x) => x.id !== t.id);
      if (state.combat) {
        const wasCurrent = currentTurnTokenId(state.combat) === t.id;
        const idx = state.combat.order.findIndex((e) => e.tokenId === t.id);
        state.combat.order = state.combat.order.filter((e) => e.tokenId !== t.id);
        delete state.combat.economy[t.id];
        if (idx >= 0 && idx < state.combat.turnIndex) state.combat.turnIndex -= 1;
        if (state.combat.turnIndex >= state.combat.order.length) state.combat.turnIndex = 0;
        if (wasCurrent && state.combat.order.length) {
          state.combat.turnIndex -= 1;
          nextTurn(ctx);
        }
      }
      ctx.log(`${t.name} foi removido da mesa.`, { type: 'sistema', visibility: t.hidden ? 'mestre' : 'publico' });
      return;
    }
    case 'combat.start':
      startCombat(ctx, cmd.tokenIds);
      return;
    case 'combat.end':
      endCombat(ctx);
      return;
    case 'combat.next':
      nextTurn(ctx);
      return;
    case 'map.set': {
      state.map = structuredClone(cmd.map);
      relocateTokens(state);
      ctx.log(`🗺️ Novo mapa: ${cmd.map.name}`, { type: 'mapa' });
      return;
    }
    case 'map.generate': {
      const seed = cmd.seed ?? Math.floor(ctx.rng() * 1e6).toString(36);
      state.map = generateMap(cmd.kind, cmd.width, cmd.height, seed);
      relocateTokens(state);
      ctx.log(`🗺️ Novo mapa gerado: ${state.map.name}`, { type: 'mapa' });
      return;
    }
    case 'map.mood':
      state.map.mood = cmd.mood;
      ctx.log(`🌗 Ambiente: ${cmd.mood}`, { type: 'mapa', visibility: 'mestre' });
      return;
    case 'map.paint': {
      for (const c of cmd.cells) {
        const tile = tileAt(state.map, c.x, c.y);
        if (!tile) continue;
        if (c.t) {
          tile.t = c.t;
          delete tile.hp;
        }
        if (c.o !== undefined) tile.o = c.o ? { type: c.o, hp: OBJECTS[c.o].maxHp } : null;
        if (c.s !== undefined) tile.s = c.s ? { type: c.s, rounds: SURFACES[c.s].duration } : null;
      }
      ctx.log(`🖌️ Mestre editou ${cmd.cells.length} casa(s) do mapa`, { type: 'mapa', visibility: 'mestre' });
      return;
    }
    case 'map.element':
      ctx.log(`🌪️ O Mestre libera ${cmd.element} em (${cmd.x}, ${cmd.y})!`, { type: 'mapa' });
      applyElementArea(ctx, cmd.x, cmd.y, cmd.radius, cmd.element, { damage: cmd.damage, saveDc: 13, source: 'Mestre' });
      return;
    case 'map.damage': {
      const tile = tileAt(state.map, cmd.x, cmd.y);
      if (!tile) throw new CommandError('Casa fora do mapa');
      const label = tile.o ? OBJECTS[tile.o.type].label : TERRAIN[tile.t].label;
      const destroyed = damageTile(ctx, cmd.x, cmd.y, cmd.amount, cmd.damageType);
      if (!destroyed) ctx.log(`💥 ${label} sofre ${cmd.amount} de dano`, { type: 'mapa', visibility: 'mestre' });
      return;
    }
    case 'quest.create': {
      state.sideQuests.push({
        id: ctx.id('qst'),
        title: cmd.title,
        description: cmd.description,
        status: 'ativa',
        hidden: cmd.hidden,
        progress: 0,
        target: cmd.target,
        reward: cmd.reward,
        rewardXp: cmd.rewardXp,
        rewardDracmas: cmd.rewardDracmas,
        rewardItems: cmd.rewardItems,
        expiresAtRound: cmd.expiresInRounds && state.combat ? state.combat.round + cmd.expiresInRounds - 1 : null,
        expiresAt: cmd.expiresInSeconds ? ctx.now + cmd.expiresInSeconds * 1000 : null,
        onExpire: cmd.onExpire ?? null,
        createdAt: ctx.now,
      });
      ctx.log(`📜 Nova side quest: ${cmd.title}`, { type: 'quest', visibility: cmd.hidden ? 'mestre' : 'publico' });
      return;
    }
    case 'quest.update': {
      const q = state.sideQuests.find((x) => x.id === cmd.id);
      if (!q) throw new CommandError('Quest não encontrada');
      if (cmd.title !== undefined) q.title = cmd.title;
      if (cmd.description !== undefined) q.description = cmd.description;
      if (cmd.hidden !== undefined) q.hidden = cmd.hidden;
      if (cmd.status !== undefined && cmd.status !== q.status) {
        if (cmd.status === 'concluida') completeQuest(ctx, q);
        else {
          q.status = cmd.status;
          ctx.log(`📜 Quest "${q.title}": ${cmd.status}`, { type: 'quest', visibility: q.hidden ? 'mestre' : 'publico' });
        }
      }
      return;
    }
    case 'quest.progress': {
      const q = state.sideQuests.find((x) => x.id === cmd.id);
      if (!q) throw new CommandError('Quest não encontrada');
      progressQuest(ctx, q, cmd.delta);
      return;
    }
    case 'quest.delete':
      state.sideQuests = state.sideQuests.filter((q) => q.id !== cmd.id);
      return;
    case 'player.pause': {
      const p = state.players[cmd.userId];
      if (!p) throw new CommandError('Jogador não está na mesa');
      p.paused = cmd.paused;
      ctx.log(`${cmd.paused ? '⏸️' : '▶️'} ${p.username} ${cmd.paused ? 'foi pausado' : 'pode jogar novamente'}.`, { type: 'sistema' });
      return;
    }
    case 'player.ban': {
      const p = state.players[cmd.userId];
      if (!p) throw new CommandError('Jogador não está na mesa');
      delete state.players[cmd.userId];
      for (const t of state.tokens) if (t.ownerUserId === cmd.userId) t.hidden = true;
      ctx.sideEffects.push({ type: 'player_banned', userId: cmd.userId });
      ctx.log(`🚫 ${p.username} foi banido da mesa.`, { type: 'sistema' });
      return;
    }
    case 'affinity.adjust': {
      const t = requireToken(state, cmd.tokenId);
      if (!t.characterId) throw new CommandError('Apenas personagens têm afinidade divina');
      ctx.sideEffects.push({ type: 'affinity_changed', characterId: t.characterId, delta: cmd.delta });
      ctx.log(`${cmd.delta >= 0 ? '🌟' : '🌩️'} Os deuses ${cmd.delta >= 0 ? 'sorriem para' : 'se irritam com'} ${t.name} (${cmd.delta >= 0 ? '+' : ''}${cmd.delta} afinidade)`, { type: 'divino', data: { min: AFFINITY_MIN, max: AFFINITY_MAX } });
      return;
    }
  }
}

function assertFreeCell(state: TableState, x: number, y: number) {
  const tile = tileAt(state.map, x, y);
  if (!tile) throw new CommandError('Casa fora do mapa');
  if (!isWalkableTile(tile)) throw new CommandError(`${TERRAIN[tile.t].label} não é uma casa livre`);
  const t = tokenAt(state, x, y);
  if (t) throw new CommandError(`Casa ocupada por ${t.name}`);
}

/** Reposiciona tokens que ficaram fora do mapa ou sobre casas bloqueadas. */
function relocateTokens(state: TableState) {
  for (const t of state.tokens) {
    const tile = tileAt(state.map, t.x, t.y);
    if (!tile || !isWalkableTile(tile) || TERRAIN[tile.t].hazard || tokenAt(state, t.x, t.y, t.id)) {
      const free = findFreeCell(state, t.id);
      if (free) {
        t.x = free.x;
        t.y = free.y;
      }
    }
  }
}

export function findFreeCell(state: TableState, ignoreId?: string, near?: { x: number; y: number }): { x: number; y: number } | null {
  const cx = near?.x ?? Math.floor(state.map.width / 2);
  const cy = near?.y ?? Math.floor(state.map.height / 2);
  const maxR = Math.max(state.map.width, state.map.height);
  for (let r = 0; r <= maxR; r++) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r) continue;
        const tile = tileAt(state.map, x, y);
        if (tile && isWalkableTile(tile) && !TERRAIN[tile.t].hazard && !tokenAt(state, x, y, ignoreId)) return { x, y };
      }
    }
  }
  return null;
}
