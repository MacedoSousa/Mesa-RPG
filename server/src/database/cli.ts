import { closeDatabase } from '../config/database';
import { migrator } from './migrator';
import { seedItems } from './seed';

async function main() {
  const cmd = process.argv[2] ?? 'up';
  if (cmd === 'up') {
    const applied = await migrator.up();
    console.log(applied.length ? `✅ ${applied.length} migração(ões) aplicada(s).` : '✅ Banco já está atualizado.');
    console.log(`🌱 Catálogo de itens: ${await seedItems()} itens sincronizados.`);
  } else if (cmd === 'down') {
    const reverted = await migrator.down();
    console.log(`↩️ ${reverted.length} migração(ões) revertida(s).`);
  } else if (cmd === 'seed') {
    console.log(`🌱 Catálogo de itens: ${await seedItems()} itens sincronizados.`);
  } else {
    console.error(`Comando desconhecido: ${cmd} (use up | down | seed)`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('❌ Falha:', err);
    process.exitCode = 1;
  })
  .finally(() => closeDatabase());
