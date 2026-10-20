import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { corsOrigins } from '../config/env';
import { CharacterModel } from '../models/Character';
import { UserModel } from '../models/User';
import { rollDice } from '../utils/dice';
import { TokenPayload, verifyToken } from '../utils/jwt';

/**
 * Sincronização Host (Mestre, no PC) ↔ Jogadores (web/celular).
 *
 * Fluxo:
 *  1. Cliente conecta com `io(url, { auth: { token } })`.
 *  2. Mestre emite `session:create` → recebe um código de 6 letras.
 *  3. Jogadores emitem `session:join { code, characterId }`.
 *  4. Rolagens, chat e atualizações de ficha são retransmitidos para a sala.
 */

interface SessionPlayer {
  userId: string;
  username: string;
  characterId: string;
  characterName: string;
  socketId: string;
}

interface GameSession {
  code: string;
  hostUserId: string;
  hostSocketId: string;
  players: Map<string, SessionPlayer>; // chave: userId
  createdAt: Date;
}

interface SocketData {
  user: TokenPayload;
  sessionCode?: string;
}

type Ack<T = unknown> = (response: { ok: true; data?: T } | { ok: false; error: string }) => void;

const sessions = new Map<string, GameSession>();
let io: Server | null = null;

const room = (code: string) => `session:${code}`;

function generateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem caracteres ambíguos (0/O, 1/I)
  let code: string;
  do {
    code = Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
  } while (sessions.has(code));
  return code;
}

function sessionSnapshot(s: GameSession) {
  return {
    code: s.code,
    hostUserId: s.hostUserId,
    players: [...s.players.values()].map(({ socketId: _sid, ...p }) => p),
    createdAt: s.createdAt,
  };
}

function safeAck(ack: unknown): Ack {
  return typeof ack === 'function' ? (ack as Ack) : () => undefined;
}

