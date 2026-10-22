import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
  FIGURE_BASES, FIGURE_BASE_KEYS, FIGURE_OPTIONS, MONSTERS, SURFACES_3D, generateFigureRecipe, randomFigureSeed,
  type FigureBase, type FigureRecipe, type ProjectedState,
} from '@mesa/shared';
import { Badge, Button, Field, Modal, Select, cx, toast, useTable } from '@mesa/common';
import type { Tool } from '../tools';

const HeroViewer = lazy(() => import('@mesa/3d/HeroViewer'));

type Opts<T extends Record<string, string>> = { value: keyof T & string; label: string }[];
const opts = <T extends Record<string, string>>(o: T): Opts<T> => Object.entries(o).map(([value, label]) => ({ value, label }));

/** Bases que aceitam mais de uma cabeça (e até quantas). */
const MAX_HEADS: Partial<Record<FigureBase, number>> = { quadrupede: 3, serpente: 2, hidra: 9 };

function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => set(!on)} className={cx('rounded-full border px-2.5 py-1 text-xs', on ? 'border-amber-400 bg-amber-500/20 text-amber-100' : 'border-white/15 bg-white/5 text-slate-300')}>
      {on ? '✓ ' : ''}{label}
    </button>
  );
}

function ColorField({ label, value, set }: { label: string; value: string; set: (v: string) => void }) {
  return (
    <label className="flex flex-col items-center gap-1 text-[11px] text-slate-300">
      <input type="color" value={value} onChange={(e) => set(e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-white/15 bg-transparent" />
      {label}
    </label>
  );
}

/**
 * Oficina de bonecos: gera um boneco por base + semente (como o gerador de mapas),
 * ajusta partes, superfície e cores, vê em 3D e usa na campanha.
 */
export function FigureWorkshop({ open, onClose, state, start, selectedId, setTool }: {
  open: boolean; onClose: () => void; state: ProjectedState; start?: { id?: string; name?: string; recipe: FigureRecipe } | null;
  selectedId: string | null; setTool: (t: Tool) => void;
}) {
  const send = useTable((s) => s.send);
  const [base, setBase] = useState<FigureBase>('quadrupede');
  const [seed, setSeed] = useState(() => randomFigureSeed());
  const [rec, setRec] = useState<FigureRecipe>(() => generateFigureRecipe('quadrupede', seed));
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | undefined>();
  const [monsterKey, setMonsterKey] = useState('minotauro');
  const [fromBeast, setFromBeast] = useState('');

  useEffect(() => {
    if (!open) return;
    if (start) {
      setRec(start.recipe);
      setBase(start.recipe.base);
      setSeed(start.recipe.seed || randomFigureSeed());
      setName(start.name ?? '');
      setEditId(start.id);
    }
  }, [open, start]);

  const set = <K extends keyof FigureRecipe>(k: K, v: FigureRecipe[K]) => setRec((r) => ({ ...r, [k]: v }));
  const generate = (b = base, s = seed) => { setRec(generateFigureRecipe(b, s)); setEditId(undefined); };
  const reroll = () => { const s = randomFigureSeed(); setSeed(s); generate(base, s); };

  async function startFromBeast(key: string) {
    setFromBeast(key);
    if (!key) return;
    const mod = await import('@mesa/3d/monsters3d');
    const r = mod.defaultRecipeFor(key);
    if (!r) return toast('Esse monstro é humanoide: comece por "Humanoide" e ajuste a cabeça e as partes.', 'info');
    setRec({ ...r, seed: key });
    setBase(r.base);
    setName(MONSTERS[key]?.label ?? '');
    setMonsterKey(key);
  }

  const monsterOpts = useMemo(() => Object.values(MONSTERS).map((m) => ({ value: m.key, label: m.label })), []);
  const selected = selectedId ? state.tokens.find((t) => t.id === selectedId) : undefined;
  const heads = MAX_HEADS[rec.base];
  const humanoid = rec.base === 'humanoide';

  async function save() {
    const n = name.trim() || `${FIGURE_BASES[rec.base].label} ${rec.seed}`;
    if (await send({ type: 'figure.save', id: editId, name: n.slice(0, 40), recipe: rec })) toast(`🧌 "${n}" salvo na oficina`, 'sucesso');
  }

  return (
    <Modal open={open} onClose={onClose} title="🧌 Oficina de bonecos" wide>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <Suspense fallback={<div className="h-[520px] rounded-2xl bg-slate-950" />}>
            <HeroViewer recipe={rec} className="h-[520px]" />
          </Suspense>
          <p className="mt-2 text-[11px] text-slate-400">Arraste para girar · roda do mouse para aproximar · os botões embaixo testam as animações (é assim que ele anda e ataca no mapa).</p>
        </div>

        <div className="space-y-4 text-sm">
          {/* 1. Gerar */}
          <section className="rounded-xl border border-emerald-400/30 bg-emerald-950/20 p-3">
            <p className="mb-1 font-semibold text-emerald-200">✨ Gerar boneco</p>
            <p className="mb-2 text-[11px] text-slate-400">Como no gerador de mapas: a mesma semente gera sempre o mesmo boneco. Gere vários e fique com o que gostar.</p>
            <Select label="Base" value={base} onChange={(v) => { setBase(v as FigureBase); generate(v as FigureBase, seed); }} options={FIGURE_BASE_KEYS.map((k) => ({ value: k, label: `${FIGURE_BASES[k].label} · ${FIGURE_BASES[k].hint}` }))} />
            <div className="mt-2 grid grid-cols-[1fr_auto_auto] items-end gap-2">
              <Field label="Semente" value={seed} onChange={(e) => setSeed(e.target.value)} />
              <Button variant="subtle" onClick={reroll} title="Semente nova">🎲</Button>
              <Button variant="gold" onClick={() => generate()}>✨ Gerar</Button>
            </div>
            <Select className="mt-2" label="…ou começar de uma fera do bestiário" value={fromBeast} onChange={(v) => void startFromBeast(v)} options={[{ value: '', label: '—' }, ...monsterOpts]} />
          </section>

          {/* 2. Ajustes */}
          <section className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="mb-2 font-semibold text-amber-200">🎨 Ajustes</p>
            <div className="grid grid-cols-2 gap-2">
              <Select label="Superfície" value={rec.surface} onChange={(v) => set('surface', v as FigureRecipe['surface'])} options={opts(SURFACES_3D)} />
              <label className="text-xs text-slate-300">Tamanho ({rec.size.toFixed(2)}×)
                <input type="range" min={0.5} max={3} step={0.05} value={rec.size} onChange={(e) => set('size', Number(e.target.value))} className="w-full" />
              </label>
            </div>
            <div className="mt-2 flex justify-between">
              <ColorField label="Corpo" value={rec.color} set={(v) => set('color', v)} />
              <ColorField label="Detalhes" value={rec.accent} set={(v) => set('accent', v)} />
              <ColorField label={humanoid ? 'Cabelo' : 'Barriga'} value={rec.belly} set={(v) => set('belly', v)} />
              <ColorField label="Olhos" value={rec.eyes} set={(v) => set('eyes', v)} />
            </div>
            {humanoid && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Select label="Corpo" value={rec.body} onChange={(v) => set('body', v as FigureRecipe['body'])} options={opts(FIGURE_OPTIONS.body)} />
                <Select label="Cabeça" value={rec.head} onChange={(v) => set('head', v as FigureRecipe['head'])} options={opts(FIGURE_OPTIONS.head)} />
                <Select label="Arma" value={rec.weapon} onChange={(v) => set('weapon', v as FigureRecipe['weapon'])} options={opts(FIGURE_OPTIONS.weapon)} />
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Select label="Chifres" value={rec.horns} onChange={(v) => set('horns', v as FigureRecipe['horns'])} options={opts(FIGURE_OPTIONS.horns)} />
              <Select label="Asas" value={rec.wings} onChange={(v) => set('wings', v as FigureRecipe['wings'])} options={opts(FIGURE_OPTIONS.wings)} />
              {rec.base !== 'ave' && rec.base !== 'golem' && rec.base !== 'serpente' && <Select label="Cauda" value={rec.tail} onChange={(v) => set('tail', v as FigureRecipe['tail'])} options={opts(FIGURE_OPTIONS.tail)} />}
              <Select label="Aura" value={rec.aura} onChange={(v) => set('aura', v as FigureRecipe['aura'])} options={opts(FIGURE_OPTIONS.aura)} />
              {heads && (
                <label className="text-xs text-slate-300">Cabeças ({rec.heads})
                  <input type="range" min={rec.base === 'hidra' ? 2 : 1} max={heads} step={1} value={Math.min(rec.heads, heads)} onChange={(e) => set('heads', Number(e.target.value))} className="w-full" />
                </label>
              )}
              {rec.base === 'aranha' && <Select label="Patas" value={String(rec.legs)} onChange={(v) => set('legs', Number(v))} options={[{ value: '8', label: '8 patas' }, { value: '6', label: '6 patas' }]} />}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {!humanoid && <Toggle label="Espinhos" on={rec.spikes} set={(v) => set('spikes', v)} />}
              {rec.base === 'quadrupede' && <Toggle label="Juba" on={rec.mane} set={(v) => set('mane', v)} />}
              {!humanoid && <Toggle label="Armadura de bronze" on={rec.armor} set={(v) => set('armor', v)} />}
              <Toggle label="Olhos brilhando" on={rec.glow} set={(v) => set('glow', v)} />
              {humanoid && <Toggle label="Escudo" on={rec.shield} set={(v) => set('shield', v)} />}
              {humanoid && <Toggle label="Metade serpente" on={rec.serpentLegs} set={(v) => set('serpentLegs', v)} />}
            </div>
          </section>

          {/* 3. Salvar e usar */}
          <section className="rounded-xl border border-amber-400/30 bg-amber-950/20 p-3">
            <p className="mb-2 font-semibold text-amber-200">💾 Salvar e usar</p>
            <div className="grid grid-cols-[1fr_auto] items-end gap-2">
              <Field label="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lobo de Ares" />
              <Button variant="gold" onClick={() => void save()}>{editId ? '💾 Atualizar boneco' : '💾 Salvar boneco'}</Button>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-2">
              <Select label="Monstro (regras e ficha)" value={monsterKey} onChange={setMonsterKey} options={monsterOpts} />
              <Button variant="subtle" onClick={() => void send({ type: 'figure.assign', monsterKey, recipe: rec }).then((ok) => ok && toast(`Todo ${MONSTERS[monsterKey]?.label} desta campanha agora tem este visual`, 'sucesso'))}>Usar na espécie</Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" variant="gold" onClick={() => { setTool({ kind: 'spawn', monsterKey, hidden: false, figure: rec }); onClose(); toast('Clique no mapa para invocar', 'info'); }}>👹 Invocar no mapa</Button>
              <Button size="sm" variant="subtle" disabled={!selected} onClick={() => selected && void send({ type: 'figure.assign', tokenId: selected.id, recipe: rec }).then((ok) => ok && toast(`${selected.name} ganhou o visual`, 'sucesso'))}>
                {selected ? `🎭 Aplicar em ${selected.name}` : '🎭 Selecione um token no mapa'}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-slate-400">O visual não muda as regras: PV, ataques e CA continuam os do monstro escolhido.</p>
          </section>
        </div>
      </div>
    </Modal>
  );
}

/** Aba 🧌 Bonecos: biblioteca da oficina e visuais da campanha. */
export function FiguresPanel({ state, selectedId, setTool }: { state: ProjectedState; selectedId: string | null; setTool: (t: Tool) => void }) {
  const send = useTable((s) => s.send);
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<{ id?: string; name?: string; recipe: FigureRecipe } | null>(null);
  const figures = state.figures ?? [];
  const looks = Object.entries(state.monsterLooks ?? {});
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-950/20 p-3 text-sm">
        <p className="font-semibold text-emerald-200">🧌 Oficina de bonecos</p>
        <p className="mt-1 text-xs text-slate-300">Gere monstros e criaturas novos (fera, serpente, hidra, aranha, ave, marinho, golem ou humanoide), com pelo, escamas, penas, pedra ou bronze, chifres, asas, caudas e auras. Use numa espécie inteira ou num token só.</p>
        <Button className="mt-2 w-full" variant="gold" onClick={() => { setStart(null); setOpen(true); }}>✨ Abrir a oficina</Button>
      </div>

      <div>
        <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">Bonecos salvos ({figures.length})</p>
        {figures.length === 0 && <p className="text-xs text-slate-400">Nenhum ainda. Gere um na oficina e clique em Salvar.</p>}
        <div className="space-y-1">
          {figures.map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-lg bg-white/5 p-2 text-sm">
              <span className="h-6 w-6 shrink-0 rounded-full border border-white/20" style={{ background: `linear-gradient(135deg, ${f.recipe.color} 50%, ${f.recipe.accent} 50%)` }} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{f.name}</p>
                <p className="truncate text-[11px] text-slate-400">{FIGURE_BASES[f.recipe.base].label} · {SURFACES_3D[f.recipe.surface]}</p>
              </div>
              <Button size="sm" variant="subtle" onClick={() => { setStart({ id: f.id, name: f.name, recipe: f.recipe }); setOpen(true); }}>✏️</Button>
              <Button size="sm" variant="ghost" onClick={() => { setTool({ kind: 'spawn', monsterKey: 'minotauro', hidden: false, figure: f.recipe }); toast('Clique no mapa (usa as regras do Minotauro; para outras, abra ✏️)', 'info'); }} title="Invocar">👹</Button>
              <Button size="sm" variant="danger" onClick={() => void send({ type: 'figure.delete', id: f.id })}>🗑️</Button>
            </div>
          ))}
        </div>
      </div>

      {looks.length > 0 && (
        <div>
          <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">Espécies com visual próprio</p>
          {looks.map(([key, r]) => (
            <div key={key} className="flex items-center gap-2 rounded-lg bg-white/5 p-2 text-sm">
              <span className="h-5 w-5 rounded-full" style={{ background: r.color }} />
              <span className="flex-1">{MONSTERS[key]?.label ?? key} <Badge color="violet">{FIGURE_BASES[r.base].label}</Badge></span>
              <Button size="sm" variant="ghost" onClick={() => void send({ type: 'figure.assign', monsterKey: key, recipe: null })}>↩️ Padrão</Button>
            </div>
          ))}
        </div>
      )}

      <FigureWorkshop open={open} onClose={() => setOpen(false)} state={state} start={start} selectedId={selectedId} setTool={setTool} />
    </div>
  );
}
