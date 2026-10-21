import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { MONSTERS } from '@mesa/shared';
import { env } from '../config/env';
import { ART_NEGATIVE, defaultPrompt } from '../art/prompts';
import { HttpError } from '../utils/HttpError';

const badRequest = (msg: string) => new HttpError(400, msg);

/**
 * Arte pintada dos monstros, gerada no ComfyUI que roda no próprio PC do Mestre
 * (ou enviada à mão). As imagens ficam em ART_DIR/monsters/<chave>.png e são
 * servidas em /art/monsters/<chave>.png para todos os clientes.
 */

export const ART_DIR = path.resolve(env.ART_DIR ?? path.join(__dirname, '../../data/art'));
const MONSTER_DIR = path.join(ART_DIR, 'monsters');
const KEY_RE = /^[a-z0-9_]{1,40}$/;

export type JobStatus = 'na_fila' | 'gerando' | 'pronto' | 'erro';
export interface ArtJob {
  id: string;
  key: string;
  status: JobStatus;
  prompt: string;
  seed: number;
  error?: string;
  url?: string;
  createdAt: number;
  finishedAt?: number;
}

export interface GenerateOptions {
  prompt?: string;
  negative?: string;
  seed?: number;
  checkpoint?: string;
  steps?: number;
}

function assertKey(key: string) {
  if (!KEY_RE.test(key)) throw badRequest('Chave de monstro inválida');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───────────── Cliente do ComfyUI ─────────────

/** Workflow txt2img padrão do ComfyUI (formato "API"), só com nós nativos. Serve para SD 1.5 e SDXL. */
export function defaultWorkflow(o: { checkpoint: string; prompt: string; negative: string; seed: number; steps: number; size: number }) {
  return {
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: o.checkpoint } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width: o.size, height: o.size, batch_size: 1 } },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: o.prompt, clip: ['4', 1] } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: o.negative, clip: ['4', 1] } },
    '3': {
      class_type: 'KSampler',
      inputs: { seed: o.seed, steps: o.steps, cfg: 6.5, sampler_name: 'dpmpp_2m', scheduler: 'karras', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] },
    },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    '10': { class_type: 'ImageScale', inputs: { upscale_method: 'lanczos', width: 512, height: 512, crop: 'disabled', image: ['8', 0] } },
    '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'mesa_rpg/monstro', images: ['10', 0] } },
  };
}

/**
 * Workflow personalizado (exportado do ComfyUI em "Save (API Format)"), para quem usa FLUX
 * ou outro modelo. Marcadores substituídos: {{PROMPT}}, {{NEGATIVE}}, {{SEED}}, {{CHECKPOINT}}.
 */
export function fillWorkflow(template: string, o: { prompt: string; negative: string; seed: number; checkpoint: string }) {
  const esc = (s: string) => JSON.stringify(s).slice(1, -1);
  const text = template
    .replace(/"\{\{SEED\}\}"/g, String(o.seed))
    .replace(/\{\{SEED\}\}/g, String(o.seed))
    .replace(/\{\{PROMPT\}\}/g, esc(o.prompt))
    .replace(/\{\{NEGATIVE\}\}/g, esc(o.negative))
    .replace(/\{\{CHECKPOINT\}\}/g, esc(o.checkpoint));
  return JSON.parse(text) as Record<string, unknown>;
}

