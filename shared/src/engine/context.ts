import { Rng, defaultRng } from '../dice';
import type { Actor, Fx, LogEntry, TableState, Visibility } from './types';

export const LOG_LIMIT = 300;

export class CommandError extends Error {
  constructor(message: string, public code = 'invalid') {
    super(message);
  }
}

export interface EngineContext {
  state: TableState;
  actor: Actor;
  rng: Rng;
  now: number;
  fx: Fx[];
  newLog: LogEntry[];
  /** Mudanças que o servidor precisa persistir fora do estado (ex.: inventário). */
  sideEffects: SideEffect[];
  log(text: string, opts?: { type?: string; visibility?: Visibility; data?: Record<string, unknown> }): LogEntry;
  emit(fx: Fx): void;
  id(prefix: string): string;
}

export type SideEffect =
  | { type: 'consumable_used'; characterId: string; itemKey: string; quantity: number }
  | { type: 'character_hp'; characterId: string; hp: number; stamina: number }
  | { type: 'player_banned'; userId: string }
  | { type: 'affinity_changed'; characterId: string; delta: number };

export function createContext(state: TableState, actor: Actor, rng: Rng = defaultRng, now = Date.now()): EngineContext {
  const ctx: EngineContext = {
    state,
    actor,
    rng,
    now,
    fx: [],
    newLog: [],
    sideEffects: [],
    log(text, opts = {}) {
      state.logSeq += 1;
      const entry: LogEntry = {
        id: state.logSeq,
        at: now,
        type: opts.type ?? 'info',
        text,
        visibility: opts.visibility ?? 'publico',
        actorUserId: actor.userId,
        data: opts.data,
      };
      state.log.push(entry);
      if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
      ctx.newLog.push(entry);
      return entry;
    },
    emit(fx) {
      ctx.fx.push(fx);
    },
    id(prefix) {
      const rand = Math.floor(rng() * 0xffffff).toString(36);
      return `${prefix}_${now.toString(36)}${rand}${state.logSeq}`;
    },
  };
  return ctx;
}
