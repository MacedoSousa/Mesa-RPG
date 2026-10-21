/**
 * Gera a arte dos monstros pelo terminal, sem abrir o Host.
 *   npm run art -w server                 → só os monstros que ainda não têm arte
 *   npm run art -w server -- --todos      → todos (substitui os atuais)
 *   npm run art -w server -- harpia cerbero
 */
import { MONSTERS } from '@mesa/shared';
import { artService } from '../services/artService';

async function main() {
  const args = process.argv.slice(2);
  const status = await artService.status();
  if (!status.ok) {
    console.error(`❌ ${status.error}\n   Abra o ComfyUI primeiro (veja docs/ARTE_COM_IA.md).`);
    process.exit(1);
  }
  console.log(`🎨 ComfyUI ok em ${status.url}${status.gpu ? ` · ${status.gpu}` : ''} · modelos: ${status.checkpoints.join(', ') || '(workflow próprio)'}`);
  const existing = artService.list();
  const keys = args.filter((a) => !a.startsWith('--'));
  const targets = keys.length ? keys : Object.keys(MONSTERS).filter((k) => args.includes('--todos') || !existing[k]);
  if (!targets.length) return console.log('✅ Todos os monstros já têm arte. Use --todos para refazer.');
  for (const key of targets) {
    const started = Date.now();
    process.stdout.write(`   ${MONSTERS[key]?.label ?? key}… `);
    const job = artService.generate(key);
    await artService.idle();
    console.log(job.status === 'pronto' ? `✅ ${((Date.now() - started) / 1000).toFixed(0)} s` : `❌ ${job.error}`);
  }
  console.log('Pronto! As imagens ficam em server/data/art/monsters e aparecem nos tokens.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