export function initSockets(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: corsOrigins !== '*' },
  });

  // Autenticação via JWT no handshake
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token ?? socket.handshake.headers.authorization?.replace(/^Bearer /, '');
      if (!token) return next(new Error('Token não informado'));
      const payload = verifyToken(String(token));
      const user = await UserModel.findById(payload.sub);
      if (!user) return next(new Error('Usuário não encontrado'));
      (socket.data as SocketData).user = { sub: user.id, username: user.username, role: user.role };
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;
    console.log(`🔌 ${data.user.username} (${data.user.role}) conectou [${socket.id}]`);

    // ── Mestre cria a sessão ──
    socket.on('session:create', (_payload: unknown, rawAck?: unknown) => {
      const ack = safeAck(rawAck ?? _payload);
      if (data.user.role !== 'mestre') return ack({ ok: false, error: 'Apenas o Mestre pode criar sessões' });

      const session: GameSession = {
        code: generateCode(),
        hostUserId: data.user.sub,
        hostSocketId: socket.id,
        players: new Map(),
        createdAt: new Date(),
      };
      sessions.set(session.code, session);
      data.sessionCode = session.code;
      socket.join(room(session.code));
      console.log(`🎲 Sessão ${session.code} criada por ${data.user.username}`);
      ack({ ok: true, data: sessionSnapshot(session) });
    });

    // ── Jogador entra com um personagem ──
    socket.on('session:join', async (payload: { code?: string; characterId?: string }, rawAck?: unknown) => {
      const ack = safeAck(rawAck);
      try {
        const code = String(payload?.code ?? '').toUpperCase();
        const session = sessions.get(code);
        if (!session) return ack({ ok: false, error: 'Sessão não encontrada' });
        if (!payload?.characterId) return ack({ ok: false, error: 'Escolha um personagem' });

        const character = await CharacterModel.findById(payload.characterId, data.user.sub);
        if (!character) return ack({ ok: false, error: 'Personagem não encontrado' });

        const player: SessionPlayer = {
          userId: data.user.sub,
          username: data.user.username,
          characterId: character.id,
          characterName: character.name,
          socketId: socket.id,
        };
        session.players.set(player.userId, player);
        data.sessionCode = code;
        socket.join(room(code));
        socket.join(`character:${character.id}`);

        const { socketId: _sid, ...publicPlayer } = player;
        socket.to(room(code)).emit('session:player-joined', publicPlayer);
        ack({ ok: true, data: sessionSnapshot(session) });
      } catch (err) {
        console.error(err);
        ack({ ok: false, error: 'Erro ao entrar na sessão' });
      }
    });

    socket.on('session:leave', () => leaveSession(socket));

    // ── Rolagem de dados (sempre no servidor) ──
    socket.on('dice:roll', (payload: { expression?: string; label?: string; private?: boolean }, rawAck?: unknown) => {
      const ack = safeAck(rawAck);
      const code = data.sessionCode;
      if (!code || !sessions.has(code)) return ack({ ok: false, error: 'Você não está em uma sessão' });
      try {
        const result = {
          ...rollDice(String(payload?.expression ?? '1d20')),
          label: payload?.label ?? null,
          by: data.user.username,
          at: new Date().toISOString(),
        };
        const session = sessions.get(code)!;
        if (payload?.private) {
          // Rolagem secreta: só quem rolou e o Mestre veem
          io!.to(session.hostSocketId).emit('dice:result', { ...result, private: true });
          if (socket.id !== session.hostSocketId) socket.emit('dice:result', { ...result, private: true });
        } else {
          io!.to(room(code)).emit('dice:result', result);
        }
        ack({ ok: true, data: result });
      } catch (err) {
        ack({ ok: false, error: (err as Error).message });
      }
    });

    // ── Chat da mesa ──
    socket.on('chat:message', (payload: { text?: string }) => {
      const code = data.sessionCode;
      const text = String(payload?.text ?? '').trim().slice(0, 1000);
      if (!code || !text) return;
      io!.to(room(code)).emit('chat:message', { from: data.user.username, text, at: new Date().toISOString() });
    });

    // ── Mestre controla a cena (narração, mapa, música, etc.) ──
    socket.on('host:scene', (payload: unknown) => {
      const code = data.sessionCode;
      const session = code ? sessions.get(code) : undefined;
      if (!session || session.hostSocketId !== socket.id) return;
      socket.to(room(session.code)).emit('host:scene', payload);
    });

    socket.on('disconnect', () => {
      console.log(`🔌 ${data.user.username} desconectou`);
      leaveSession(socket);
    });
  });

  return io;
}

function leaveSession(socket: Socket) {
  const data = socket.data as SocketData;
  const code = data.sessionCode;
  if (!code) return;
  const session = sessions.get(code);
  data.sessionCode = undefined;
  socket.leave(room(code));
  if (!session) return;

  if (session.hostSocketId === socket.id) {
    // Mestre saiu: encerra a sessão para todos
    io?.to(room(code)).emit('session:closed', { code, reason: 'O Mestre encerrou a sessão' });
    io?.in(room(code)).socketsLeave(room(code));
    sessions.delete(code);
    console.log(`🛑 Sessão ${code} encerrada`);
    return;
  }

  const player = session.players.get(data.user.sub);
  if (player?.socketId === socket.id) {
    session.players.delete(data.user.sub);
    socket.leave(`character:${player.characterId}`);
    io?.to(room(code)).emit('session:player-left', { userId: player.userId, username: player.username });
  }
}

/** Chamado pelo controller quando uma ficha é atualizada via REST. */
export function broadcastCharacterUpdate(character: { id: string; userId: string }) {
  if (!io) return;
  for (const session of sessions.values()) {
    const player = session.players.get(character.userId);
    if (player?.characterId === character.id) {
      io.to(room(session.code)).emit('character:updated', character);
    }
  }
}

export function getActiveSessions() {
  return [...sessions.values()].map(sessionSnapshot);
}
