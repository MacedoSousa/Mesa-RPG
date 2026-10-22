import { Suspense, lazy, useEffect, useState } from 'react';
import {
  DAMAGE_TYPES, MAP_KINDS, MAP_KIND_KEYS, MONSTERS, OBJECTS, SURFACES, TERRAIN, type DamageType, type Element, type MapKind, type MapState, type ObjectType, type ProjectedState,
  type SurfaceType, type TerrainType,
} from '@mesa/shared';
import { Badge, Button, Field, Modal, Select, api, captureMapForPainting, cx, errorMessage, loadMapArt, mapArtFor, onMapArt, terrainSignature, toast, useTable, TokenAvatar } from '@mesa/common';

const HeroViewer = lazy(() => import('@mesa/3d/HeroViewer'));
import type { Tool } from '../tools';

/** Repinta o mapa atual com a IA do PC do Mestre (ComfyUI img2img), mantendo o traçado. */
function PaintMapCard({ campaignId, state }: { campaignId: string; state: ProjectedState }) {
  const [style, setStyle] = useState('epico');
  const [styles, setStyles] = useState<{ key: string; label: string }[]>([]);
  const [fidelity, setFidelity] = useState(0.5);
  const [quality, setQuality] = useState<'rapida' | 'boa' | 'caprichada'>('boa');
  const [job, setJob] = useState<{ id: string; status: string; error?: string } | null>(null);
  const [comfyOk, setComfyOk] = useState<boolean | null>(null);
  const [, bump] = useState(0);
  const art = mapArtFor(campaignId, state.map as MapState);

  useEffect(() => {
    api<{ ok: boolean }>('/art/comfy').then((r) => setComfyOk(r.ok)).catch(() => setComfyOk(false));
    api<{ styles: { key: string; label: string }[] }>('/art/prompts').then((r) => setStyles(r.styles ?? [])).catch(() => undefined);
    void loadMapArt(campaignId, true).then(() => bump((n) => n + 1));
    return onMapArt(() => bump((n) => n + 1));
  }, [campaignId]);

  const busy = job?.status === 'na_fila' || job?.status === 'gerando';
  useEffect(() => {
    if (!busy || !job) return;
    const t = setInterval(async () => {
      try {
        const r = await api<{ jobs: { id: string; status: string; error?: string }[] }>('/art/jobs');
        const j = r.jobs.find((x) => x.id === job.id);
        if (j) setJob(j);
        if (j?.status === 'pronto') { await loadMapArt(campaignId, true); toast('🎨 Mapa pintado! Todos já estão vendo.', 'sucesso'); }
        if (j?.status === 'erro') toast(j.error ?? 'Erro ao pintar', 'erro');
      } catch {
        /* tenta de novo */
      }
    }, 2500);
    return () => clearInterval(t);
  }, [busy, job, campaignId]);

  async function paint() {
    try {
      const map = state.map as MapState;
      const image = await captureMapForPainting(map);
      const r = await api<{ job: { id: string; status: string } }>(`/art/maps/${campaignId}/paint`, {
        method: 'POST',
        json: { image, signature: terrainSignature(map), tilesW: map.width, tilesH: map.height, kind: map.kind ?? map.id ?? undefined, mood: map.mood, style, denoise: 1 - fidelity + 0.1, quality },
      });
      setJob(r.job);
      toast('Pintando o mapa na sua placa de vídeo… (SDXL Turbo ~15 s, SDXL ~1 min)', 'info');
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }

  return (
    <section className="rounded-xl border border-fuchsia-400/30 bg-fuchsia-950/20 p-2">
      <p className="mb-1 text-sm font-semibold text-fuchsia-200">🎨 Pintar o mapa com IA</p>
      <p className="mb-2 text-[11px] text-slate-400">
        A IA do seu PC (ComfyUI) repinta este mapa mantendo paredes, árvores e caminhos no mesmo lugar. Fichas, bonecos, baús e efeitos continuam por cima. Se o terreno mudar, volta o desenho original.
      </p>
      {comfyOk === false && <p className="mb-2 rounded bg-amber-500/10 p-1.5 text-[11px] text-amber-200">ComfyUI desligado: veja a aba 🎨 Arte.</p>}
      <div className="grid grid-cols-2 gap-2">
        <Select label="Estilo" value={style} onChange={setStyle} options={(styles.length ? styles : [{ key: 'epico', label: 'Pintura épica' }]).map((st) => ({ value: st.key, label: st.label }))} />
        <Select label="Qualidade" value={quality} onChange={(v) => setQuality(v as typeof quality)} options={[{ value: 'rapida', label: 'Rápida' }, { value: 'boa', label: 'Boa' }, { value: 'caprichada', label: 'Caprichada' }]} />
      </div>
      <label className="mt-2 block text-xs text-slate-300">
        Fiel ao desenho ↔ mais criativo
        <input type="range" min={0.2} max={0.7} step={0.05} value={1 - fidelity} onChange={(e) => setFidelity(1 - Number(e.target.value))} className="w-full" />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="gold" disabled={busy || comfyOk === false} onClick={() => void paint()}>{busy ? (job?.status === 'gerando' ? '🎨 Pintando…' : '⏳ Na fila…') : art ? '🎲 Pintar de novo' : '🎨 Pintar este mapa'}</Button>
        {art && <Button size="sm" variant="ghost" onClick={() => void api(`/art/maps/${campaignId}`, { method: 'DELETE' }).then(() => loadMapArt(campaignId, true))}>↩️ Voltar ao desenho</Button>}
      </div>
      {art && <img src={art.url} alt="Mapa pintado" className="mt-2 w-full rounded-lg border border-white/10" />}
    </section>
  );
}

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Injeção de monstros em tempo real. */
export function MonstersPanel({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) {
  const [hidden, setHidden] = useState(false);
  const [view, setView] = useState<string | null>(null);
  const active = tool.kind === 'spawn' ? tool.monsterKey : null;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hidden} onChange={(e) => { setHidden(e.target.checked); if (tool.kind === 'spawn') setTool({ ...tool, hidden: e.target.checked }); }} /> Invocar oculto (emboscada)</label>
      <p className="text-xs text-slate-400">Escolha um monstro e clique no mapa para posicioná-lo. Em combate ele entra na iniciativa automaticamente.</p>
      {Object.values(MONSTERS).map((m) => (
        <button key={m.key} onClick={() => setTool({ kind: 'spawn', monsterKey: m.key, hidden })} className={cx('w-full rounded-lg border p-2 text-left text-sm', active === m.key ? 'border-rose-400 bg-rose-500/15' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
          <div className="flex items-center gap-2">
            <TokenAvatar artKey={`monstro:${m.key}`} color="#7f1d1d" size={30} />
            <span className="flex-1 font-semibold">{m.label}</span>
            <Badge>ND {m.cr}</Badge>
            <Badge color="sky">CA {m.ac}</Badge>
            <Badge color="rose">PV {m.hp}</Badge>
            <span role="button" tabIndex={0} title="Ver em 3D" onClick={(e) => { e.stopPropagation(); setView(m.key); }} className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs hover:bg-white/20">👁️ 3D</span>
          </div>
          <p className="text-xs text-slate-400">{m.attacks.map((a) => `${a.name} +${a.toHit} (${a.damage})`).join(' · ')}</p>
        </button>
      ))}
      <Modal open={!!view} onClose={() => setView(null)} title={`👁️ ${view ? MONSTERS[view]?.label : ''}`}>
        {view && (
          <>
            <Suspense fallback={<div className="flex h-[420px] items-center justify-center text-sm text-amber-200">Preparando o bestiário…</div>}>
              <HeroViewer monster={view} className="h-[420px]" />
            </Suspense>
            <p className="mt-2 text-sm text-slate-300">{MONSTERS[view]?.description}</p>
            <Button className="mt-2 w-full" variant="gold" onClick={() => { setTool({ kind: 'spawn', monsterKey: view, hidden }); setView(null); }}>👹 Invocar no mapa</Button>
          </>
        )}
      </Modal>
    </div>
  );
}

interface MapRow { id: string; name: string; preset: string | null; width: number; height: number }

/** Mapas padrão do livro, mapas salvos e editor (terreno, objetos, superfícies, elementos, destruição). */
export function MapPanel({ campaignId, state, tool, setTool }: { campaignId: string; state: ProjectedState; tool: Tool; setTool: (t: Tool) => void }) {
  const send = useTable((s) => s.send);
  const [presets, setPresets] = useState<{ key: string; name: string; description: string }[]>([]);
  const [maps, setMaps] = useState<MapRow[]>([]);
  const [element, setElement] = useState<Element>('fogo');
  const [radius, setRadius] = useState('1');
  const [damage, setDamage] = useState('2d6');
  const [dmgAmount, setDmgAmount] = useState('10');
  const [dmgType, setDmgType] = useState<DamageType>('concussao');
  const [blank, setBlank] = useState({ name: 'Mapa novo', width: '24', height: '16', terrain: 'grama' as TerrainType });
  const [gen, setGen] = useState({ kind: 'floresta' as MapKind, width: '28', height: '20', seed: '' });

  async function load() {
    try {
      const r = await api<{ presets: typeof presets; maps: MapRow[] }>(`/campaigns/${campaignId}/maps`);
      setPresets(r.presets);
      setMaps(r.maps);
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function usePreset(key: string) {
    const { map } = await api<{ map: MapState }>(`/rules/maps/${key}`);
    if (await send({ type: 'map.set', map })) toast(`Mapa carregado: ${map.name}`, 'sucesso');
  }
  async function useSaved(id: string) {
    const { map } = await api<{ map: MapState }>(`/campaigns/${campaignId}/maps/${id}`);
    await send({ type: 'map.set', map });
  }
  async function saveCurrent() {
    try {
      const m = state.map;
      if (m.id && maps.some((x) => x.id === m.id)) {
        await api(`/campaigns/${campaignId}/maps/${m.id}`, { method: 'PUT', json: m });
        toast('Mapa atualizado', 'sucesso');
      } else {
        const r = await api<{ map: MapState }>(`/campaigns/${campaignId}/maps`, { method: 'POST', json: { map: { ...m, id: null } } });
        await send({ type: 'map.set', map: { ...m, id: r.map.id } });
        toast('Mapa salvo na campanha', 'sucesso');
      }
      void load();
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }
  async function createBlank() {
    try {
      const r = await api<{ map: MapState }>(`/campaigns/${campaignId}/maps`, { method: 'POST', json: { name: blank.name, blank: { width: Number(blank.width), height: Number(blank.height), terrain: blank.terrain } } });
      await send({ type: 'map.set', map: r.map });
      void load();
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }
  async function removeMap(id: string) {
    await api(`/campaigns/${campaignId}/maps/${id}`, { method: 'DELETE' });
    void load();
  }

  const paint = tool.kind === 'paint' ? tool : null;

  return (
    <div className="space-y-4">
      <PaintMapCard campaignId={campaignId} state={state} />
      <section className="rounded-xl border border-emerald-400/30 bg-emerald-950/20 p-2">
        <p className="mb-1 text-sm font-semibold text-emerald-200">✨ Gerar mapa</p>
        <p className="mb-2 text-[11px] text-slate-400">Cria um mapa novo por semente: mesma semente = mesmo mapa. Depois dá para editar, salvar e destruir à vontade.</p>
        <Select label="Tipo" value={gen.kind} onChange={(v) => setGen({ ...gen, kind: v as MapKind })} options={MAP_KIND_KEYS.map((k) => ({ value: k, label: MAP_KINDS[k].label }))} />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Field label="Largura" type="number" value={gen.width} onChange={(e) => setGen({ ...gen, width: e.target.value })} />
          <Field label="Altura" type="number" value={gen.height} onChange={(e) => setGen({ ...gen, height: e.target.value })} />
          <Field label="Semente" value={gen.seed} onChange={(e) => setGen({ ...gen, seed: e.target.value })} placeholder="aleatória" />
        </div>
        <Button
          className="mt-2 w-full"
          variant="gold"
          onClick={() => void send({ type: 'map.generate', kind: gen.kind, width: Math.max(12, Math.min(48, Number(gen.width) || 28)), height: Math.max(10, Math.min(40, Number(gen.height) || 20)), seed: gen.seed.trim() || undefined })}
        >
          Gerar {MAP_KINDS[gen.kind].label}
        </Button>
        {state.map.seed && <p className="mt-1 text-[11px] text-slate-400">Mapa atual: semente <code>{state.map.seed}</code></p>}
        <div className="mt-2">
          <p className="mb-1 text-xs text-slate-300">Ambiente (luz)</p>
          <div className="flex flex-wrap gap-1">
            {(['dia', 'noite', 'caverna', 'submundo', 'olimpo'] as const).map((m) => (
              <button key={m} onClick={() => void send({ type: 'map.mood', mood: m })} className={cx('rounded-full border px-2 py-0.5 text-[11px]', (state.map.mood ?? 'dia') === m ? 'border-amber-400 bg-amber-500/20' : 'border-white/10')}>
                {{ dia: '☀️ Dia', noite: '🌙 Noite', caverna: '🕯️ Caverna', submundo: '💀 Submundo', olimpo: '🏛️ Olimpo' }[m]}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section>
        <p className="mb-1 text-sm font-semibold text-amber-200">Mapas do livro</p>
        <div className="grid gap-1">
          {presets.map((p) => (
            <button key={p.key} onClick={() => void usePreset(p.key)} className={cx('rounded-lg bg-white/5 p-2 text-left text-sm hover:bg-white/10', state.map.preset === p.key && 'ring-1 ring-amber-400')}>
              <strong>{p.name}</strong>
              <span className="block text-xs text-slate-400">{p.description}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-amber-200">Mapas da campanha</p>
          <Button size="sm" variant="subtle" onClick={() => void saveCurrent()}>💾 Salvar mapa atual</Button>
        </div>
        {maps.map((m) => (
          <div key={m.id} className="mb-1 flex items-center gap-2 rounded-lg bg-white/5 p-2 text-sm">
            <span className="flex-1">{m.name} <span className="text-xs text-slate-400">{m.width}×{m.height}</span></span>
            <Button size="sm" onClick={() => void useSaved(m.id)}>Usar</Button>
            <Button size="sm" variant="danger" onClick={() => void removeMap(m.id)}>×</Button>
          </div>
        ))}
        <div className="mt-2 grid grid-cols-[2fr_1fr_1fr] gap-1">
          <Field label="Novo mapa em branco" value={blank.name} onChange={(e) => setBlank({ ...blank, name: e.target.value })} />
          <Field label="Larg." type="number" value={blank.width} onChange={(e) => setBlank({ ...blank, width: e.target.value })} />
          <Field label="Alt." type="number" value={blank.height} onChange={(e) => setBlank({ ...blank, height: e.target.value })} />
        </div>
        <div className="mt-1 flex gap-1">
          <Select value={blank.terrain} onChange={(v) => setBlank({ ...blank, terrain: v })} options={(Object.keys(TERRAIN) as TerrainType[]).filter((t) => TERRAIN[t].walkable).map((t) => ({ value: t, label: TERRAIN[t].label }))} />
          <Button size="sm" onClick={() => void createBlank()}>Criar</Button>
        </div>
      </section>

      <section>
        <p className="mb-1 text-sm font-semibold text-amber-200">🖌️ Editor — terreno</p>
        <div className="grid grid-cols-4 gap-1">
          {(Object.keys(TERRAIN) as TerrainType[]).map((t) => (
            <button key={t} title={TERRAIN[t].label} onClick={() => setTool({ kind: 'paint', terrain: t })} className={cx('flex flex-col items-center rounded-md border p-1 text-[10px]', paint?.terrain === t ? 'border-amber-400' : 'border-white/10')}>
              <span className="h-5 w-full rounded" style={{ background: hex(TERRAIN[t].color) }} />
              {TERRAIN[t].label}
            </button>
          ))}
        </div>
        <p className="mb-1 mt-3 text-sm font-semibold text-amber-200">Objetos</p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(OBJECTS) as ObjectType[]).map((o) => (
            <Button key={o} size="sm" variant={paint?.object === o ? 'gold' : 'subtle'} onClick={() => setTool({ kind: 'paint', object: o })}>{OBJECTS[o].label}</Button>
          ))}
          <Button size="sm" variant={paint?.object === null ? 'gold' : 'ghost'} onClick={() => setTool({ kind: 'paint', object: null })}>Remover objeto</Button>
        </div>
        <p className="mb-1 mt-3 text-sm font-semibold text-amber-200">Superfícies</p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(SURFACES) as SurfaceType[]).map((s) => (
            <Button key={s} size="sm" variant={paint?.surface === s ? 'gold' : 'subtle'} onClick={() => setTool({ kind: 'paint', surface: s })}>{SURFACES[s].label}</Button>
          ))}
          <Button size="sm" variant={paint?.surface === null ? 'gold' : 'ghost'} onClick={() => setTool({ kind: 'paint', surface: null })}>Limpar</Button>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm font-semibold text-amber-200">🌪️ Elementos (reagem com superfícies)</p>
        <div className="grid grid-cols-3 gap-1">
          <Select value={element} onChange={setElement} options={(['fogo', 'agua', 'raio', 'gelo', 'veneno', 'oleo'] as Element[]).map((e) => ({ value: e, label: e }))} />
          <Field label="" type="number" value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="raio" />
          <Field label="" value={damage} onChange={(e) => setDamage(e.target.value)} placeholder="dano" />
        </div>
        <Button size="sm" variant={tool.kind === 'element' ? 'gold' : 'subtle'} className="w-full" onClick={() => setTool({ kind: 'element', element, radius: Math.max(0, Math.min(5, Number(radius) || 0)), damage })}>Usar elemento no clique</Button>

        <p className="pt-2 text-sm font-semibold text-amber-200">💥 Mapa destrutivo</p>
        <div className="grid grid-cols-2 gap-1">
          <Field label="" type="number" value={dmgAmount} onChange={(e) => setDmgAmount(e.target.value)} />
          <Select value={dmgType} onChange={setDmgType} options={DAMAGE_TYPES.map((d) => ({ value: d, label: d }))} />
        </div>
        <Button size="sm" variant={tool.kind === 'damage' ? 'gold' : 'danger'} className="w-full" onClick={() => setTool({ kind: 'damage', amount: Math.max(1, Number(dmgAmount) || 1), damageType: dmgType })}>Causar dano no clique</Button>
      </section>
    </div>
  );
}

interface MemberRow { userId: string; username: string; displayName: string | null; status: 'ativo' | 'banido'; characterName: string | null }

/** Jogadores: presença, pausar, banir/desbanir. */
export function PlayersPanel({ campaignId, state }: { campaignId: string; state: ProjectedState }) {
  const send = useTable((s) => s.send);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const load = () => api<{ members: MemberRow[] }>(`/campaigns/${campaignId}/members`).then((r) => setMembers(r.members)).catch(() => undefined);
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, Object.keys(state.players).length]);

  async function unban(userId: string) {
    await api(`/campaigns/${campaignId}/members/${userId}/unban`, { method: 'POST' });
    toast('Jogador desbanido', 'sucesso');
    void load();
  }

  return (
    <div className="space-y-2">
      {members.length === 0 && <p className="text-sm text-slate-400">Ninguém entrou ainda. Mostre o QR code para o grupo!</p>}
      {members.map((m) => {
        const live = state.players[m.userId];
        return (
          <div key={m.userId} className="rounded-lg bg-white/5 p-2 text-sm">
            <div className="flex items-center gap-2">
              <span className={cx('h-2.5 w-2.5 rounded-full', live?.connected ? 'bg-emerald-400' : 'bg-slate-600')} />
              <span className="flex-1 font-semibold">{m.displayName ?? m.username} <span className="font-normal text-slate-400">— {m.characterName ?? 'sem personagem'}</span></span>
              {m.status === 'banido' && <Badge color="rose">banido</Badge>}
              {live?.paused && <Badge color="violet">pausado</Badge>}
            </div>
            <div className="mt-2 flex gap-1">
              {m.status === 'ativo' && live && (
                <Button size="sm" variant="subtle" onClick={() => void send({ type: 'player.pause', userId: m.userId, paused: !live.paused })}>{live.paused ? '▶️ Liberar' : '⏸️ Pausar'}</Button>
              )}
              {m.status === 'ativo' && live && <Button size="sm" variant="danger" onClick={() => void send({ type: 'player.ban', userId: m.userId }).then(load)}>🚫 Banir</Button>}
              {m.status === 'banido' && <Button size="sm" variant="ghost" onClick={() => void unban(m.userId)}>Desbanir</Button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface SaveRow { id: string; name: string; kind: 'manual' | 'auto'; seq: number; createdAt: string }

/** Save/Load do estado completo da mesa. */
export function SavesPanel({ campaignId }: { campaignId: string }) {
  const [saves, setSaves] = useState<SaveRow[]>([]);
  const [name, setName] = useState('');
  const load = () => api<{ saves: SaveRow[] }>(`/campaigns/${campaignId}/saves`).then((r) => setSaves(r.saves)).catch(() => undefined);
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function save() {
    try {
      await api(`/campaigns/${campaignId}/saves`, { method: 'POST', json: { name: name || `Sessão ${new Date().toLocaleString('pt-BR')}` } });
      toast('Mesa salva!', 'sucesso');
      setName('');
      void load();
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }
  async function restore(s: SaveRow) {
    if (!confirm(`Carregar "${s.name}"? O estado atual será substituído (um autosave é feito periodicamente).`)) return;
    try {
      await api(`/campaigns/${campaignId}/saves/${s.id}/load`, { method: 'POST' });
      toast(`Save "${s.name}" carregado`, 'sucesso');
    } catch (e) {
      toast(errorMessage(e), 'erro');
    }
  }
  async function remove(id: string) {
    await api(`/campaigns/${campaignId}/saves/${id}`, { method: 'DELETE' });
    void load();
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do save" className="flex-1 rounded-lg border border-white/15 bg-slate-950 px-2 py-1.5 text-sm" />
        <Button size="sm" variant="gold" onClick={() => void save()}>💾 Salvar</Button>
      </div>
      <p className="text-xs text-slate-400">Salva posições, PV dos monstros, turnos, quests, capítulos, mapa destruído e histórico.</p>
      {saves.map((s) => (
        <div key={s.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-2 text-sm">
          <span className="flex-1">
            {s.name} {s.kind === 'auto' && <Badge>auto</Badge>}
            <span className="block text-xs text-slate-400">{new Date(s.createdAt).toLocaleString('pt-BR')} · seq {s.seq}</span>
          </span>
          <Button size="sm" onClick={() => void restore(s)}>Carregar</Button>
          <Button size="sm" variant="danger" onClick={() => void remove(s.id)}>×</Button>
        </div>
      ))}
    </div>
  );
}
