import { useEffect, useState } from 'react';
import {
  DAMAGE_TYPES, MONSTERS, OBJECTS, SURFACES, TERRAIN, type DamageType, type Element, type MapState, type ObjectType, type ProjectedState,
  type SurfaceType, type TerrainType,
} from '@mesa/shared';
import { Badge, Button, Field, Select, api, cx, errorMessage, toast, useTable, TokenAvatar } from '@mesa/common';
import type { Tool } from '../tools';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Injeção de monstros em tempo real. */
export function MonstersPanel({ tool, setTool }: { tool: Tool; setTool: (t: Tool) => void }) {
  const [hidden, setHidden] = useState(false);
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
          </div>
          <p className="text-xs text-slate-400">{m.attacks.map((a) => `${a.name} +${a.toHit} (${a.damage})`).join(' · ')}</p>
        </button>
      ))}
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
