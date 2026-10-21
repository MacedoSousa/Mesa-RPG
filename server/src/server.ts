import { createServer } from 'http';
import { closeDatabase, connectDatabase } from './config/database';
import { env } from './config/env';
import { lanAddresses } from './controllers/campaignController';
import { migrator } from './database/migrator';
import { seedItems } from './database/seed';
import { tableManager } from './game/TableManager';
import { createApp } from './app';
import { createSocketServer } from './sockets';

async function bootstrap() {
  await connectDatabase();
  const pending = await migrator.pending();
  if (pending.length) {
    console.log(`🧱 Aplicando ${pending.length} migração(ões) pendente(s)...`);
    await migrator.up();
  }
  await seedItems();

  const app = createApp();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer, tableManager);
  tableManager.start();

  httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.log(`\n⚡ Mesa RPG rodando na porta ${env.PORT}`);
    console.log(`   Mestre (Host): http://localhost:${env.PORT}/host`);
    for (const ip of lanAddresses()) console.log(`   Jogadores:     http://${ip}:${env.PORT}`);
    console.log('');
  });

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    console.log(`\n${signal} recebido — salvando mesas e encerrando...`);
    await tableManager.stop();
    io.close();
    httpServer.close();
    await closeDatabase();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('❌ Falha ao iniciar o servidor:', err);
  process.exit(1);
});
