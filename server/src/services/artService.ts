import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'fs';
import path from 'path';
import { MONSTERS } from '@mesa/shared';
import { env } from '../config/env';
import { ART_NEGATIVE, ART_STYLES, ART_STYLE_KEYS, defaultPrompt } from '../art/prompts';
import { HttpError } from '../utils/HttpError';

const badRequest = (msg: string) => new HttpError(400, msg);

/**
 * Arte pintada dos monstros, gerada no ComfyUI que roda no próprio PC do Mestre
 * (ou enviada à mão). As imagens ficam em ART_DIR/monsters/<chave>.png e são
 * servidas em /art/monsters/<chave>.png para todos os clientes.
 */

export const ART_DIR = path.resolve(env.ART_DIR ?? path.join(__dirname, '../../data/art'));
const MONSTER_DIR = path.join(ART_DIR, 'monsters');
const MAP_DIR = path.join(ART_DIR, 'maps');
const UUID_RE = /^[0-9a-f-]{8,40}$/i;
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
  quality?: Quality;
  style?: string;
  lora?: string | null;
}

function assertKey(key: string) {
  if (!KEY_RE.test(key)) throw badRequest('Chave de monstro inválida');
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ───────────── Cliente do ComfyUI ─────────────

/** Ajustes ideais de cada família de modelo (descobertos pelo nome do arquivo). */
export interface ModelProfile { family: string; cfg: number; steps: number; sampler: string; scheduler: string; size: number; negative: boolean; guidance?: number }

export function profileFor(checkpoint: string): ModelProfile {
  const n = checkpoint.toLowerCase();
  if (n.includes('flux') && n.includes('schnell')) return { family: 'FLUX schnell', cfg: 1, steps: 4, sampler: 'euler', scheduler: 'simple', size: 1024, negative: false };
  if (n.includes('flux')) return { family: 'FLUX dev', cfg: 1, steps: 20, sampler: 'euler', scheduler: 'simple', size: 1024, negative: false, guidance: 3.5 };
  if (/turbo|lightning|hyper/.test(n)) return { family: 'SDXL Turbo', cfg: 2, steps: 7, sampler: 'dpmpp_sde', scheduler: 'karras', size: 1024, negative: true };
  if (n.includes('animagine') || n.includes('pony')) return { family: 'SDXL Anime', cfg: 6, steps: 26, sampler: 'euler_ancestral', scheduler: 'normal', size: 1024, negative: true };
  if (/xl/.test(n)) return { family: 'SDXL', cfg: 6, steps: 28, sampler: 'dpmpp_2m', scheduler: 'karras', size: 1024, negative: true };
  return { family: 'SD 1.5', cfg: 7, steps: 26, sampler: 'dpmpp_2m', scheduler: 'karras', size: 512, negative: true };
}

const QUALITY = { rapida: 0.65, boa: 1, caprichada: 1.4 } as const;
export type Quality = keyof typeof QUALITY;

/**
 * Workflow txt2img (formato "API") só com nós nativos do ComfyUI. Serve para SD 1.5, SDXL e
 * checkpoints FLUX "tudo em um" (fp8). LoRA opcional entre o modelo e o sampler.
 */
export function defaultWorkflow(o: { checkpoint: string; prompt: string; negative: string; seed: number; steps?: number; size?: number; lora?: string | null; loraStrength?: number; quality?: Quality }) {
  const p = profileFor(o.checkpoint);
  const steps = o.steps ?? Math.max(p.family === 'FLUX schnell' ? 4 : 4, Math.round(p.steps * QUALITY[o.quality ?? 'boa']));
  const size = o.size ?? p.size;
  const model: [string, number] = o.lora ? ['12', 0] : ['4', 0];
  const clip: [string, number] = o.lora ? ['12', 1] : ['4', 1];
  const wf: Record<string, { class_type: string; inputs: Record<string, unknown> }> = {
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: o.checkpoint } },
    '5': { class_type: 'EmptyLatentImage', inputs: { width: size, height: size, batch_size: 1 } },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: o.prompt, clip } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: p.negative ? o.negative : '', clip } },
    '3': {
      class_type: 'KSampler',
      inputs: { seed: o.seed, steps, cfg: p.cfg, sampler_name: p.sampler, scheduler: p.scheduler, denoise: 1, model, positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] },
    },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
    '10': { class_type: 'ImageScale', inputs: { upscale_method: 'lanczos', width: 512, height: 512, crop: 'disabled', image: ['8', 0] } },
    '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'mesa_rpg/monstro', images: ['10', 0] } },
  };
  if (o.lora) wf['12'] = { class_type: 'LoraLoader', inputs: { model: ['4', 0], clip: ['4', 1], lora_name: o.lora, strength_model: o.loraStrength ?? 0.9, strength_clip: o.loraStrength ?? 0.9 } };
  if (p.guidance) {
    wf['11'] = { class_type: 'FluxGuidance', inputs: { conditioning: ['6', 0], guidance: p.guidance } };
    wf['3'].inputs.positive = ['11', 0];
  }
  return wf;
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

