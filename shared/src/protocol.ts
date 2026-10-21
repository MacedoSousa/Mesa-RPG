import type { Command } from './engine/commands';
import type { Fx, LogEntry } from './engine/types';
import type { ProjectedState } from './engine/visibility';

/** Nomes dos eventos Socket.io (cliente ↔ servidor). */
export const EVENTS = {
  // cliente → servidor
  JOIN: 'table:join',
  LEAVE: 'table:leave',
  COMMAND: 'table:command',
  RESYNC: 'table:resync',
  // servidor → cliente
  STATE: 'table:state',
  FX: 'table:fx',
  ERROR: 'table:error',
  KICKED: 'table:kicked',
  PRESENCE: 'table:presence',
} as const;

export type Ack<T = unknown> = (res: { ok: true; data?: T } | { ok: false; error: string; code?: string }) => void;

export interface JoinPayload {
  campaignId: string;
}

export interface CommandPayload {
  /** Id gerado pelo cliente para descartar duplicatas em reenvios. */
  commandId: string;
  command: Command;
}

export interface StatePayload {
  seq: number;
  state: ProjectedState;
}

export interface FxPayload {
  seq: number;
  fx: Fx[];
  log: LogEntry[];
}

export interface ClientToServerEvents {
  'table:join': (p: JoinPayload, ack: Ack<StatePayload>) => void;
  'table:leave': () => void;
  'table:command': (p: CommandPayload, ack: Ack<{ seq: number }>) => void;
  'table:resync': (p: { campaignId: string }, ack: Ack<StatePayload>) => void;
}

export interface ServerToClientEvents {
  'table:state': (p: StatePayload) => void;
  'table:fx': (p: FxPayload) => void;
  'table:error': (p: { message: string }) => void;
  'table:kicked': (p: { reason: string }) => void;
  'table:presence': (p: { userId: string; username: string; connected: boolean }) => void;
}
