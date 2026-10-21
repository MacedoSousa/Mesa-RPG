import express from 'express';
import type { Server } from 'http';
import request from 'supertest';
import { defaultWorkflow, fillWorkflow, profileFor } from '../../src/services/artService';
import { defaultPrompt } from '../../src/art/prompts';
import { app, auth, closeAll, registerUser, resetData, setupDatabase } from '../helpers';

// PNG 1×1 válido
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** Simula a API do ComfyUI: /object_info, /prompt, /history e /view. */
function fakeComfy() {
  const f = express();
  f.use(express.json({ limit: '2mb' }));
  const received: Record<string, unknown>[] = [];
  let polls = 0;
  f.get('/system_stats', (_q, r) => r.json({ system: { comfyui_version: '0.3.x' }, devices: [{ name: 'NVIDIA GeForce RTX 2060 SUPER', vram_total: 8.6e9 }] }));
  f.get('/object_info/CheckpointLoaderSimple', (_q, r) => r.json({ CheckpointLoaderSimple: { input: { required: { ckpt_name: [['sd15.safetensors', 'dreamshaperXL.safetensors']] } } } }));
  f.post('/prompt', (q, r) => { received.push(q.body.prompt); polls = 0; r.json({ prompt_id: 'p1', number: 1 }); });
  f.get('/history/:id', (_q, r) => {
    polls += 1;
    if (polls < 2) return r.json({});
    r.json({ p1: { status: { status_str: 'success' }, outputs: { '9': { images: [{ filename: 'monstro_00001_.png', subfolder: 'mesa_rpg', type: 'output' }] } } } });
  });
  f.get('/view', (q, r) => (q.query.filename === 'monstro_00001_.png' ? r.type('png').send(PNG) : r.status(404).end()));
  return { f, received };
}

let comfy: Server;
let received: Record<string, unknown>[];

beforeAll(async () => {
  await setupDatabase();
  const fake = fakeComfy();
  received = fake.received;
  await new Promise<void>((res) => { comfy = fake.f.listen(18188, '127.0.0.1', () => res()); });
});
beforeEach(resetData);
afterAll(async () => {
  await new Promise((r) => comfy.close(r));
  await closeAll();
});

