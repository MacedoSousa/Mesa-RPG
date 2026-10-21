import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { CampaignController, HostController } from '../controllers/campaignController';
import { CharacterController, RulesController } from '../controllers/characterController';
import { rateLimit, requireAuth, requireRole } from '../middlewares/auth';

export function buildRoutes(opts: { authRateLimit?: boolean } = {}) {
  const r = Router();
  const authLimit = opts.authRateLimit === false ? [] : [rateLimit({ windowMs: 60_000, max: 20 })];

  r.get('/health', (_req, res) => res.json({ status: 'ok', service: 'mesa-rpg', time: new Date().toISOString() }));
  r.get('/rules', RulesController.catalog);
  r.get('/rules/maps/:key', RulesController.presetMap);

  // Autenticação
  r.post('/auth/register', ...authLimit, AuthController.register);
  r.post('/auth/login', ...authLimit, AuthController.login);
  r.post('/auth/refresh', AuthController.refresh);
  r.post('/auth/logout', AuthController.logout);
  r.post('/auth/logout-all', requireAuth, AuthController.logoutEverywhere);
  r.get('/auth/me', requireAuth, AuthController.me);
  r.delete('/auth/me', requireAuth, AuthController.deleteMe);

  // Personagens e fichas
  r.get('/characters', requireAuth, CharacterController.list);
  r.post('/characters/preview', requireAuth, CharacterController.preview);
  r.post('/characters', requireAuth, CharacterController.create);
  r.get('/characters/:id', requireAuth, CharacterController.get);
  r.patch('/characters/:id', requireAuth, CharacterController.update);
  r.post('/characters/:id/equip', requireAuth, CharacterController.equip);
  r.delete('/characters/:id', requireAuth, CharacterController.remove);
  r.post('/characters/:id/restore', requireAuth, CharacterController.restore);

  // Campanhas
  r.get('/campaigns', requireAuth, CampaignController.list);
  r.post('/campaigns', requireAuth, requireRole('MASTER'), CampaignController.create);
  r.post('/campaigns/join', requireAuth, CampaignController.join);
  r.get('/campaigns/:id', requireAuth, CampaignController.get);
  r.patch('/campaigns/:id', requireAuth, CampaignController.update);
  r.delete('/campaigns/:id', requireAuth, CampaignController.remove);
  r.post('/campaigns/:id/restore', requireAuth, requireRole('MASTER'), CampaignController.restore);
  r.get('/campaigns/:id/members', requireAuth, CampaignController.members);
  r.post('/campaigns/:id/members/:userId/ban', requireAuth, CampaignController.ban);
  r.post('/campaigns/:id/members/:userId/unban', requireAuth, CampaignController.unban);
  r.get('/campaigns/:id/history', requireAuth, CampaignController.history);

  // Mapas da campanha
  r.get('/campaigns/:id/maps', requireAuth, CampaignController.listMaps);
  r.post('/campaigns/:id/maps', requireAuth, CampaignController.createMap);
  r.get('/campaigns/:id/maps/:mapId', requireAuth, CampaignController.getMap);
  r.put('/campaigns/:id/maps/:mapId', requireAuth, CampaignController.saveMap);
  r.delete('/campaigns/:id/maps/:mapId', requireAuth, CampaignController.deleteMap);

  // Save / Load
  r.get('/campaigns/:id/saves', requireAuth, CampaignController.listSaves);
  r.post('/campaigns/:id/saves', requireAuth, CampaignController.createSave);
  r.post('/campaigns/:id/saves/:saveId/load', requireAuth, CampaignController.loadSave);
  r.delete('/campaigns/:id/saves/:saveId', requireAuth, CampaignController.deleteSave);

  // Itens (catálogo + personalizados)
  r.get('/campaigns/:id/items', requireAuth, CampaignController.listItems);
  r.post('/campaigns/:id/items', requireAuth, CampaignController.createItem);
  r.delete('/campaigns/:id/items/:itemId', requireAuth, CampaignController.deleteItem);

  // Host
  r.get('/host/info', requireAuth, requireRole('MASTER'), HostController.info);

  return r;
}
