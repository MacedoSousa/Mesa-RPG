import { z } from 'zod';
import { Op } from 'sequelize';
import { PRESET_MAPS, buildPresetMap, canSeeLog, createBlankMap, mapSchema, type Actor, type LogEntry } from '@mesa/shared';
import { sequelize } from '../config/database';
import { Campaign, CampaignMember, Character, GameEvent, GameMap, SaveGame, User } from '../models';
import { HttpError, forbidden } from '../utils/HttpError';
import { randomCode } from '../utils/security';

export const campaignSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().max(2000).default(''),
});

export const joinSchema = z.object({
  code: z.string().trim().toUpperCase().min(4).max(8),
  characterId: z.string().uuid('Escolha um personagem'),
});

export const createMapSchema = z.union([
  z.object({ preset: z.string(), name: z.string().max(80).optional() }),
  z.object({ blank: z.object({ width: z.number().int().min(4).max(64), height: z.number().int().min(4).max(64), terrain: z.string().default('grama') }), name: z.string().min(1).max(80) }),
  z.object({ map: mapSchema }),
]);

export const CampaignService = {
  async create(masterId: string, input: unknown) {
    const data = campaignSchema.parse(input);
    for (let i = 0; i < 5; i++) {
      const joinCode = randomCode(6);
      const clash = await Campaign.findOne({ where: { joinCode } });
      if (!clash) return Campaign.create({ masterId, name: data.name, description: data.description, joinCode });
    }
    throw new HttpError(500, 'Não foi possível gerar um código de convite');
  },

  /**
   * Campanhas que o usuário mestra (com código de convite) e as que ele joga.
   * O papel é POR CAMPANHA: um Mestre pode ser jogador na aventura de outra pessoa.
   */
  async listFor(actor: Actor, includeDeleted = false) {
    const owned = actor.role === 'MASTER'
      ? await Campaign.findAll({ where: { masterId: actor.userId }, paranoid: !includeDeleted, order: [['createdAt', 'DESC']] })
      : [];
    const memberships = await CampaignMember.findAll({ where: { userId: actor.userId, status: 'ativo' } });
    const joined = memberships.length
      ? await Campaign.findAll({ where: { id: memberships.map((m) => m.campaignId) }, order: [['createdAt', 'DESC']] })
      : [];
    return [
      ...owned.map((c) => ({ ...c.toJSON(), isMaster: true })),
      ...joined
        .filter((c) => c.masterId !== actor.userId)
        .map((c) => ({ id: c.id, name: c.name, description: c.description, createdAt: c.createdAt, deletedAt: null, isMaster: false })),
    ];
  },

  /** Garante acesso: Mestre dono ou jogador membro ativo (não banido). */
  async access(campaignId: string, actor: Actor) {
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) throw new HttpError(404, 'Campanha não encontrada');
    if (campaign.masterId === actor.userId) return { campaign, isMaster: true, member: null };
    const member = await CampaignMember.findOne({ where: { campaignId, userId: actor.userId } });
    if (!member) throw forbidden('Você não participa desta campanha');
    if (member.status === 'banido') throw forbidden('Você foi banido desta campanha');
    return { campaign, isMaster: false, member };
  },

  async requireMaster(campaignId: string, actor: Actor) {
    const r = await this.access(campaignId, actor);
    if (!r.isMaster) throw forbidden('Apenas o Mestre desta campanha pode fazer isso');
    return r.campaign;
  },

  async update(campaignId: string, actor: Actor, input: unknown) {
    const campaign = await this.requireMaster(campaignId, actor);
    const data = campaignSchema.partial().parse(input);
    return campaign.update(data);
  },

  async softDelete(campaignId: string, actor: Actor) {
    const campaign = await this.requireMaster(campaignId, actor);
    await sequelize.transaction(async (transaction) => {
      await GameMap.destroy({ where: { campaignId }, transaction });
      await campaign.destroy({ transaction });
    });
  },

  async restore(campaignId: string, actor: Actor) {
    const campaign = await Campaign.findOne({ where: { id: campaignId, masterId: actor.userId }, paranoid: false });
    if (!campaign || !campaign.deletedAt) throw new HttpError(404, 'Campanha não encontrada na lixeira');
    await sequelize.transaction(async (transaction) => {
      await campaign.restore({ transaction });
      await GameMap.restore({ where: { campaignId }, transaction });
    });
    return campaign;
  },

  async join(userId: string, input: unknown) {
    const { code, characterId } = joinSchema.parse(input);
    const campaign = await Campaign.findOne({ where: { joinCode: code } });
    if (!campaign) throw new HttpError(404, 'Código de campanha inválido');
    if (campaign.masterId === userId) throw new HttpError(400, 'Você é o Mestre desta campanha');
    const character = await Character.findOne({ where: { id: characterId, userId } });
    if (!character) throw new HttpError(404, 'Personagem não encontrado');

    const existing = await CampaignMember.findOne({ where: { campaignId: campaign.id, userId } });
    if (existing?.status === 'banido') throw forbidden('Você foi banido desta campanha');
    await sequelize.transaction(async (transaction) => {
      if (existing) await existing.update({ characterId }, { transaction });
      else await CampaignMember.create({ campaignId: campaign.id, userId, characterId }, { transaction });
      await character.update({ campaignId: campaign.id }, { transaction });
    });
    return campaign;
  },

  async members(campaignId: string, actor: Actor) {
    await this.access(campaignId, actor);
    const rows = await CampaignMember.findAll({ where: { campaignId }, include: [{ model: User, as: 'user' }], order: [['createdAt', 'ASC']] });
    const chars = await Character.findAll({ where: { id: rows.map((r) => r.characterId).filter(Boolean) as string[] } });
    return rows
      .filter((r) => r.user)
      .map((r) => ({
        userId: r.userId,
        username: r.user!.username,
        displayName: r.user!.displayName,
        status: r.status,
        characterId: r.characterId,
        characterName: chars.find((c) => c.id === r.characterId)?.name ?? null,
      }));
  },

  async setMemberStatus(campaignId: string, actor: Actor, userId: string, status: 'ativo' | 'banido') {
    await this.requireMaster(campaignId, actor);
    const member = await CampaignMember.findOne({ where: { campaignId, userId } });
    if (!member) throw new HttpError(404, 'Jogador não participa da campanha');
    await member.update({ status });
    return member;
  },

  // ───────────── Mapas ─────────────

  async listMaps(campaignId: string, actor: Actor) {
    await this.requireMaster(campaignId, actor);
    const maps = await GameMap.findAll({ where: { campaignId }, order: [['updatedAt', 'DESC']], attributes: { exclude: ['tiles'] } });
    return {
      presets: PRESET_MAPS.map((p) => ({ key: p.key, name: p.name, description: p.description })),
      maps,
    };
  },

  async getMap(campaignId: string, actor: Actor, mapId: string) {
    await this.requireMaster(campaignId, actor);
    const m = await GameMap.findOne({ where: { id: mapId, campaignId } });
    if (!m) throw new HttpError(404, 'Mapa não encontrado');
    return { id: m.id, name: m.name, preset: m.preset, width: m.width, height: m.height, tiles: m.tiles };
  },

  async createMap(campaignId: string, actor: Actor, input: unknown) {
    await this.requireMaster(campaignId, actor);
    const data = createMapSchema.parse(input);
    let map;
    if ('preset' in data) {
      map = buildPresetMap(data.preset);
      if (data.name) map.name = data.name;
    } else if ('blank' in data) {
      map = createBlankMap(data.blank.width, data.blank.height, data.blank.terrain as never, data.name);
    } else {
      map = data.map;
    }
    const row = await GameMap.create({
      campaignId, name: map.name, preset: map.preset ?? null, width: map.width, height: map.height, tiles: map.tiles, createdBy: actor.userId,
    });
    return { ...map, id: row.id };
  },

  async saveMap(campaignId: string, actor: Actor, mapId: string, input: unknown) {
    await this.requireMaster(campaignId, actor);
    const map = mapSchema.parse(input);
    const row = await GameMap.findOne({ where: { id: mapId, campaignId } });
    if (!row) throw new HttpError(404, 'Mapa não encontrado');
    await row.update({ name: map.name, width: map.width, height: map.height, tiles: map.tiles });
    return { ...map, id: row.id };
  },

  async deleteMap(campaignId: string, actor: Actor, mapId: string) {
    await this.requireMaster(campaignId, actor);
    const n = await GameMap.destroy({ where: { id: mapId, campaignId } });
    if (!n) throw new HttpError(404, 'Mapa não encontrado');
  },

  // ───────────── Saves e histórico ─────────────

  async listSaves(campaignId: string, actor: Actor) {
    await this.requireMaster(campaignId, actor);
    return SaveGame.findAll({
      where: { campaignId }, order: [['createdAt', 'DESC']], attributes: ['id', 'name', 'kind', 'schemaVersion', 'seq', 'createdAt'],
    });
  },

  async deleteSave(campaignId: string, actor: Actor, saveId: string) {
    await this.requireMaster(campaignId, actor);
    const n = await SaveGame.destroy({ where: { id: saveId, campaignId } });
    if (!n) throw new HttpError(404, 'Save não encontrado');
  },

  /** Histórico de turnos/eventos com o mesmo filtro de visibilidade do log ao vivo. */
  async history(campaignId: string, actor: Actor, beforeId?: number, limit = 50) {
    const { isMaster } = await this.access(campaignId, actor);
    const where: Record<string | symbol, unknown> = { campaignId };
    if (beforeId) where.id = { [Op.lt]: beforeId };
    if (!isMaster) {
      where[Op.or as unknown as string] = [{ visibility: 'publico' }, { visibility: 'privado', actorUserId: actor.userId }];
    }
    const rows = await GameEvent.findAll({ where, order: [['id', 'DESC']], limit: Math.min(200, limit) });
    const viewer: Actor = isMaster ? { ...actor, role: 'MASTER' } : actor;
    return rows
      .map((r) => ({ id: Number(r.id), logId: r.logId, at: r.createdAt, type: r.type, text: r.text, visibility: r.visibility, actorUserId: r.actorUserId }))
      .filter((e) => canSeeLog({ ...e, id: e.logId, at: 0 } as unknown as LogEntry, viewer));
  },
};