async function comfy(pathname: string, init?: RequestInit, timeoutMs = 10_000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(new URL(pathname, env.COMFYUI_URL), { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`ComfyUI respondeu ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new Error('ComfyUI não respondeu a tempo');
    if ((e as { cause?: { code?: string } }).cause?.code === 'ECONNREFUSED') throw new Error(`ComfyUI não está rodando em ${env.COMFYUI_URL}`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function listCheckpoints(): Promise<string[]> {
  const info = (await (await comfy('/object_info/CheckpointLoaderSimple')).json()) as {
    CheckpointLoaderSimple?: { input?: { required?: { ckpt_name?: [string[]] } } };
  };
  return info.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];
}

async function pickCheckpoint(wanted?: string): Promise<string> {
  const list = await listCheckpoints();
  if (wanted && list.includes(wanted)) return wanted;
  if (env.COMFYUI_CHECKPOINT && list.includes(env.COMFYUI_CHECKPOINT)) return env.COMFYUI_CHECKPOINT;
  if (env.COMFYUI_WORKFLOW) return wanted ?? env.COMFYUI_CHECKPOINT ?? list[0] ?? '';
  if (!list.length) throw new Error('Nenhum modelo (checkpoint) encontrado no ComfyUI. Coloque um .safetensors em ComfyUI/models/checkpoints.');
  // Prefere modelos SDXL (melhores para arte pintada) quando houver
  return list.find((n) => /xl/i.test(n)) ?? list[0];
}

async function runComfy(o: { prompt: string; negative: string; seed: number; checkpoint?: string; steps: number }): Promise<Buffer> {
  const checkpoint = await pickCheckpoint(o.checkpoint);
  const isXl = /xl/i.test(checkpoint);
  const workflow = env.COMFYUI_WORKFLOW
    ? fillWorkflow(readFileSync(env.COMFYUI_WORKFLOW, 'utf8'), { ...o, checkpoint })
    : defaultWorkflow({ ...o, checkpoint, size: isXl ? 1024 : 512 });
  const clientId = randomUUID();
  const queued = (await (await comfy('/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow, client_id: clientId }) })).json()) as { prompt_id?: string; error?: unknown; node_errors?: unknown };
  if (!queued.prompt_id) throw new Error(`ComfyUI recusou o workflow: ${JSON.stringify(queued.error ?? queued.node_errors).slice(0, 300)}`);

  const deadline = Date.now() + env.COMFYUI_TIMEOUT_SECONDS * 1000;
  while (Date.now() < deadline) {
    await sleep(env.NODE_ENV === 'test' ? 20 : 1500);
    const hist = (await (await comfy(`/history/${queued.prompt_id}`)).json()) as Record<string, { outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>; status?: { status_str?: string; messages?: unknown[] } }>;
    const entry = hist[queued.prompt_id];
    if (!entry) continue;
    if (entry.status?.status_str === 'error') throw new Error('O ComfyUI deu erro ao gerar a imagem (veja o terminal do ComfyUI).');
    const img = Object.values(entry.outputs ?? {}).flatMap((n) => n.images ?? []).find((i) => i.type === 'output') ?? Object.values(entry.outputs ?? {}).flatMap((n) => n.images ?? [])[0];
    if (!img) continue;
    const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder ?? '', type: img.type ?? 'output' });
    const res = await comfy(`/view?${q}`, undefined, 60_000);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error('A geração demorou demais. Aumente COMFYUI_TIMEOUT_SECONDS ou use menos passos.');
}

// ───────────── Arquivos ─────────────

function fileFor(key: string) {
  return path.join(MONSTER_DIR, `${key}.png`);
}

function urlFor(key: string) {
  const f = fileFor(key);
  return existsSync(f) ? `/art/monsters/${key}.png?v=${Math.floor(statSync(f).mtimeMs)}` : null;
}

function isImage(buf: Buffer) {
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  const webp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  return png || jpg || webp;
}

function save(key: string, buf: Buffer, meta: Record<string, unknown>) {
  if (!isImage(buf)) throw badRequest('O arquivo não é uma imagem PNG, JPG ou WebP');
  mkdirSync(MONSTER_DIR, { recursive: true });
  writeFileSync(fileFor(key), buf);
  writeFileSync(path.join(MONSTER_DIR, `${key}.json`), JSON.stringify({ ...meta, savedAt: new Date().toISOString() }, null, 2));
}

// ───────────── Fila de geração (uma por vez: a GPU é uma só) ─────────────

const jobs: ArtJob[] = [];
let chain: Promise<unknown> = Promise.resolve();
let onChange: () => void = () => undefined;

export const artService = {
  /** Chamado quando uma arte muda (o servidor avisa os clientes por WebSocket). */
  setNotifier(fn: () => void) {
    onChange = fn;
  },

  list(): Record<string, string> {
    if (!existsSync(MONSTER_DIR)) return {};
    const out: Record<string, string> = {};
    for (const f of readdirSync(MONSTER_DIR)) {
      if (!f.endsWith('.png')) continue;
      const key = f.slice(0, -4);
      const url = urlFor(key);
      if (url) out[key] = url;
    }
    return out;
  },

  async status() {
    try {
      const stats = (await (await comfy('/system_stats', undefined, 4000)).json()) as { devices?: { name?: string; vram_total?: number }[]; system?: { comfyui_version?: string } };
      const checkpoints = await listCheckpoints();
      return {
        ok: true, url: env.COMFYUI_URL, checkpoints, customWorkflow: !!env.COMFYUI_WORKFLOW,
        gpu: stats.devices?.[0]?.name ?? null, vramGb: stats.devices?.[0]?.vram_total ? Math.round(stats.devices[0].vram_total / 1e9) : null,
        version: stats.system?.comfyui_version ?? null,
      };
    } catch (e) {
      return { ok: false, url: env.COMFYUI_URL, error: (e as Error).message, checkpoints: [] as string[], customWorkflow: !!env.COMFYUI_WORKFLOW };
    }
  },

  prompts() {
    return Object.fromEntries(Object.keys(MONSTERS).map((k) => [k, defaultPrompt(k)]));
  },

  jobs() {
    return jobs.slice(-40);
  },

  generate(key: string, opts: GenerateOptions = {}): ArtJob {
    assertKey(key);
    if (jobs.filter((j) => j.status === 'na_fila' || j.status === 'gerando').length >= 40) throw badRequest('Fila de geração cheia');
    const job: ArtJob = {
      id: randomUUID(), key, status: 'na_fila',
      prompt: (opts.prompt?.trim() || defaultPrompt(key)).slice(0, 1500),
      seed: Number.isFinite(opts.seed) ? Math.floor(opts.seed!) : Math.floor(Math.random() * 2 ** 31),
      createdAt: Date.now(),
    };
    jobs.push(job);
    if (jobs.length > 200) jobs.splice(0, jobs.length - 200);
    chain = chain.then(async () => {
      job.status = 'gerando';
      onChange();
      try {
        const buf = await runComfy({ prompt: job.prompt, negative: (opts.negative ?? ART_NEGATIVE).slice(0, 800), seed: job.seed, checkpoint: opts.checkpoint, steps: Math.min(60, Math.max(4, opts.steps ?? 26)) });
        save(key, buf, { prompt: job.prompt, seed: job.seed, source: 'comfyui' });
        job.status = 'pronto';
        job.url = urlFor(key) ?? undefined;
      } catch (e) {
        job.status = 'erro';
        job.error = (e as Error).message;
      } finally {
        job.finishedAt = Date.now();
        onChange();
      }
    });
    return job;
  },

  /** Espera a fila esvaziar (CLI e testes). */
  async idle() {
    await chain;
  },

  upload(key: string, dataUrl: string) {
    assertKey(key);
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl ?? '');
    if (!m) throw badRequest('Envie a imagem como data URL (PNG, JPG ou WebP)');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 1.4 * 1024 * 1024) throw badRequest('Imagem grande demais (máx. 1,4 MB; o Host já reduz para 512 px)');
    save(key, buf, { source: 'upload' });
    onChange();
    return urlFor(key);
  },

  remove(key: string) {
    assertKey(key);
    for (const f of [fileFor(key), path.join(MONSTER_DIR, `${key}.json`)]) if (existsSync(f)) unlinkSync(f);
    onChange();
  },
};
