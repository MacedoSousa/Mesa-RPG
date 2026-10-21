import { create } from 'zustand';
import { io, type Socket } from 'socket.io-client';
import { loadPaintedArt } from './tokenArt';
import {
  EVENTS, type Command, type Fx, type FxPayload, type LogEntry, type ProjectedState, type StatePayload,
} from '@mesa/shared';
import { getAccessToken, onSession, refreshSession, type PublicUser } from './api';

// ───────────────────────────── Sessão ─────────────────────────────

interface SessionStore {
  user: PublicUser | null;
  ready: boolean;
  init(): Promise<void>;
}

export const useSession = create<SessionStore>((set) => ({
  user: null,
  ready: false,
  async init() {
    await refreshSession();
    set({ ready: true });
  },
}));

onSession((_t, user) => useSession.setState({ user }));

// ───────────────────────────── Toasts ─────────────────────────────

export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'erro' | 'sucesso' | 'dado';
}

interface ToastStore {
  toasts: Toast[];
  push(text: string, kind?: Toast['kind']): void;
  dismiss(id: number): void;
}

let toastId = 0;
export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push(text, kind = 'info') {
    const id = ++toastId;
    set({ toasts: [...get().toasts.slice(-4), { id, text, kind }] });
    setTimeout(() => get().dismiss(id), kind === 'erro' ? 6000 : 4000);
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = (text: string, kind?: Toast['kind']) => useToasts.getState().push(text, kind);

// ───────────────────────────── Mesa (WebSocket) ─────────────────────────────

type ConnStatus = 'desconectado' | 'conectando' | 'conectado' | 'erro';

export interface FxEvent {
  id: number;
  fx: Fx;
  at: number;
}

interface TableStore {
  status: ConnStatus;
  campaignId: string | null;
  seq: number;
  state: ProjectedState | null;
  fx: FxEvent[];
  kicked: string | null;
  connect(campaignId: string): void;
  disconnect(): void;
  send(command: Command): Promise<boolean>;
  consumeFx(ids: number[]): void;
}

let socket: Socket | null = null;
let fxId = 0;

function newCommandId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

export const useTable = create<TableStore>((set, get) => ({
  status: 'desconectado',
  campaignId: null,
  seq: 0,
  state: null,
  fx: [],
  kicked: null,

  connect(campaignId) {
    get().disconnect();
    set({ status: 'conectando', campaignId, state: null, seq: 0, kicked: null });
    const s = io({
      auth: (cb) => cb({ token: getAccessToken() }),
      transports: ['websocket', 'polling'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 4000,
    });
    socket = s;

    const join = () => {
      s.emit(EVENTS.JOIN, { campaignId }, (res: { ok: boolean; data?: StatePayload; error?: string }) => {
        if (res.ok && res.data) set({ status: 'conectado', state: res.data.state, seq: res.data.seq });
        else {
          set({ status: 'erro' });
          toast(res.error ?? 'Não foi possível entrar na mesa', 'erro');
        }
      });
    };

    s.on('connect', join); // reconexão também refaz o join → snapshot completo (ressincroniza)
    s.on('connect_error', async (err) => {
      if (/expirad|inválid/i.test(err.message) && (await refreshSession())) s.connect();
      else set({ status: 'erro' });
    });
    s.on('disconnect', () => set({ status: 'conectando' }));

    s.on(EVENTS.STATE, (p: StatePayload) => {
      if (p.seq < get().seq) return; // descarta estado antigo fora de ordem
      set({ state: p.state, seq: p.seq });
    });
    s.on(EVENTS.FX, (p: FxPayload) => {
      const now = Date.now();
      const events = p.fx.map((fx) => ({ id: ++fxId, fx, at: now }));
      set({ fx: [...get().fx, ...events].slice(-40) });
      notifyLog(p.log);
    });
    s.on(EVENTS.ART, () => void loadPaintedArt(true));
    s.on(EVENTS.KICKED, (p: { reason: string }) => {
      set({ kicked: p.reason, status: 'desconectado' });
      toast(p.reason, 'erro');
      s.disconnect();
    });
  },

  disconnect() {
    if (socket) {
      socket.emit(EVENTS.LEAVE);
      socket.removeAllListeners();
      socket.disconnect();
      socket = null;
    }
    set({ status: 'desconectado', state: null, campaignId: null });
  },

  /** Envia um comando ao Host. O servidor valida tudo; a UI só reflete o estado que volta. */
  send(command) {
    return new Promise((resolve) => {
      if (!socket?.connected) {
        toast('Sem conexão com a mesa', 'erro');
        return resolve(false);
      }
      socket.timeout(8000).emit(EVENTS.COMMAND, { commandId: newCommandId(), command }, (err: Error | null, res?: { ok: boolean; error?: string }) => {
        if (err) {
          toast('O Host não respondeu a tempo', 'erro');
          return resolve(false);
        }
        if (!res?.ok) toast(res?.error ?? 'Comando recusado', 'erro');
        resolve(!!res?.ok);
      });
    });
  },

  consumeFx(ids) {
    set({ fx: get().fx.filter((f) => !ids.includes(f.id)) });
  },
}));

/** Mostra rolagens e eventos importantes como toasts. */
function notifyLog(entries: LogEntry[]) {
  for (const e of entries) {
    if (e.type === 'dado') toast(e.text, 'dado');
    else if (e.type === 'turno' && e.text.startsWith('▶️')) toast(e.text, 'info');
    else if (e.type === 'quest' || e.type === 'capitulo' || e.type === 'divino' || e.type === 'recompensa') toast(e.text, 'sucesso');
    else if (e.type === 'teste') toast(e.text, e.text.startsWith('❌') ? 'erro' : 'dado');
  }
}
