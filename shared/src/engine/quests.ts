import { grantReward, partyTokens, type EngineContext } from './context';
import { getItem } from '../content/items';
import { createMonsterToken } from './factory';
import { isWalkableTile, tileAt } from './map';
import { tokenAt } from './tokens';
import type { SideQuest } from './types';

function expireQuest(ctx: EngineContext, q: SideQuest) {
  q.status = 'expirada';
  const vis = q.hidden ? 'mestre' : 'publico';
  ctx.log(`⏳ Side quest expirada: ${q.title}${q.onExpire?.message ? ` — ${q.onExpire.message}` : ''}`, { type: 'quest', visibility: vis, data: { questId: q.id } });

  const spawn = q.onExpire?.spawn;
  if (spawn) {
    const tile = tileAt(ctx.state.map, spawn.x, spawn.y);
    if (tile && isWalkableTile(tile) && !tokenAt(ctx.state, spawn.x, spawn.y)) {
      const tok = createMonsterToken(spawn.monsterKey, spawn.x, spawn.y, ctx.id('mon'), { hidden: spawn.hidden });
      tok.figure = ctx.state.monsterLooks?.[spawn.monsterKey] ?? null;
      ctx.state.tokens.push(tok);
      ctx.log(`👹 ${tok.name} surge no mapa!`, { type: 'combate', visibility: spawn.hidden ? 'mestre' : 'publico' });
    } else {
      ctx.log(`Gatilho da quest "${q.title}" não pôde invocar o monstro (casa ocupada).`, { visibility: 'mestre' });
    }
  }
}

export function tickQuestsByRound(ctx: EngineContext, round: number) {
  for (const q of ctx.state.sideQuests) {
    if (q.status === 'ativa' && q.expiresAtRound !== null && round > q.expiresAtRound) expireQuest(ctx, q);
  }
}

/** Chamado periodicamente pelo servidor (contagem regressiva em tempo real). Retorna true se algo mudou. */
export function tickQuestsByTime(ctx: EngineContext): boolean {
  let changed = false;
  for (const q of ctx.state.sideQuests) {
    if (q.status === 'ativa' && q.expiresAt !== null && ctx.now >= q.expiresAt) {
      expireQuest(ctx, q);
      changed = true;
    }
  }
  return changed;
}

export function progressQuest(ctx: EngineContext, q: SideQuest, delta: number) {
  q.progress = Math.max(0, Math.min(q.target, q.progress + delta));
  if (q.progress >= q.target && q.status === 'ativa') completeQuest(ctx, q);
}

/** Conclui a quest e entrega a recompensa automática (XP/dracmas/itens) a todos os heróis. */
export function completeQuest(ctx: EngineContext, q: SideQuest) {
  q.status = 'concluida';
  q.progress = q.target;
  ctx.log(`🏆 Quest concluída: ${q.title}${q.reward ? ` — ${q.reward}` : ''}`, { type: 'quest', visibility: q.hidden ? 'mestre' : 'publico' });
  const xp = q.rewardXp ?? 0;
  const dracmas = q.rewardDracmas ?? 0;
  const items = (q.rewardItems ?? []).filter((i) => getItem(i.itemKey));
  if (!xp && !dracmas && !items.length) return;
  const party = partyTokens(ctx.state);
  for (const h of party) {
    grantReward(ctx, h.characterId!, { xp, dracmas, items, reason: `quest "${q.title}"` });
    for (const l of items) if (getItem(l.itemKey)?.kind === 'consumivel') h.consumables[l.itemKey] = (h.consumables[l.itemKey] ?? 0) + l.quantity;
  }
  const parts = [xp ? `${xp} XP` : '', dracmas ? `${dracmas} dracmas` : '', ...items.map((l) => `${l.quantity}× ${getItem(l.itemKey)!.name}`)].filter(Boolean);
  if (party.length) ctx.log(`🎁 Cada herói recebe: ${parts.join(', ')}`, { type: 'recompensa' });
}
