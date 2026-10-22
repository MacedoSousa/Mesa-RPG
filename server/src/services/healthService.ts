import { constants, existsSync, readdirSync } from 'fs';
import { access, statfs } from 'fs/promises';
import path from 'path';
import { sequelize } from '../config/database';
import { env } from '../config/env';
import { migrator } from '../database/migrator';
import { ART_DIR, artService } from './artService';

/**
 * Checagem completa do sistema: banco, configurações, imagens, IA, saves e clientes.
 * Usada ao ligar o servidor (log), no Host (🩺) e pelo scripts/verificar.sh.
 */
export type CheckLevel = 'ok' | 'aviso' | 'erro';
export interface Check { key: string; label: string; level: CheckLevel; detail: string }

const CLIENTS = { host: path.resolve(__dirname, '../../../client-host/dist/index.html'), web: path.resolve(__dirname, '../../../client-web/dist/index.html') };
const DEFAULT_SECRETS = ['troque-este-segredo-de-acesso-por-algo-bem-longo', 'troque-este-segredo-de-refresh-por-outro-valor'];
const startedAt = Date.now();

const countPng = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).length : 0);

async function count(table: string): Promise<number> {
  const [rows] = await sequelize.query(`SELECT COUNT(*)::int AS n FROM "${table}" WHERE ${table === 'users' || table === 'campaign_members' || table === 'inventory_items' ? 'TRUE' : 'deleted_at IS NULL'}`);
  return (rows as { n: number }[])[0]?.n ?? 0;
}

export async function systemCheck(): Promise<{ ok: boolean; checks: Check[]; uptimeSeconds: number; time: string }> {
  const checks: Check[] = [];
  const add = (key: string, label: string, level: CheckLevel, detail: string) => checks.push({ key, label, level, detail });

  // Banco de dados
  let dbOk = false;
  try {
    const t0 = Date.now();
    await sequelize.query('SELECT 1');
    dbOk = true;
    add('banco', 'Banco de dados', 'ok', `PostgreSQL respondendo (${Date.now() - t0} ms)`);
  } catch (e) {
    add('banco', 'Banco de dados', 'erro', `Sem conexão: ${(e as Error).message}`);
  }
  if (dbOk) {
    try {
      const pending = await migrator.pending();
      add('migracoes', 'Estrutura do banco', pending.length ? 'erro' : 'ok', pending.length ? `${pending.length} migração(ões) pendente(s)` : 'Todas as migrações aplicadas');
      const [users, chars, camps] = await Promise.all([count('users'), count('characters'), count('campaigns')]);
      add('dados', 'Contas e heróis', users ? 'ok' : 'aviso', `${users} conta(s), ${chars} herói(s), ${camps} campanha(s)`);
      const [rows] = await sequelize.query(`SELECT MAX(created_at) AS last, COUNT(*)::int AS n FROM save_games WHERE deleted_at IS NULL`);
      const r = (rows as { last: Date | null; n: number }[])[0];
      const last = r?.last ? new Date(r.last) : null;
      add('saves', 'Saves da mesa', r?.n ? 'ok' : 'aviso', r?.n ? `${r.n} save(s); último em ${last!.toLocaleString('pt-BR')}` : 'Nenhum save ainda (o automático roda a cada ' + env.AUTOSAVE_SECONDS + ' s com a mesa aberta)');
    } catch (e) {
      add('dados', 'Contas e heróis', 'erro', (e as Error).message);
    }
  }

  // Configurações (.env)
  const envFile = process.env.DOTENV_CONFIG_PATH ?? path.resolve(__dirname, '../../.env');
  const weak = (v: string) => DEFAULT_SECRETS.includes(v) || v.length < 32 || new Set(v).size < 12 || /troque|segredo|secret|senha|password|changeme|mesa|olimpo|smoke|teste|test|1234|abcd|qwerty/i.test(v);
  const weakSecret = weak(env.JWT_SECRET) || weak(env.JWT_REFRESH_SECRET) || env.JWT_SECRET === env.JWT_REFRESH_SECRET;
  add('config', 'Configurações (server/.env)', !existsSync(envFile) ? 'aviso' : weakSecret ? 'aviso' : 'ok',
    !existsSync(envFile) ? 'server/.env não encontrado (usando variáveis do sistema)' : weakSecret ? 'Carregado, mas os segredos JWT são fracos: rode ./scripts/corrigir-env.sh --trocar-jwt' : `Carregado · porta ${env.PORT} · ${env.NODE_ENV}`);

  // Imagens
  try {
    await access(ART_DIR, constants.W_OK).catch(async () => {
      if (!existsSync(ART_DIR)) return; // ainda não existe: é criada na primeira arte
      throw new Error('sem permissão de escrita');
    });
    const monsters = countPng(path.join(ART_DIR, 'monsters'));
    const maps = countPng(path.join(ART_DIR, 'maps'));
    add('imagens', 'Imagens (arte e mapas)', 'ok', `${monsters} monstro(s) pintado(s), ${maps} mapa(s) pintado(s) em ${ART_DIR}`);
  } catch (e) {
    add('imagens', 'Imagens (arte e mapas)', 'erro', `${ART_DIR}: ${(e as Error).message}`);
  }

  // Espaço em disco
  try {
    const fsInfo = await statfs(existsSync(ART_DIR) ? ART_DIR : path.resolve(__dirname, '../..'));
    const freeGb = (fsInfo.bavail * fsInfo.bsize) / 1e9;
    add('disco', 'Espaço em disco', freeGb < 2 ? 'erro' : freeGb < 10 ? 'aviso' : 'ok', `${freeGb.toFixed(1)} GB livres`);
  } catch {
    /* statfs indisponível */
  }

  // Telas (build dos clientes)
  const builtHost = existsSync(CLIENTS.host);
  const builtWeb = existsSync(CLIENTS.web);
  add('telas', 'Telas do Mestre e dos jogadores', builtHost && builtWeb ? 'ok' : 'erro', builtHost && builtWeb ? 'Prontas (build feito)' : 'Falta o build: rode "npm run build"');

  // IA local (opcional)
  const comfy = await artService.status();
  add('ia', 'IA local (ComfyUI)', comfy.ok ? 'ok' : 'aviso',
    comfy.ok ? `${'gpu' in comfy && comfy.gpu ? comfy.gpu : 'conectado'} · ${comfy.checkpoints.length} modelo(s)` : `Desligado (${env.COMFYUI_URL}). O jogo funciona; só a pintura com IA fica parada.`);

  return { ok: !checks.some((c) => c.level === 'erro'), checks, uptimeSeconds: Math.round((Date.now() - startedAt) / 1000), time: new Date().toISOString() };
}

/** Imprime a checagem no terminal (ao ligar o servidor). */
export async function logSystemCheck() {
  const r = await systemCheck();
  const icon = { ok: '✅', aviso: '⚠️ ', erro: '❌' } as const;
  console.log('🩺 Checagem do sistema:');
  for (const c of r.checks) console.log(`   ${icon[c.level]} ${c.label}: ${c.detail}`);
  console.log(r.ok ? '   Tudo pronto para jogar!\n' : '   Há problemas acima: confira antes de chamar os jogadores.\n');
  return r;
}
