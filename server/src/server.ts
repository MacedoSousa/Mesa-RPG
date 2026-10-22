import { createServer } from 'http';
import { closeDatabase, connectDatabase } from './config/database';
import { env } from './config/env';
import { lanAddresses } from './controllers/campaignController';
import { migrator } from './database/migrator';
import { seedItems } from './database/seed';
import { tableManager } from './game/TableManager';
import { createApp } from './app';
import { createSocketServer } from './sockets';
import { artService } from './services/artService';
import { logSystemCheck } from './services/healthService';
import { EVENTS } from '@mesa/shared';

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
  artService.setNotifier(() => io.emit(EVENTS.ART));

  httpServer.listen(env.PORT, '0.0.0.0', () => {
    console.log(`\n⚡ Mesa RPG rodando na porta ${env.PORT}`);
    console.log(`   Mestre (Host): http://localhost:${env.PORT}/host`);
    for (const ip of lanAddresses()) console.log(`   Jogadores:     http://${ip}:${env.PORT}`);
    console.log(env.MASTER_INVITE_CODE
      ? `   Código de Mestre (para outra conta virar Mestre): ${env.MASTER_INVITE_CODE}`
      : '   Código de Mestre: não definido (MASTER_INVITE_CODE no server/.env)');
    console.log('');
    void logSystemCheck().catch((e) => console.error('checagem', e));
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