async function waitJob(token: string, id: string) {
  for (let i = 0; i < 100; i++) {
    const { body } = await request(app).get('/api/art/jobs').set({ Authorization: `Bearer ${token}` }).expect(200);
    const job = body.jobs.find((j: { id: string }) => j.id === id);
    if (job.status === 'pronto' || job.status === 'erro') return job;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error('job não terminou');
}

describe('Arte dos monstros com ComfyUI local', () => {
  it('mostra o status do ComfyUI e os modelos disponíveis (só para o Mestre)', async () => {
    const master = await registerUser('quiron');
    const player = await registerUser('percy');
    const { body } = await request(app).get('/api/art/comfy').set(auth(master)).expect(200);
    expect(body.ok).toBe(true);
    expect(body.gpu).toMatch(/2060/);
    expect(body.checkpoints).toContain('dreamshaperXL.safetensors');
    await request(app).get('/api/art/comfy').set(auth(player)).expect(403);
    await request(app).post('/api/art/monsters/harpia/generate').set(auth(player)).send({}).expect(403);
  });

  it('gera a arte de um monstro, salva e serve a imagem para todos', async () => {
    const master = await registerUser('quiron');
    const player = await registerUser('percy');
    const res = await request(app).post('/api/art/monsters/harpia/generate').set(auth(master)).send({ seed: 42 }).expect(202);
    const job = await waitJob(master.accessToken, res.body.job.id);
    expect(job.status).toBe('pronto');

    // Workflow enviado: modelo SDXL preferido, semente e descrição da harpia
    const wf = received.at(-1) as Record<string, { class_type: string; inputs: Record<string, unknown> }>;
    expect(wf['4'].inputs.ckpt_name).toBe('dreamshaperXL.safetensors');
    expect(wf['3'].inputs.seed).toBe(42);
    expect(String(wf['6'].inputs.text)).toMatch(/harpy/);
    expect(wf['5'].inputs.width).toBe(1024);

    const list = await request(app).get('/api/art').set(auth(player)).expect(200);
    expect(list.body.monsters.harpia).toMatch(/^\/art\/monsters\/harpia\.png\?v=\d+/);
    const img = await request(app).get(list.body.monsters.harpia.split('?')[0]).expect(200);
    expect(Buffer.from(img.body).subarray(0, 4).toString('hex')).toBe('89504e47');

    await request(app).delete('/api/art/monsters/harpia').set(auth(master)).expect(204);
    expect((await request(app).get('/api/art').set(auth(player))).body.monsters.harpia).toBeUndefined();
    await request(app).get('/art/monsters/harpia.png').expect(404);
  });

  it('aceita upload manual e recusa arquivos que não são imagem', async () => {
    const master = await registerUser('quiron');
    await request(app).put('/api/art/monsters/cerbero').set(auth(master)).send({ image: `data:image/png;base64,${PNG.toString('base64')}` }).expect(200);
    await request(app).put('/api/art/monsters/cerbero').set(auth(master)).send({ image: `data:image/png;base64,${Buffer.from('<script>').toString('base64')}` }).expect(400);
    await request(app).put('/api/art/monsters/..%2Fx').set(auth(master)).send({ image: `data:image/png;base64,${PNG.toString('base64')}` }).expect(400);
  });

  it('preenche workflows próprios (ex.: FLUX) com prompt, semente e modelo', () => {
    const tpl = JSON.stringify({ '1': { inputs: { text: '{{PROMPT}}', seed: '{{SEED}}', unet_name: '{{CHECKPOINT}}' } } });
    const wf = fillWorkflow(tpl, { prompt: 'a "chimera"\nbreathing fire', negative: '', seed: 7, checkpoint: 'flux2-klein.safetensors' }) as Record<string, { inputs: Record<string, unknown> }>;
    expect(wf['1'].inputs).toEqual({ text: 'a "chimera"\nbreathing fire', seed: 7, unet_name: 'flux2-klein.safetensors' });
  });

  it('ajusta o workflow para cada família de modelo, LoRA e estilo', () => {
    expect(profileFor('flux1-schnell-fp8.safetensors')).toMatchObject({ family: 'FLUX schnell', cfg: 1, steps: 4 });
    expect(profileFor('DreamShaperXL_Turbo_v2_1.safetensors').family).toBe('SDXL Turbo');
    expect(profileFor('animagine-xl-3.1.safetensors').family).toBe('SDXL Anime');
    expect(profileFor('v1-5-pruned.safetensors')).toMatchObject({ family: 'SD 1.5', size: 512 });

    const dev = defaultWorkflow({ checkpoint: 'flux1-dev-fp8.safetensors', prompt: 'x', negative: 'y', seed: 1 }) as Record<string, { class_type: string; inputs: Record<string, unknown> }>;
    expect(dev['11'].class_type).toBe('FluxGuidance');
    expect(dev['3'].inputs.positive).toEqual(['11', 0]);
    expect(dev['3'].inputs.cfg).toBe(1);
    expect(dev['7'].inputs.text).toBe(''); // FLUX ignora o negativo

    const px = defaultWorkflow({ checkpoint: 'juggernautXL.safetensors', prompt: 'x', negative: 'y', seed: 1, lora: 'pixel-art-xl.safetensors', quality: 'rapida' }) as Record<string, { class_type: string; inputs: Record<string, unknown> }>;
    expect(px['12']).toMatchObject({ class_type: 'LoraLoader', inputs: { lora_name: 'pixel-art-xl.safetensors' } });
    expect(px['3'].inputs.model).toEqual(['12', 0]);
    expect(px['6'].inputs.clip).toEqual(['12', 1]);
    expect(px['3'].inputs.steps).toBeLessThan(28);

    expect(defaultPrompt('harpia', 'vaso_grego')).toMatch(/black-figure pottery/);
    expect(defaultPrompt('harpia', 'inexistente')).toMatch(/painted illustration/);
  });
});
