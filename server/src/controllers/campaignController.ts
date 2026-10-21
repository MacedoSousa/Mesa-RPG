import type { Request, Response } from 'express';
import { networkInterfaces } from 'os';
import { z } from 'zod';
import { env } from '../config/env';
import { tableManager } from '../game/TableManager';
import { CampaignService } from '../services/campaignService';
import { ItemService } from '../services/itemService';

const p = (req: Request, key: string) => z.string().uuid('ID inválido').parse(req.params[key]);
const saveSchema = z.object({ name: z.string().trim().min(1).max(80).default('Save manual') });

export const CampaignController = {
  async list(req: Request, res: Response) {
    res.json({ campaigns: await CampaignService.listFor(req.actor!, req.query.includeDeleted === 'true') });
  },
  async create(req: Request, res: Response) {
    res.status(201).json({ campaign: await CampaignService.create(req.actor!.userId, req.body) });
  },
  async get(req: Request, res: Response) {
    const { campaign, isMaster } = await CampaignService.access(p(req, 'id'), req.actor!);
    res.json({ campaign: isMaster ? campaign : { id: campaign.id, name: campaign.name, description: campaign.description }, isMaster });
  },
  async update(req: Request, res: Response) {
    res.json({ campaign: await CampaignService.update(p(req, 'id'), req.actor!, req.body) });
  },
  async remove(req: Request, res: Response) {
    const id = p(req, 'id');
    await CampaignService.softDelete(id, req.actor!);
    tableManager.unload(id);
    res.status(204).send();
  },
  async restore(req: Request, res: Response) {
    res.json({ campaign: await CampaignService.restore(p(req, 'id'), req.actor!) });
  },
  async join(req: Request, res: Response) {
    const campaign = await CampaignService.join(req.actor!.userId, req.body);
    res.json({ campaign: { id: campaign.id, name: campaign.name, description: campaign.description } });
  },
  async members(req: Request, res: Response) {
    res.json({ members: await CampaignService.members(p(req, 'id'), req.actor!) });
  },
  async ban(req: Request, res: Response) {
    const id = p(req, 'id');
    const userId = p(req, 'userId');
    await CampaignService.setMemberStatus(id, req.actor!, userId, 'banido');
    await tableManager.kickUser(id, userId, 'Você foi banido da mesa pelo Mestre');
    res.status(204).send();
  },
  async unban(req: Request, res: Response) {
    await CampaignService.setMemberStatus(p(req, 'id'), req.actor!, p(req, 'userId'), 'ativo');
    res.status(204).send();
  },

  // Mapas
  async listMaps(req: Request, res: Response) {
    res.json(await CampaignService.listMaps(p(req, 'id'), req.actor!));
  },
  async getMap(req: Request, res: Response) {
    res.json({ map: await CampaignService.getMap(p(req, 'id'), req.actor!, p(req, 'mapId')) });
  },
  async createMap(req: Request, res: Response) {
    res.status(201).json({ map: await CampaignService.createMap(p(req, 'id'), req.actor!, req.body) });
  },
  async saveMap(req: Request, res: Response) {
    res.json({ map: await CampaignService.saveMap(p(req, 'id'), req.actor!, p(req, 'mapId'), req.body) });
  },
  async deleteMap(req: Request, res: Response) {
    await CampaignService.deleteMap(p(req, 'id'), req.actor!, p(req, 'mapId'));
    res.status(204).send();
  },

  // Save / Load
  async listSaves(req: Request, res: Response) {
    res.json({ saves: await CampaignService.listSaves(p(req, 'id'), req.actor!) });
  },
  async createSave(req: Request, res: Response) {
    const id = p(req, 'id');
    await CampaignService.requireMaster(id, req.actor!);
    const { name } = saveSchema.parse(req.body ?? {});
    const save = await tableManager.save(id, name, 'manual', req.actor!.userId);
    res.status(201).json({ save: { id: save.id, name: save.name, kind: save.kind, seq: save.seq, createdAt: save.createdAt } });
  },
  async loadSave(req: Request, res: Response) {
    const id = p(req, 'id');
    await CampaignService.requireMaster(id, req.actor!);
    const state = await tableManager.restore(id, p(req, 'saveId'));
    res.json({ ok: true, seq: state.seq });
  },
  async deleteSave(req: Request, res: Response) {
    await CampaignService.deleteSave(p(req, 'id'), req.actor!, p(req, 'saveId'));
    res.status(204).send();
  },

  // Histórico e itens
  async history(req: Request, res: Response) {
    const before = req.query.before ? Number(req.query.before) : undefined;
    res.json({ events: await CampaignService.history(p(req, 'id'), req.actor!, before) });
  },
  async listItems(req: Request, res: Response) {
    const id = p(req, 'id');
    await CampaignService.access(id, req.actor!);
    res.json({ items: await ItemService.list(id) });
  },
  async createItem(req: Request, res: Response) {
    const id = p(req, 'id');
    await CampaignService.requireMaster(id, req.actor!);
    const item = await ItemService.createCustom(id, req.body);
    res.status(201).json({ item: { ...item.definition, id: item.id, isCustom: true } });
  },
  async deleteItem(req: Request, res: Response) {
    const id = p(req, 'id');
    await CampaignService.requireMaster(id, req.actor!);
    await ItemService.softDelete(id, p(req, 'itemId'));
    res.status(204).send();
  },
};

/** Endereços da rede local para o Mestre compartilhar (QR code no HUD). */
export function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n): n is NonNullable<typeof n> => !!n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

export const HostController = {
  info(_req: Request, res: Response) {
    res.json({ port: env.PORT, lanUrls: lanAddresses().map((ip) => `http://${ip}:${env.PORT}`) });
  },
};
