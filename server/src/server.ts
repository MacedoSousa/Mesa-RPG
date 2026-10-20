import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import { networkInterfaces } from 'os';
import { closeDatabase, connectDatabase } from './config/database';
import { corsOrigins, env } from './config/env';
import { errorHandler, notFound } from './middlewares/errorHandler';
import { routes } from './routes';
import { initSockets } from './sockets';

const app = express();

app.use(helmet());
app.use(cors({ origin: corsOrigins, credentials: corsOrigins !== '*' }));
app.use(express.json({ limit: '1mb' }));

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

const httpServer = createServer(app);
const io = initSockets(httpServer);

/** IPs da rede local — é o endereço que os celulares dos jogadores devem usar. */
function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((n): n is NonNullable<typeof n> => !!n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

async function bootstrap() {
  await connectDatabase();

  // 0.0.0.0 para aceitar conexões de outros dispositivos na mesma rede
  httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.log(`⚡ Mesa RPG server rodando na porta ${env.PORT}`);
    console.log(`   Local:  http://localhost:${env.PORT}/api/health`);
    for (const ip of lanAddresses()) console.log(`   Rede:   http://${ip}:${env.PORT}`);
  });
}

async function shutdown(signal: string) {
  console.log(`\n${signal} recebido, encerrando...`);
  io.close();
  httpServer.close();
  await closeDatabase();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

bootstrap().catch((err) => {
  console.error('❌ Falha ao iniciar o servidor:', err);
  process.exit(1);
});
