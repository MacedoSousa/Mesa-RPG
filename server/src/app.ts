import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { existsSync } from 'fs';
import path from 'path';
import { corsOrigins } from './config/env';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { buildRoutes } from './routes';
import { ART_DIR } from './services/artService';

const CLIENT_WEB = path.resolve(__dirname, '../../client-web/dist');
const CLIENT_HOST = path.resolve(__dirname, '../../client-host/dist');

export function createApp(opts: { authRateLimit?: boolean; serveClients?: boolean } = {}): Express {
  const app = express();
  app.set('trust proxy', 'loopback');

  app.use(
    helmet({
      // Rede local em HTTP: sem HSTS/upgrade-insecure-requests, que quebrariam o acesso pelo IP
      contentSecurityPolicy: false,
      strictTransportSecurity: false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '5mb' }));
  app.use(cookieParser());

  app.use('/api', buildRoutes({ authRateLimit: opts.authRateLimit }));
  app.use('/api', notFound);
  // Arte pintada dos monstros (pública na rede local: aparece nos tokens de todos)
  app.use('/art', express.static(ART_DIR, { maxAge: '7d', fallthrough: false }));

  // O próprio Host entrega os clientes (mesma origem: sem CORS e cookies simples)
  if (opts.serveClients !== false) {
    if (existsSync(CLIENT_HOST)) {
      app.use('/host', express.static(CLIENT_HOST, { index: 'index.html' }));
      app.get('/host/{*splat}', (_req, res) => res.sendFile(path.join(CLIENT_HOST, 'index.html')));
    }
    if (existsSync(CLIENT_WEB)) {
      app.use(express.static(CLIENT_WEB, { index: 'index.html' }));
      app.get('/{*splat}', (req, res, next) => (req.path.startsWith('/socket.io') ? next() : res.sendFile(path.join(CLIENT_WEB, 'index.html'))));
    }
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
