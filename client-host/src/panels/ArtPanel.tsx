import { useEffect, useRef, useState } from 'react';
import { MONSTERS } from '@mesa/shared';
import { Badge, Button, Select, TokenAvatar, api, cx, errorMessage, loadPaintedArt, paintedUrl, toast } from '@mesa/common';

interface ComfyStatus { ok: boolean; url: string; error?: string; checkpoints: string[]; loras?: string[]; profiles?: Record<string, string>; gpu?: string | null; vramGb?: number | null; customWorkflow: boolean }
interface Style { key: string; label: string; bestWith: string | null }
interface Job { id: string; key: string; status: 'na_fila' | 'gerando' | 'pronto' | 'erro'; error?: string; seed: number; createdAt: number }

const STATUS_LABEL: Record<Job['status'], string> = { na_fila: '⏳ na fila', gerando: '🎨 pintando…', pronto: '✅ pronto', erro: '❌ erro' };

/** Reduz qualquer imagem para 512×512 (recorte central) antes de enviar. */
async function toTokenPng(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Não consegui abrir essa imagem'));
      i.src = url;
    });
    const side = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    c.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 512, 512);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Arte pintada dos monstros: geração local no ComfyUI (RTX do Mestre) ou upload. */
export function ArtPanel() {
  const [status, setStatus] = useState<ComfyStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [checkpoint, setCheckpoint] = useState('');
  const [quality, setQuality] = useState<'rapida' | 'boa' | 'caprichada'>('boa');
  const [styles, setStyles] = useState<Style[]>([]);
  const [style, setStyle] = useState('epico');
  const [mixStyles, setMixStyles] = useState(false);
  const [lora, setLora] = useState('');
  const [, bump] = useState(0);
  const fileFor = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function refreshStatus() {
    try {
      const s = await api<ComfyStatus>('/art/comfy');
      setStatus(s);
      if (s.checkpoints.length && !checkpoint) setCheckpoint(s.checkpoints.find((c) => /xl/i.test(c)) ?? s.checkpoints[0]);
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  useEffect(() => {
    void refreshStatus();
    void loadPaintedArt(true).then(() => bump((n) => n + 1));
    api<{ prompts: Record<string, string>; styles: Style[] }>('/art/prompts').then((r) => { setPrompts(r.prompts); setStyles(r.styles ?? []); }).catch(() => undefined);
    api<{ jobs: Job[] }>('/art/jobs').then((r) => setJobs(r.jobs)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Acompanha a fila enquanto houver algo pintando
  const busy = jobs.some((j) => j.status === 'na_fila' || j.status === 'gerando');
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(async () => {
      try {
        const r = await api<{ jobs: Job[] }>('/art/jobs');
        setJobs(r.jobs);
        await loadPaintedArt(true);
        bump((n) => n + 1);
      } catch {
        /* tenta de novo */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [busy]);

  const lastJob = (key: string) => [...jobs].reverse().find((j) => j.key === key);

  // Ao trocar o estilo, as descrições sugeridas acompanham
  useEffect(() => {
    api<{ prompts: Record<string, string> }>(`/art/prompts?style=${style}`).then((r) => setPrompts(r.prompts)).catch(() => undefined);
  }, [style]);

  async function generate(key: string, prompt?: string) {
    try {
      const st = mixStyles && styles.length ? styles[Math.floor(Math.random() * styles.length)].key : style;
      const r = await api<{ job: Job }>(`/art/monsters/${key}/generate`, { method: 'POST', json: { prompt, checkpoint: checkpoint || undefined, quality, style: st, lora: lora || undefined } });
      setJobs((js) => [...js, r.job]);
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  async function generateMissing() {
    const missing = Object.keys(MONSTERS).filter((k) => !paintedUrl(`monstro:${k}`) && !['na_fila', 'gerando'].includes(lastJob(k)?.status ?? ''));
    if (!missing.length) return toast('Todos os monstros já têm arte 🎨', 'info');
    for (const k of missing) await generate(k);
    toast(`${missing.length} monstro(s) na fila. Na RTX 2060: SDXL Turbo ~10 s, SDXL ~40 s, FLUX ~1–2 min cada.`, 'info');
  }

  async function upload(file: File) {
    const key = fileFor.current;
    if (!key) return;
    try {
      const image = await toTokenPng(file);
      await api(`/art/monsters/${key}`, { method: 'PUT', json: { image } });
      await loadPaintedArt(true);
      bump((n) => n + 1);
      toast('Arte enviada! Os tokens já mudaram para todos.', 'sucesso');
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  async function remove(key: string) {
    try {
      await api(`/art/monsters/${key}`, { method: 'DELETE' });
      await loadPaintedArt(true);
      bump((n) => n + 1);
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  return (
    <div className="space-y-3">
      <div className={cx('rounded-xl border p-3 text-sm', status?.ok ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10')}>
        {!status && <p>Verificando o ComfyUI…</p>}
        {status?.ok && (
          <>
            <p className="font-semibold text-emerald-200">🟢 ComfyUI conectado {status.gpu && <span className="font-normal text-slate-300">· {status.gpu}{status.vramGb ? ` (${status.vramGb} GB)` : ''}</span>}</p>
            {status.customWorkflow ? (
              <p className="mt-1 text-xs text-slate-300">Usando o workflow próprio de COMFYUI_WORKFLOW.</p>
            ) : (
              <>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Select label="Modelo" value={checkpoint} onChange={setCheckpoint} options={status.checkpoints.map((c) => ({ value: c, label: `${c.replace(/\.safetensors$/, '')}${status.profiles?.[c] ? ` · ${status.profiles[c]}` : ''}` }))} />
                <Select label="Estilo" value={style} onChange={setStyle} options={styles.map((st) => ({ value: st.key, label: st.label }))} />
                <Select label="Qualidade" value={quality} onChange={(v) => setQuality(v as typeof quality)} options={[{ value: 'rapida', label: 'Rápida' }, { value: 'boa', label: 'Boa' }, { value: 'caprichada', label: 'Caprichada' }]} />
                <Select label="LoRA (opcional)" value={lora} onChange={setLora} options={[{ value: '', label: '— automática —' }, ...(status.loras ?? []).map((l) => ({ value: l, label: l.replace(/\.safetensors$/, '') }))]} />
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={mixStyles} onChange={(e) => setMixStyles(e.target.checked)} /> 🎲 Misturar estilos (cada monstro sai num estilo diferente)</label>
              {styles.find((st) => st.key === style)?.bestWith && <p className="mt-1 text-[11px] text-slate-400">Dica: este estilo fica melhor com o modelo {styles.find((st) => st.key === style)?.bestWith}.</p>}
              </>
            )}
          </>
        )}
        {status && !status.ok && (
          <>
            <p className="font-semibold text-amber-200">🟠 ComfyUI desligado</p>
            <p className="mt-1 text-xs text-slate-300">{status.error}</p>
            <p className="mt-1 text-xs text-slate-300">
              Abra o ComfyUI no seu PC (ele roda em {status.url}) e clique em <em>Verificar</em>. O passo a passo está em <code>docs/ARTE_COM_IA.md</code>. Sem ComfyUI, você ainda pode enviar imagens prontas abaixo.
            </p>
          </>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="subtle" onClick={refreshStatus}>🔄 Verificar</Button>
          <Button size="sm" variant="gold" disabled={!status?.ok} onClick={generateMissing}>🎨 Pintar os que faltam</Button>
        </div>
      </div>

      <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />

      {Object.values(MONSTERS).map((m) => {
        const job = lastJob(m.key);
        const has = !!paintedUrl(`monstro:${m.key}`);
        return (
          <div key={m.key} className="rounded-lg border border-white/10 bg-white/5 p-2">
            <div className="flex items-center gap-3">
              <TokenAvatar artKey={`monstro:${m.key}`} color="#7f1d1d" size={56} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{m.label}</p>
                <div className="mt-0.5 flex flex-wrap gap-1">
                  <Badge color={has ? 'emerald' : 'slate'}>{has ? 'pintado' : 'ícone'}</Badge>
                  {job && job.status !== 'pronto' && <Badge color={job.status === 'erro' ? 'rose' : 'amber'}>{STATUS_LABEL[job.status]}</Badge>}
                </div>
                {job?.status === 'erro' && <p className="mt-1 text-[11px] text-rose-300">{job.error}</p>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <Button size="sm" variant="subtle" disabled={!status?.ok} onClick={() => generate(m.key, editing === m.key ? draft : undefined)}>{has ? '🎲 Outra versão' : '🎨 Pintar'}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(editing === m.key ? null : m.key); setDraft(prompts[m.key] ?? ''); }}>✏️ Descrição</Button>
              <Button size="sm" variant="ghost" onClick={() => { fileFor.current = m.key; fileInput.current?.click(); }}>📤 Enviar imagem</Button>
              {has && <Button size="sm" variant="ghost" onClick={() => remove(m.key)}>↩️ Voltar ao ícone</Button>}
            </div>
            {editing === m.key && (
              <div className="mt-2">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} className="w-full rounded-lg border border-white/15 bg-slate-950 p-2 text-xs" />
                <p className="text-[11px] text-slate-400">Em inglês os modelos entendem melhor. Clique em “Pintar” para usar esta descrição.</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
