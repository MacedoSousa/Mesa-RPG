import type { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { z } from 'zod';
import { EVENTS, commandSchema, type Ack } from '@mesa/shared';
import { corsOrigins } from '../config/env';
import { Campaign } from '../models';
import { User } from '../models';
import { CampaignService } from '../services/campaignService';
import { verifyAccessToken } from '../utils/security';
import { SocketUser, TableManager, commandErrorMessage, room } from '../game/TableManager';

interface SocketData {
  user: SocketUser;
  campaignId?: string;
  masterId?: string;
  bucket: { tokens: number; last: number };
}

const joinSchema = z.object({ campaignId: z.string().uuid() });
const commandPayloadSchema = z.object({ commandId: z.string().min(1).max(64), command: commandSchema });

const RATE = { capacity: 20, refillPerSec: 10 };

function allow(data: SocketData): boolean {
  const now = Date.now();
  const b = data.bucket;
  b.tokens = Math.min(RATE.capacity, b.tokens + ((now - b.last) / 1000) * RATE.refillPerSec);
  b.last = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

function safeAck(ack: unknown): Ack {
  return typeof ack === 'function' ? (ack as Ack) : () => undefined;
}

export function createSocketServer(httpServer: HttpServer, tables: TableManager): Server {
  const io = new Server(httpServer, {
    cors: { origin: corsOrigins, credentials: true },
    // Celulares perdem conexão com frequência: recupera eventos perdidos por até 2 minutos
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000, skipMiddlewares: false },
    maxHttpBufferSize: 2e6,
  });
  tables.attach(io);

  // Autenticação via JWT de acesso no handshake
  io.use(async (socket, next) => {
    try {
      const raw = socket.handshake.auth?.token ?? String(socket.handshake.headers.authorization ?? '').replace(/^Bearer /, '');
      if (!raw) return next(new Error('Token não informado'));
      const payload = verifyAccessToken(String(raw));
      const user = await User.findByPk(payload.sub);
      if (!user || user.tokenVersion !== payload.tv) return next(new Error('Sessão inválida'));
      const data = socket.data as SocketData;
      data.user = { userId: user.id, username: user.username, role: user.role };
      data.bucket ??= { tokens: RATE.capacity, last: Date.now() };
      next();
    } catch {
      next(new Error('Token inválido ou expirado'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData;

    // Reconexão recuperada: o socket já voltou às salas; reenvia o estado atual
    if (socket.recovered && data.campaignId && data.masterId) {
      const snap = tables.projectFor(data.campaignId, data.user, data.masterId);
      if (snap) socket.emit(EVENTS.STATE, snap);
      void tables.setConnected(data.campaignId, data.user.userId, true);
    }

    socket.on(EVENTS.JOIN, async (payload: unknown, rawAck: unknown) => {
      const ack = safeAck(rawAck);
      try {
        const { campaignId } = joinSchema.parse(payload);
        const actor = { userId: data.user.userId, username: data.user.username, role: data.user.role };
        await CampaignService.access(campaignId, actor);
        const campaign = await Campaign.findByPk(campaignId);
        if (data.campaignId && data.campaignId !== campaignId) socket.leave(room(data.campaignId));

        const state = await tables.join(campaignId, data.user);
        data.campaignId = campaignId;
        data.masterId = campaign!.masterId;
        socket.join(room(campaignId));
        socket.join(`user:${data.user.userId}`);
        await tables.setConnected(campaignId, data.user.userId, true);
        ack({ ok: true, data: { seq: state.seq, state } });
        // Os demais recebem o token novo do jogador
        tables.broadcast(campaignId);
      } catch (err) {
        ack({ ok: false, ...commandErrorMessage(err) });
      }
    });

    socket.on(EVENTS.RESYNC, async (_payload: unknown, rawAck: unknown) => {
      const ack = safeAck(rawAck);
      if (!data.campaignId || !data.masterId) return ack({ ok: false, error: 'Entre em uma mesa primeiro' });
      const snap = tables.projectFor(data.campaignId, data.user, data.masterId);
      if (!snap) return ack({ ok: false, error: 'Mesa não carregada' });
      ack({ ok: true, data: snap });
    });

    socket.on(EVENTS.COMMAND, async (payload: unknown, rawAck: unknown) => {
      const ack = safeAck(rawAck);
      if (!data.campaignId || !data.masterId) return ack({ ok: false, error: 'Entre em uma mesa primeiro' });
      if (!allow(data)) return ack({ ok: false, error: 'Calma, herói! Muitos comandos por segundo.', code: 'rate_limited' });
      const parsed = commandPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        return ack({ ok: false, error: `Comando inválido: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; ')}`, code: 'invalid' });
      }
      try {
        const actor = tables.actorOf(data.user, data.masterId);
        const seq = await tables.execute(data.campaignId, actor, parsed.data.command, `${data.user.userId}:${parsed.data.commandId}`);
        ack({ ok: true, data: { seq } });
      } catch (err) {
        ack({ ok: false, ...commandErrorMessage(err) });
      }
    });

    socket.on(EVENTS.LEAVE, () => {
      if (!data.campaignId) return;
      socket.leave(room(data.campaignId));
      void tables.setConnected(data.campaignId, data.user.userId, false);
      data.campaignId = undefined;
    });

    socket.on('disconnect', async () => {
      if (!data.campaignId) return;
      const campaignId = data.campaignId;
      // Outro dispositivo do mesmo usuário ainda conectado?
      const others = (await io.in(room(campaignId)).fetchSockets()).some((s) => s.id !== socket.id && (s.data as SocketData).user?.userId === data.user.userId);
      if (!others) await tables.setConnected(campaignId, data.user.userId, false);
    });
  });

  return io;
}
