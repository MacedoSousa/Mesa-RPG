import { currentTurnTokenId } from './combat';
import { hpStatus } from './tokens';
import type { Actor, CombatState, LogEntry, TableState, Token } from './types';

/** Token como o jogador o enxerga: monstros sem números de PV nem ficha completa. */
export interface PlayerTokenView extends Omit<Token, 'hp' | 'maxHp' | 'attacks' | 'abilityMods'> {
  hp: number | null;
  maxHp: number | null;
  hpStatus: ReturnType<typeof hpStatus>;
  attacks: Token['attacks'];
  abilityMods: Token['abilityMods'] | null;
}

/** Combate projetado: inclui de quem é o turno ('__oculto__' quando é um monstro escondido). */
export type ProjectedCombat = CombatState & { currentTokenId: string | null };

export type ProjectedState = Omit<TableState, 'tokens' | 'combat'> & {
  tokens: (Token | PlayerTokenView)[];
  combat: ProjectedCombat | null;
  viewer: { userId: string; role: Actor['role'] };
};

export function canSeeLog(entry: LogEntry, viewer: Actor): boolean {
  if (viewer.role === 'MASTER') return true;
  if (entry.visibility === 'publico') return true;
  if (entry.visibility === 'privado') return entry.actorUserId === viewer.userId;
  return false;
}

function projectToken(t: Token, viewer: Actor): Token | PlayerTokenView {
  const own = t.ownerUserId === viewer.userId;
  const ally = t.kind !== 'monstro';
  if (own || ally) return { ...t, hpStatus: hpStatus(t) } as PlayerTokenView;
  return {
    ...t,
    hp: null,
    maxHp: null,
    hpStatus: hpStatus(t),
    attacks: [],
    abilityMods: null,
    resistances: [],
    consumables: {},
  };
}

/**
 * Filtro no servidor: cada destinatário recebe apenas o que pode ver.
 * Monstros ocultos, rolagens secretas, PV de monstros e quests ocultas nunca saem do servidor para jogadores.
 */
export function projectStateFor(state: TableState, viewer: Actor): ProjectedState {
  const current = currentTurnTokenId(state.combat);
  const base = { ...state, viewer: { userId: viewer.userId, role: viewer.role } };
  if (viewer.role === 'MASTER') {
    return { ...base, tokens: state.tokens, combat: state.combat ? { ...state.combat, currentTokenId: current } : null };
  }

  const visibleTokens = state.tokens.filter((t) => !t.hidden || t.ownerUserId === viewer.userId);
  const visibleIds = new Set(visibleTokens.map((t) => t.id));

  return {
    ...base,
    tokens: visibleTokens.map((t) => projectToken(t, viewer)),
    combat: state.combat
      ? {
          ...state.combat,
          order: state.combat.order.filter((e) => visibleIds.has(e.tokenId)),
          turnIndex: Math.max(0, state.combat.order.filter((e) => visibleIds.has(e.tokenId)).findIndex((e) => e.tokenId === current)),
          currentTokenId: current && visibleIds.has(current) ? current : current ? '__oculto__' : null,
          economy: Object.fromEntries(Object.entries(state.combat.economy).filter(([id]) => visibleIds.has(id))),
        }
      : null,
    // Conteúdo e CD dos baús ficam no servidor; jogador só sabe se está trancado
    map: {
      ...state.map,
      tiles: state.map.tiles.map((t) => (t.o && (t.o.loot || t.o.lockDc || t.o.dracmas)
        ? { ...t, o: { type: t.o.type, hp: t.o.hp, ...(t.o.lockDc ? { locked: true } : {}) } }
        : t)),
    },
    checks: (state.checks ?? []).map((c) => (c.secretDc ? { ...c, dc: 0 } : c)),
    sideQuests: state.sideQuests.filter((q) => !q.hidden),
    chapters: state.chapters.filter((c) => c.status !== 'pendente'),
    log: state.log.filter((e) => canSeeLog(e, viewer)),
  };
}