/** Descrição do tipo de mapa para o pintor (o desenho da mesa vira o "rascunho"). */
const MAP_SUBJECT: Record<string, string> = {
  floresta: 'dense ancient greek forest clearing, pine trees, dirt paths, mossy rocks',
  caverna: 'dark rocky cave with stalagmites and puddles',
  submundo: 'underworld cavern, black rock, glowing green ghost fire, river styx',
  templo: 'ruined ancient greek marble temple, columns, mosaic floor, braziers',
  rio: 'river crossing with wooden bridge, reeds, wet stones',
  praia: 'sandy beach with waves, driftwood, rocks, ocean foam',
  interior: 'interior of a building, wooden floor planks, furniture, rugs',
  estrada: 'country road with asphalt, grass verges, fences',
  acampamento: 'summer camp with cabins, lake, forest, archery range',
  olimpo: 'mount olympus palace, white marble, golden details, clouds',
};

export function mapPrompt(kind: string | undefined, mood: string | undefined, style = 'epico') {
  const subject = MAP_SUBJECT[kind ?? ''] ?? 'fantasy battle map terrain';
  // A mesa escurece o mapa sozinha à noite/no Submundo: aqui a luz é sempre uniforme
  const light = mood === 'submundo' ? 'even lighting, faint green ghostly glow' : 'even soft daylight, no strong shadows';
  const st = (ART_STYLES[style] ?? ART_STYLES.epico).prompt;
  return `top-down orthographic tabletop RPG battle map, ${subject}, ${light}, seen from directly above, hand painted textures, highly detailed, ${st}`;
}
export const MAP_NEGATIVE = 'perspective, horizon, sky, characters, people, creatures, text, letters, grid numbers, watermark, frame, border, blurry, lowres';

/** img2img: o mapa desenhado pela mesa é o rascunho; a IA repinta mantendo o traçado (denoise baixo). */
export function img2imgWorkflow(o: { checkpoint: string; image: string; width: number; height: number; prompt: string; negative: string; seed: number; denoise: number; quality?: Quality }) {
  const p = profileFor(o.checkpoint);
  const steps = Math.max(4, Math.round(p.steps * QUALITY[o.quality ?? 'boa']));
  const wf: Record<string, { class_type: string; inputs: Record<string, unknown> }> = {
    '1': { class_type: 'LoadImage', inputs: { image: o.image } },
    '2': { class_type: 'ImageScale', inputs: { upscale_method: 'lanczos', width: o.width, height: o.height, crop: 'disabled', image: ['1', 0] } },
    '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: o.checkpoint } },
    '3': { class_type: 'VAEEncode', inputs: { pixels: ['2', 0], vae: ['4', 2] } },
    '6': { class_type: 'CLIPTextEncode', inputs: { text: o.prompt, clip: ['4', 1] } },
    '7': { class_type: 'CLIPTextEncode', inputs: { text: p.negative ? o.negative : '', clip: ['4', 1] } },
    '5': {
      class_type: 'KSampler',
      inputs: { seed: o.seed, steps, cfg: p.cfg, sampler_name: p.sampler, scheduler: p.scheduler, denoise: o.denoise, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['3', 0] },
    },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['5', 0], vae: ['4', 2] } },
    '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'mesa_rpg/mapa', images: ['8', 0] } },
  };
  if (p.guidance) {
    wf['11'] = { class_type: 'FluxGuidance', inputs: { conditioning: ['6', 0], guidance: p.guidance } };
    wf['5'].inputs.positive = ['11', 0];
  }
  return wf;
}

/** Tamanho de trabalho do modelo mantendo a proporção do mapa (múltiplos de 64). */
export function workSize(w: number, h: number, base: number) {
  const area = base * base;
  const ratio = w / h;
  const ww = Math.sqrt(area * ratio);
  const hh = ww / ratio;
  const r64 = (v: number) => Math.max(256, Math.round(v / 64) * 64);
  return { width: r64(ww), height: r64(hh) };
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

async function listLoras(): Promise<string[]> {
  try {
    const info = (await (await comfy('/object_info/LoraLoader')).json()) as { LoraLoader?: { input?: { required?: { lora_name?: [string[]] } } } };
    return info.LoraLoader?.input?.required?.lora_name?.[0] ?? [];
  } catch {
    return [];
  }
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

/** Envia uma imagem para a pasta input do ComfyUI. */
async function uploadToComfy(buf: Buffer, name: string): Promise<string> {
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(buf)], { type: 'image/png' }), name);
  form.append('overwrite', 'true');
  const r = (await (await comfy('/upload/image', { method: 'POST', body: form }, 30_000)).json()) as { name?: string; subfolder?: string };
  if (!r.name) throw new Error('O ComfyUI não aceitou a imagem do mapa');
  return r.subfolder ? `${r.subfolder}/${r.name}` : r.name;
}

