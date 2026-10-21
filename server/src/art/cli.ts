/**
 * Gera a arte dos monstros pelo terminal, sem abrir o Host.
 *   npm run art                                   → só os monstros que ainda não têm arte
 *   npm run art -- --todos                        → todos (substitui os atuais)
 *   npm run art -- harpia cerbero                 → só esses
 *   npm run art -- --estilo=sombrio --modelo=Juggernaut --qualidade=caprichada
 *   npm run art -- --todos --misturar             → cada monstro num estilo diferente
 *   npm run art -- --estilos                      → lista estilos e modelos instalados
 */
import { MONSTERS } from '@mesa/shared';
import { ART_STYLE_KEYS, ART_STYLES } from './prompts';
import { artService, profileFor, type Quality } from '../services/artService';

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

async function main() {
  const args = process.argv.slice(2);
  const status = await artService.status();
  if (!status.ok) {
    console.error(`❌ ${status.error}\n   Abra o ComfyUI primeiro (veja docs/ARTE_COM_IA.md).`);
    process.exit(1);
  }
  console.log(`🎨 ComfyUI ok em ${status.url}${status.gpu ? ` · ${status.gpu}` : ''}`);
  if (args.includes('--estilos')) {
    console.log('\nModelos instalados:');
    for (const c of status.checkpoints) console.log(`   ${c}  (${profileFor(c).family})`);
    console.log('\nLoRAs:', (status.loras ?? []).join(', ') || 'nenhuma');
    console.log('\nEstilos (--estilo=):');
    for (const k of ART_STYLE_KEYS) console.log(`   ${k.padEnd(11)} ${ART_STYLES[k].label}${ART_STYLES[k].bestWith ? `  · melhor com ${ART_STYLES[k].bestWith}` : ''}`);
    return;
  }
  const wantedModel = opt('modelo');
  const checkpoint = wantedModel ? status.checkpoints.find((c) => c.toLowerCase().includes(wantedModel.toLowerCase())) : undefined;
  if (wantedModel && !checkpoint) {
    console.error(`❌ Modelo "${wantedModel}" não encontrado. Instalados: ${status.checkpoints.join(', ')}`);
    process.exit(1);
  }
  const style = opt('estilo') ?? 'epico';
  if (!ART_STYLES[style]) {
    console.error(`❌ Estilo "${style}" não existe. Use: ${ART_STYLE_KEYS.join(', ')}`);
    process.exit(1);
  }
  const quality = (opt('qualidade') ?? 'boa') as Quality;
  const mix = args.includes('--misturar');
  console.log(`   modelo: ${checkpoint ?? '(automático)'} · estilo: ${mix ? 'misturado' : ART_STYLES[style].label} · qualidade: ${quality}`);
  const existing = artService.list();
  const keys = args.filter((a) => !a.startsWith('--'));
  const targets = keys.length ? keys : Object.keys(MONSTERS).filter((k) => args.includes('--todos') || !existing[k]);
  if (!targets.length) return console.log('✅ Todos os monstros já têm arte. Use --todos para refazer.');
  for (const key of targets) {
    const started = Date.now();
    const st = mix ? ART_STYLE_KEYS[Math.floor(Math.random() * ART_STYLE_KEYS.length)] : style;
    process.stdout.write(`   ${MONSTERS[key]?.label ?? key}${mix ? ` [${ART_STYLES[st].label}]` : ''}… `);
    const job = artService.generate(key, { checkpoint, style: st, quality });
    await artService.idle();
    console.log(job.status === 'pronto' ? `✅ ${((Date.now() - started) / 1000).toFixed(0)} s` : `❌ ${job.error}`);
  }
  console.log('Pronto! As imagens ficam em server/data/art/monsters e aparecem nos tokens.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
