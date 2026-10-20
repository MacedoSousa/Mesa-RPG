import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { CharacterController, RulesController } from '../controllers/characterController';
import { requireAuth } from '../middlewares/auth';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mesa-rpg-server', time: new Date().toISOString() });
});

// Regras / catálogo
routes.get('/rules', RulesController.catalog);

// Autenticação
routes.post('/auth/register', AuthController.register);
routes.post('/auth/login', AuthController.login);
routes.get('/auth/me', requireAuth, AuthController.me);
routes.delete('/auth/me', requireAuth, AuthController.deleteMe);

// Personagens (fichas)
routes.get('/characters', requireAuth, CharacterController.list);
routes.post('/characters', requireAuth, CharacterController.create);
routes.get('/characters/:id', requireAuth, CharacterController.get);
routes.patch('/characters/:id', requireAuth, CharacterController.update);
routes.delete('/characters/:id', requireAuth, CharacterController.remove);
routes.post('/characters/:id/restore', requireAuth, CharacterController.restore);