/** Envia um workflow e espera a primeira imagem pronta. */
async function queueAndWait(workflow: Record<string, unknown>): Promise<Buffer> {
  const clientId = randomUUID();
  const queued = (await (await comfy('/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow, client_id: clientId }) })).json()) as { prompt_id?: string; error?: unknown; node_errors?: unknown };
  if (!queued.prompt_id) throw new Error(`ComfyUI recusou o workflow: ${JSON.stringify(queued.error ?? queued.node_errors).slice(0, 300)}`);
  const deadline = Date.now() + env.COMFYUI_TIMEOUT_SECONDS * 1000;
  while (Date.now() < deadline) {
    await sleep(env.NODE_ENV === 'test' ? 20 : 1500);
    const hist = (await (await comfy(`/history/${queued.prompt_id}`)).json()) as Record<string, { outputs?: Record<string, { images?: { filename: string; subfolder: string; type: string }[] }>; status?: { status_str?: string } }>;
    const entry = hist[queued.prompt_id];
    if (!entry) continue;
    if (entry.status?.status_str === 'error') throw new Error('O ComfyUI deu erro ao gerar a imagem (veja o terminal do ComfyUI).');
    const all = Object.values(entry.outputs ?? {}).flatMap((n) => n.images ?? []);
    const img = all.find((i) => i.type === 'output') ?? all[0];
    if (!img) continue;
    const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder ?? '', type: img.type ?? 'output' });
    const res = await comfy(`/view?${q}`, undefined, 60_000);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error('A geração demorou demais. Aumente COMFYUI_TIMEOUT_SECONDS ou use menos passos.');
}

async function runComfy(o: { prompt: string; negative: string; seed: number; checkpoint?: string; steps?: number; quality?: Quality; lora?: string | null; style?: string }): Promise<Buffer> {
  const checkpoint = await pickCheckpoint(o.checkpoint);
  // Estilo pixel art usa a LoRA de pixel se ela estiver instalada (e o modelo for SDXL)
  let lora = o.lora ?? null;
  const st = o.style ? ART_STYLES[o.style] : undefined;
  if (!lora && st?.lora && /xl/i.test(checkpoint) && !/flux/i.test(checkpoint)) lora = (await listLoras()).find((l) => st.lora!.test(l)) ?? null;
  const workflow = env.COMFYUI_WORKFLOW
    ? fillWorkflow(readFileSync(env.COMFYUI_WORKFLOW, 'utf8'), { ...o, checkpoint })
    : defaultWorkflow({ ...o, checkpoint, lora });
  return queueAndWait(workflow);
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

function mapFile(campaignId: string) {
  return path.join(MAP_DIR, `${campaignId}.png`);
}
function mapInfo(campaignId: string): { url: string; signature: string; width: number; height: number; style?: string } | null {
  const f = mapFile(campaignId);
  const meta = path.join(MAP_DIR, `${campaignId}.json`);
  if (!existsSync(f) || !existsSync(meta)) return null;
  try {
    const m = JSON.parse(readFileSync(meta, 'utf8')) as { signature: string; width: number; height: number; style?: string };
    return { ...m, url: `/art/maps/${campaignId}.png?v=${Math.floor(statSync(f).mtimeMs)}` };
  } catch {
    return null;
  }
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
      const loras = await listLoras();
      return {
        ok: true, url: env.COMFYUI_URL, checkpoints, loras, customWorkflow: !!env.COMFYUI_WORKFLOW,
        profiles: Object.fromEntries(checkpoints.map((c) => [c, profileFor(c).family])),
        gpu: stats.devices?.[0]?.name ?? null, vramGb: stats.devices?.[0]?.vram_total ? Math.round(stats.devices[0].vram_total / 1e9) : null,
        version: stats.system?.comfyui_version ?? null,
      };
    } catch (e) {
      return { ok: false, url: env.COMFYUI_URL, error: (e as Error).message, checkpoints: [] as string[], loras: [] as string[], customWorkflow: !!env.COMFYUI_WORKFLOW };
    }
  },

  prompts(style = 'epico') {
    return Object.fromEntries(Object.keys(MONSTERS).map((k) => [k, defaultPrompt(k, style)]));
  },

  styles() {
    return ART_STYLE_KEYS.map((k) => ({ key: k, label: ART_STYLES[k].label, bestWith: ART_STYLES[k].bestWith ?? null }));
  },

  jobs() {
    return jobs.slice(-40);
  },

  generate(key: string, opts: GenerateOptions = {}): ArtJob {
    assertKey(key);
    if (jobs.filter((j) => j.status === 'na_fila' || j.status === 'gerando').length >= 40) throw badRequest('Fila de geração cheia');
    const job: ArtJob = {
      id: randomUUID(), key, status: 'na_fila',
      prompt: (opts.prompt?.trim() || defaultPrompt(key, opts.style)).slice(0, 1500),
      seed: Number.isFinite(opts.seed) ? Math.floor(opts.seed!) : Math.floor(Math.random() * 2 ** 31),
      createdAt: Date.now(),
    };
    jobs.push(job);
    if (jobs.length > 200) jobs.splice(0, jobs.length - 200);
    chain = chain.then(async () => {
      job.status = 'gerando';
      onChange();
      try {
        const buf = await runComfy({
          prompt: job.prompt, negative: (opts.negative ?? ART_NEGATIVE).slice(0, 800), seed: job.seed, checkpoint: opts.checkpoint,
          steps: opts.steps ? Math.min(60, Math.max(1, opts.steps)) : undefined, quality: opts.quality, lora: opts.lora, style: opts.style,
        });
        save(key, buf, { prompt: job.prompt, seed: job.seed, style: opts.style ?? 'epico', checkpoint: opts.checkpoint ?? null, source: 'comfyui' });
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

  /** Mapa repintado pela IA desta campanha (se houver). */
  mapArt(campaignId: string) {
    if (!UUID_RE.test(campaignId)) throw badRequest('Campanha inválida');
    return mapInfo(campaignId);
  },

  removeMapArt(campaignId: string) {
    if (!UUID_RE.test(campaignId)) throw badRequest('Campanha inválida');
    for (const f of [mapFile(campaignId), path.join(MAP_DIR, `${campaignId}.json`)]) if (existsSync(f)) unlinkSync(f);
    onChange();
  },

  /**
   * Repinta o mapa da mesa (imagem enviada pelo Host) mantendo o traçado: o resultado fica
   * por baixo das fichas e dos bonecos, para todos os jogadores.
   */
  paintMap(campaignId: string, o: { image: string; signature: string; kind?: string; mood?: string; style?: string; denoise?: number; checkpoint?: string; quality?: Quality; prompt?: string; tilesW: number; tilesH: number }): ArtJob {
    if (!UUID_RE.test(campaignId)) throw badRequest('Campanha inválida');
    const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(o.image ?? '');
    if (!m) throw badRequest('Envie o mapa como data URL (PNG, JPG ou WebP)');
    const src = Buffer.from(m[2], 'base64');
    if (!isImage(src)) throw badRequest('Imagem do mapa inválida');
    if (jobs.some((j) => j.key === `mapa:${campaignId}` && (j.status === 'na_fila' || j.status === 'gerando'))) throw badRequest('Este mapa já está sendo pintado');
    const job: ArtJob = {
      id: randomUUID(), key: `mapa:${campaignId}`, status: 'na_fila',
      prompt: (o.prompt?.trim() || mapPrompt(o.kind, o.mood, o.style)).slice(0, 1500),
      seed: Math.floor(Math.random() * 2 ** 31), createdAt: Date.now(),
    };
    jobs.push(job);
    chain = chain.then(async () => {
      job.status = 'gerando';
      onChange();
      try {
        const checkpoint = await pickCheckpoint(o.checkpoint);
        const name = await uploadToComfy(src, `mesa_mapa_${campaignId}.png`);
        const size = workSize(o.tilesW, o.tilesH, profileFor(checkpoint).size);
        const buf = await queueAndWait(img2imgWorkflow({
          checkpoint, image: name, ...size, prompt: job.prompt, negative: MAP_NEGATIVE, seed: job.seed,
          denoise: Math.min(0.8, Math.max(0.2, o.denoise ?? 0.5)), quality: o.quality,
        }));
        if (!isImage(buf)) throw new Error('O ComfyUI devolveu algo que não é imagem');
        mkdirSync(MAP_DIR, { recursive: true });
        writeFileSync(mapFile(campaignId), buf);
        writeFileSync(path.join(MAP_DIR, `${campaignId}.json`), JSON.stringify({ signature: o.signature, width: o.tilesW, height: o.tilesH, style: o.style ?? 'epico', prompt: job.prompt, seed: job.seed, checkpoint, savedAt: new Date().toISOString() }, null, 2));
        job.status = 'pronto';
        job.url = mapInfo(campaignId)?.url;
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
