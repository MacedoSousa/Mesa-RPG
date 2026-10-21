import type { Server, Socket } from 'socket.io';
import {
  Actor, Command, CommandError, EVENTS, Fx, LogEntry, SideEffect, TABLE_SCHEMA_VERSION, TableState, applyCommand,
  buildPresetMap, canSeeLog, createContext, createTableState, decaySurfaces, findFreeCell, migrateTableState,
  PRESET_MAPS, projectStateFor, tickQuestsByTime, tokenFromCharacter,
} from '@mesa/shared';
import { Op } from 'sequelize';
import { env } from '../config/env';
import { Campaign, CampaignMember, GameEvent, SaveGame } from '../models';
import { CharacterService } from '../services/characterService';
import { HttpError } from '../utils/HttpError';

interface LiveTable {
  state: TableState;
  dirty: boolean;
  lastSavedSeq: number;
  explorationTick: number;
  /** Ids de comandos recentes (descarta reenvios duplicados). */
  recentCommands: Map<string, number>;
  /** Fila para aplicar comandos em ordem, um de cada vez. */
  queue: Promise<unknown>;
}

const SYSTEM_ACTOR: Actor = { userId: 'system', username: 'Sistema', role: 'MASTER' };

export interface SocketUser {
  userId: string;
  username: string;
  role: Actor['role'];
}

export const room = (campaignId: string) => `camp:${campaignId}`;

/**
 * Gerencia as mesas ativas no Host. O estado vive em memória (fonte da verdade)
 * e é persistido como snapshots versionados (save_games) + log de eventos (game_events).
 */
export class TableManager {
  private tables = new Map<string, LiveTable>();
  private loading = new Map<string, Promise<LiveTable>>();
  private timers: NodeJS.Timeout[] = [];

  constructor(private io: Server | null = null) {}

  attach(io: Server) {
    this.io = io;
  }

  start() {
    this.timers.push(setInterval(() => void this.tick().catch((e) => console.error('tick', e)), 1000));
    this.timers.push(setInterval(() => void this.autosaveAll().catch((e) => console.error('autosave', e)), env.AUTOSAVE_SECONDS * 1000));
  }

