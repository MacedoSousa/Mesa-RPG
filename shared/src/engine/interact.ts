import { getItem } from '../content/items';
import { LOOT_TABLES, rollLoot, type LootTier } from '../content/loot';
import { d20Formula, roll } from '../dice';
import { CommandError, grantReward, partyTokens, type EngineContext } from './context';
import { economyOf } from './combat';
import { OBJECTS, tileAt } from './map';
import { gridDistance } from './pathfinding';
import type { LootEntry, Token } from './types';

export function validateLoot(loot: LootEntry[]) {
  for (const l of loot) if (!getItem(l.itemKey)) throw new CommandError(`Item desconhecido no baú: ${l.itemKey}`);
}

/** Mestre coloca um baú (conteúdo manual ou sorteado por tabela). */
export function placeChest(
  ctx: EngineContext,
  o: { x: number; y: number; loot?: LootEntry[]; dracmas?: number; lockDc?: number | null; tier?: LootTier },
) {
  const tile = tileAt(ctx.state.map, o.x, o.y);
  if (!tile) throw new CommandError('Casa fora do mapa');
  if (ctx.state.tokens.some((t) => !t.dead && t.x === o.x && t.y === o.y)) throw new CommandError('Casa ocupada');
  let loot = o.loot ?? [];
  let dracmas = o.dracmas ?? 0;
  if (o.tier) {
    const r = rollLoot(o.tier, ctx.rng);
    loot = [...loot, ...r.loot];
    dracmas += r.dracmas;
  }
  validateLoot(loot);
  tile.o = { type: 'bau', hp: OBJECTS.bau.maxHp, loot, dracmas, ...(o.lockDc ? { lockDc: o.lockDc } : {}) };
  const desc = [...loot.map((l) => `${l.quantity}× ${getItem(l.itemKey)!.name}`), dracmas ? `${dracmas} dracmas` : ''].filter(Boolean).join(', ');
  ctx.log(`🧰 Baú colocado em (${o.x}, ${o.y})${o.lockDc ? ` — trancado CD ${o.lockDc}` : ''}: ${desc || 'vazio'}${o.tier ? ` (${LOOT_TABLES[o.tier].label})` : ''}`, { type: 'mapa', visibility: 'mestre' });
}

/** Herói ao lado abre o baú (Ação no combate). Trancado: teste de Prestidigitação (DES) ou Atletismo (FOR). */
export function openChest(ctx: EngineContext, t: Token, x: number, y: number) {
  const tile = tileAt(ctx.state.map, x, y);
  if (!tile?.o || tile.o.type !== 'bau') throw new CommandError(tile?.o?.type === 'bau_aberto' ? 'Este baú já foi aberto' : 'Não há baú aí');
  if (gridDistance(t, { x, y }) > 1) throw new CommandError('Chegue ao lado do baú para abrir');
  const eco = economyOf(ctx, t);
  if (eco) {
    if (eco.action < 1) throw new CommandError('Você já usou sua Ação neste turno');
    eco.action -= 1;
  }
  const chest = tile.o;
  if (chest.lockDc) {
    const skills = t.skills ?? [];
    const dexMod = t.abilityMods.destreza + (skills.includes('prestidigitacao') ? t.proficiency : 0);
    const strMod = t.abilityMods.forca + (skills.includes('atletismo') ? t.proficiency : 0);
    const useDex = dexMod >= strMod;
    const mod = useDex ? dexMod : strMod;
    const r = roll(d20Formula(mod), ctx.rng);
    const how = useDex ? 'abrir a fechadura (Prestidigitação)' : 'arrombar a tampa (Atletismo)';
    if (r.total < chest.lockDc) {
      ctx.log(`🔒 ${t.name} tenta ${how}: ${r.total} — não abriu. Dá para tentar de novo.`, { type: 'teste' });
      return false;
    }
    ctx.log(`🔓 ${t.name} consegue ${how}: ${r.total}!`, { type: 'teste' });
  }
  const loot = chest.loot ?? [];
  const dracmas = chest.dracmas ?? 0;
  tile.o = { type: 'bau_aberto', hp: OBJECTS.bau_aberto.maxHp };
  ctx.emit({ type: 'destruicao', x, y });
  const desc = [...loot.map((l) => `${l.quantity}× ${getItem(l.itemKey)?.name ?? l.itemKey}`), dracmas ? `${dracmas} dracmas` : ''].filter(Boolean).join(', ');
  ctx.log(`🧰 ${t.name} abre o baú e encontra: ${desc || 'nada… só poeira e uma teia de aranha'}!`, { type: 'recompensa' });
  if (t.characterId && (loot.length || dracmas)) {
    grantReward(ctx, t.characterId, { items: loot, dracmas, reason: 'baú de tesouro' });
    for (const l of loot) if (getItem(l.itemKey)?.kind === 'consumivel') t.consumables[l.itemKey] = (t.consumables[l.itemKey] ?? 0) + l.quantity;
  }
  return true;
}

/** Recompensa do Mestre para heróis escolhidos (ou todos): XP, dracmas e itens. */
export function grantToHeroes(
  ctx: EngineContext,
  o: { tokenIds: string[] | 'todos'; xp: number; dracmas: number; items: LootEntry[]; reason: string },
) {
  validateLoot(o.items);
  const party = partyTokens(ctx.state);
  const heroes = o.tokenIds === 'todos' ? party : ctx.state.tokens.filter((t) => (o.tokenIds as string[]).includes(t.id) && t.characterId);
  if (!heroes.length) throw new CommandError('Nenhum herói para receber a recompensa');
  for (const h of heroes) {
    grantReward(ctx, h.characterId!, { xp: o.xp, dracmas: o.dracmas, items: o.items, reason: o.reason });
    for (const l of o.items) if (getItem(l.itemKey)?.kind === 'consumivel') h.consumables[l.itemKey] = (h.consumables[l.itemKey] ?? 0) + l.quantity;
  }
  const parts = [o.xp ? `${o.xp} XP` : '', o.dracmas ? `${o.dracmas} dracmas` : '', ...o.items.map((l) => `${l.quantity}× ${getItem(l.itemKey)!.name}`)].filter(Boolean);
  ctx.log(`🎁 Recompensa (${o.reason}) para ${heroes.map((h) => h.name).join(', ')}: ${parts.join(', ') || 'reconhecimento dos deuses'}`, { type: 'recompensa' });
}