  async stop() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    await this.autosaveAll();
  }

  isLoaded(campaignId: string) {
    return this.tables.has(campaignId);
  }

  getState(campaignId: string): TableState | undefined {
    return this.tables.get(campaignId)?.state;
  }

  /** Carrega do último save (manual ou automático) ou cria uma mesa nova. */
  async load(campaignId: string): Promise<LiveTable> {
    const live = this.tables.get(campaignId);
    if (live) return live;
    const pending = this.loading.get(campaignId);
    if (pending) return pending;

    const p = (async () => {
      const campaign = await Campaign.findByPk(campaignId);
      if (!campaign) throw new HttpError(404, 'Campanha não encontrada');
      const save = await SaveGame.findOne({ where: { campaignId }, order: [['createdAt', 'DESC']] });
      const state = save ? migrateTableState(save.state) : createTableState(campaignId, campaign.name, buildPresetMap(PRESET_MAPS[0].key));
      const table: LiveTable = {
        state, dirty: false, lastSavedSeq: state.seq, explorationTick: 0, recentCommands: new Map(), queue: Promise.resolve(),
      };
      this.tables.set(campaignId, table);
      return table;
    })();
    this.loading.set(campaignId, p);
    try {
      return await p;
    } finally {
      this.loading.delete(campaignId);
    }
  }

  /** Serializa operações por mesa (comandos, load, entrada de jogadores). */
  private enqueue<T>(table: LiveTable, fn: () => Promise<T>): Promise<T> {
    const run = table.queue.then(fn, fn);
    table.queue = run.catch(() => undefined);
    return run;
  }

  /** Jogador/Mestre entra: registra presença e garante o token do personagem na mesa. */
  async join(campaignId: string, user: SocketUser) {
    const table = await this.load(campaignId);
    return this.enqueue(table, async () => {
      const state = table.state;
      const campaign = await Campaign.findByPk(campaignId);
      if (!campaign) throw new HttpError(404, 'Campanha não encontrada');

      if (campaign.masterId !== user.userId) {
        const member = await CampaignMember.findOne({ where: { campaignId, userId: user.userId } });
        if (!member || member.status !== 'ativo') throw new HttpError(403, 'Você não participa desta campanha');
        state.players[user.userId] = {
          userId: user.userId,
          username: user.username,
          characterId: member.characterId,
          paused: state.players[user.userId]?.paused ?? false,
          connected: true,
        };
        if (member.characterId) await this.syncCharacterToken(state, member.characterId);
        table.dirty = true;
      }
      return projectStateFor(state, this.actorOf(user, campaign.masterId));
    });
  }

  /** Cria ou atualiza o token a partir da ficha (stats derivados), mantendo posição/condições. */
  private async syncCharacterToken(state: TableState, characterId: string) {
    const data = await CharacterService.snapshot(characterId);
    if (!data) return;
    const existing = state.tokens.find((t) => t.characterId === characterId);
    const index = state.tokens.filter((t) => t.kind === 'personagem').length;
    if (existing) {
      const fresh = tokenFromCharacter(data.snapshot, existing.x, existing.y, index, data.custom);
      const previousMax = existing.maxHp;
      const previousStamina = existing.maxStamina;
      Object.assign(existing, {
        name: fresh.name, maxHp: fresh.maxHp, ac: fresh.ac, speed: fresh.speed, maxStamina: fresh.maxStamina,
        initiativeBonus: fresh.initiativeBonus, abilityMods: fresh.abilityMods, proficiency: fresh.proficiency,
        attacks: fresh.attacks, resistances: fresh.resistances, conditionAdvantage: fresh.conditionAdvantage, power: fresh.power,
        consumables: fresh.consumables, hidden: false, portrait: fresh.portrait, emblem: fresh.emblem,
        skills: fresh.skills, saves: fresh.saves, level: fresh.level, face: fresh.face,
      });
      // Subiu de nível: ganha a diferença de PV/Estamina
      if (fresh.maxHp > previousMax) existing.hp += fresh.maxHp - previousMax;
      if (fresh.maxStamina > previousStamina) existing.stamina += fresh.maxStamina - previousStamina;
      existing.hp = Math.min(existing.hp, existing.maxHp);
      existing.stamina = Math.min(existing.stamina, existing.maxStamina);
      return;
    }
    const preset = PRESET_MAPS.find((p) => p.key === state.map.preset);
    const spawn = preset?.spawns.find((s) => !state.tokens.some((t) => !t.dead && t.x === s.x && t.y === s.y));
    const pos = spawn ?? findFreeCell(state) ?? { x: 0, y: 0 };
    const token = tokenFromCharacter(data.snapshot, pos.x, pos.y, index, data.custom);
    state.tokens.push(token);
    // Entrou no meio do combate: rola iniciativa e entra no fim da fila da rodada
    if (state.combat) {
      const initiative = 1 + Math.floor(Math.random() * 20) + token.initiativeBonus;
      state.combat.order.push({ tokenId: token.id, initiative });
      state.combat.economy[token.id] = { action: 1, bonusAction: 1, reaction: 1, movement: token.speed };
      createContext(state, SYSTEM_ACTOR).log(`⚔️ ${token.name} entra no combate (iniciativa ${initiative}).`, { type: 'combate' });
    }
  }

  /** Atualiza o token de um personagem na mesa ao vivo (ex.: mudou o rosto ou equipamento). */
  async refreshCharacter(campaignId: string, characterId: string) {
    const table = this.tables.get(campaignId);
    if (!table || !table.state.tokens.some((t) => t.characterId === characterId)) return;
    await this.enqueue(table, async () => {
      await this.syncCharacterToken(table.state, characterId);
      table.state.seq += 1;
      table.dirty = true;
      this.broadcast(campaignId);
    });
  }

  actorOf(user: SocketUser, masterId: string): Actor {
    // Papel efetivo na mesa: Mestre apenas na campanha que ele mestra
    return { userId: user.userId, username: user.username, role: user.userId === masterId ? 'MASTER' : 'PLAYER' };
  }

  async setConnected(campaignId: string, userId: string, connected: boolean) {
    const table = this.tables.get(campaignId);
    const p = table?.state.players[userId];
    if (!table || !p) return;
    p.connected = connected;
    this.io?.to(room(campaignId)).emit(EVENTS.PRESENCE, { userId, username: p.username, connected });
  }

  /** Aplica um comando validado. Retorna o novo seq. */
  async execute(campaignId: string, actor: Actor, command: Command, commandId?: string): Promise<number> {
    const table = await this.load(campaignId);
    return this.enqueue(table, async () => {
      if (commandId && table.recentCommands.has(commandId)) return table.recentCommands.get(commandId)!;

      const { state, ctx } = applyCommand(table.state, actor, command);
      table.state = state;
      table.dirty = true;
      if (commandId) {
        table.recentCommands.set(commandId, state.seq);
        if (table.recentCommands.size > 200) table.recentCommands.delete(table.recentCommands.keys().next().value!);
      }
      const extra = await this.applySideEffects(campaignId, ctx.sideEffects);
      const log = [...ctx.newLog, ...extra];
      await this.persistLog(campaignId, log);
      this.broadcast(campaignId, ctx.fx, log);
      return state.seq;
    });
  }

  /** Efeitos que saem do motor para o banco (PV, consumíveis, afinidade, banimento). */
  private async applySideEffects(campaignId: string, effects: SideEffect[]): Promise<LogEntry[]> {
    const extra: LogEntry[] = [];
    for (const e of effects) {
      switch (e.type) {
        case 'reward': {
          const r = await CharacterService.grantReward(e.characterId, e);
          const state = this.tables.get(campaignId)?.state;
          if (!r || !state) break;
          await this.syncCharacterToken(state, e.characterId);
          if (r.level > r.oldLevel) {
            const ctx = createContext(state, SYSTEM_ACTOR);
            ctx.log(`🆙 ${r.name} sobe para o NÍVEL ${r.level}! PV máximo agora é ${r.maxHp}. Abra a ficha para ver as novidades.`, { type: 'recompensa' });
            ctx.emit({ type: 'cura', tokenId: `tok_${e.characterId}`, amount: 0 });
            extra.push(...ctx.newLog);
          }
          break;
        }
        case 'character_hp':
          await CharacterService.setVitals(e.characterId, e.hp, e.stamina);
          break;
        case 'consumable_used':
          await CharacterService.consumeItem(e.characterId, e.itemKey, e.quantity);
          break;
        case 'affinity_changed': {
          const affinity = await CharacterService.adjustAffinity(e.characterId, e.delta);
          const state = this.tables.get(campaignId)?.state;
          if (state && affinity !== null) await this.syncCharacterToken(state, e.characterId);
          break;
        }
        case 'player_banned':
          await CampaignMember.update({ status: 'banido' }, { where: { campaignId, userId: e.userId } });
          await this.kickUser(campaignId, e.userId, 'Você foi banido da mesa pelo Mestre');
          break;
      }
    }
    return extra;
  }

  private async persistLog(campaignId: string, entries: LogEntry[]) {
    if (!entries.length) return;
    await GameEvent.bulkCreate(entries.map((e) => ({
      campaignId, logId: e.id, type: e.type.slice(0, 20), visibility: e.visibility, actorUserId: e.actorUserId && e.actorUserId !== 'system' ? e.actorUserId : null,
      text: e.text, data: e.data ?? null,
    })));
  }

  async kickUser(campaignId: string, userId: string, reason: string) {
    if (!this.io) return;
    const sockets = await this.io.in(room(campaignId)).fetchSockets();
    for (const s of sockets) {
      if ((s.data.user as SocketUser | undefined)?.userId === userId) {
        s.emit(EVENTS.KICKED, { reason });
        s.leave(room(campaignId));
        s.disconnect(true);
      }
    }
  }

  /** Envia a cada socket a projeção do estado que ele pode ver (informação oculta fica no servidor). */
  broadcast(campaignId: string, fx: Fx[] = [], newLog: LogEntry[] = []) {
    const table = this.tables.get(campaignId);
    if (!this.io || !table) return;
    const masterId = this.masterIdCache.get(campaignId);
    void (async () => {
      const mId = masterId ?? (await Campaign.findByPk(campaignId))?.masterId ?? '';
      this.masterIdCache.set(campaignId, mId);
      const sockets = await this.io!.in(room(campaignId)).fetchSockets();
      const cache = new Map<string, ReturnType<typeof projectStateFor>>();
      for (const s of sockets) {
        const user = s.data.user as SocketUser | undefined;
        if (!user) continue;
        const actor = this.actorOf(user, mId);
        const key = actor.role === 'MASTER' ? '__master__' : actor.userId;
        let view = cache.get(key);
        if (!view) {
          view = projectStateFor(table.state, actor);
          cache.set(key, view);
        }
        s.emit(EVENTS.STATE, { seq: table.state.seq, state: view });
        if (fx.length || newLog.length) {
          const visibleFx = fx.filter((f) => f.type !== 'dado' || f.visibility === 'publico' || actor.role === 'MASTER');
          s.emit(EVENTS.FX, { seq: table.state.seq, fx: visibleFx, log: newLog.filter((l) => canSeeLog(l, actor)) });
        }
      }
    })().catch((e) => console.error('broadcast', e));
  }

  private masterIdCache = new Map<string, string>();

  projectFor(campaignId: string, user: SocketUser, masterId: string) {
    const table = this.tables.get(campaignId);
    if (!table) return null;
    return { seq: table.state.seq, state: projectStateFor(table.state, this.actorOf(user, masterId)) };
  }

  // ───────────── Save / Load ─────────────

  async save(campaignId: string, name: string, kind: 'manual' | 'auto', userId: string | null) {
    const table = await this.load(campaignId);
    const snapshot: TableState = structuredClone(table.state);
    const row = await SaveGame.create({
      campaignId, name: name.slice(0, 80), kind, schemaVersion: TABLE_SCHEMA_VERSION, seq: snapshot.seq, state: snapshot, createdBy: userId,
    });
    table.lastSavedSeq = snapshot.seq;
    table.dirty = false;
    if (kind === 'auto') await this.pruneAutosaves(campaignId);
    return row;
  }

  private async pruneAutosaves(campaignId: string) {
    const autos = await SaveGame.findAll({ where: { campaignId, kind: 'auto' }, order: [['createdAt', 'DESC']], attributes: ['id'] });
    const old = autos.slice(env.AUTOSAVE_KEEP).map((s) => s.id);
    if (old.length) await SaveGame.destroy({ where: { id: { [Op.in]: old } }, force: true });
  }

  /** Restaura um save exatamente de onde parou (posições, PV de monstros, turnos, histórico). */
  async restore(campaignId: string, saveId: string) {
    const save = await SaveGame.findOne({ where: { id: saveId, campaignId } });
    if (!save) throw new HttpError(404, 'Save não encontrado');
    const table = await this.load(campaignId);
    return this.enqueue(table, async () => {
      const restored = migrateTableState(structuredClone(save.state));
      // Presença atual vale mais que a do save
      const current = table.state.players;
      for (const [uid, p] of Object.entries(restored.players)) p.connected = current[uid]?.connected ?? false;
      restored.seq = Math.max(table.state.seq, restored.seq) + 1;
      const ctx = createContext(restored, SYSTEM_ACTOR);
      ctx.log(`💾 Mesa restaurada do save "${save.name}"`, { type: 'sistema' });
      table.state = restored;
      table.dirty = true;
      await this.persistLog(campaignId, ctx.newLog);
      this.broadcast(campaignId, [], ctx.newLog);
      return restored;
    });
  }

  async autosaveAll() {
    for (const [campaignId, table] of this.tables) {
      if (table.dirty && table.state.seq !== table.lastSavedSeq) {
        await this.save(campaignId, `Autosave ${new Date().toLocaleString('pt-BR')}`, 'auto', null).catch((e) => console.error('autosave', e));
      }
    }
  }

  /** Relógio do servidor: quests com contagem regressiva e superfícies fora de combate. */
  private async tick() {
    const now = Date.now();
    for (const [campaignId, table] of this.tables) {
      const hasTimers = table.state.sideQuests.some((q) => q.status === 'ativa' && q.expiresAt !== null);
      table.explorationTick += 1;
      const decay = !table.state.combat && table.explorationTick % 6 === 0 && table.state.map.tiles.some((t) => t.s);
      if (!hasTimers && !decay) continue;
      await this.enqueue(table, async () => {
        const draft = structuredClone(table.state);
        const ctx = createContext(draft, SYSTEM_ACTOR, Math.random, now);
        const questChanged = tickQuestsByTime(ctx);
        if (decay) decaySurfaces(ctx);
        if (!questChanged && !decay) return;
        draft.seq += 1;
        table.state = draft;
        table.dirty = true;
        await this.persistLog(campaignId, ctx.newLog);
        this.broadcast(campaignId, ctx.fx, ctx.newLog);
      });
    }
  }

  /** Usado pelos testes e ao encerrar: descarrega uma mesa da memória. */
  unload(campaignId: string) {
    this.tables.delete(campaignId);
    this.masterIdCache.delete(campaignId);
  }

  /** Descarta todas as mesas em memória (sem salvar). Usado pelos testes. */
  clear() {
    this.tables.clear();
    this.masterIdCache.clear();
  }
}

export function commandErrorMessage(err: unknown): { error: string; code?: string } {
  if (err instanceof CommandError) return { error: err.message, code: err.code };
  if (err instanceof HttpError) return { error: err.message, code: String(err.status) };
  console.error('Erro ao executar comando:', err);
  return { error: 'Erro interno ao executar o comando' };
}

export type TableSocket = Socket;
export const tableManager = new TableManager();
