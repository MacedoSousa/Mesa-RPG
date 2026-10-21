import { useState } from 'react';
import {
  ABILITIES, ABILITY_LABELS, AFFIXES, ITEMS, LOOT_TABLES, RANKS, SKILLS, affixFits, checkLabel, getItem, rankedKey, xpForNextLevel,
  type CheckKind, type LootEntry, type LootTier, type ProjectedState, type Token,
} from '@mesa/shared';
import { Badge, Button, Card, Field, ItemName, Select, cx, useTable } from '@mesa/common';
import type { Tool } from '../tools';

/** Painel do Mestre: pedir testes, dar recompensas e esconder baús. */
export function TablePanel({ state, selectedId, setTool }: { state: ProjectedState; selectedId: string | null; setTool: (t: Tool) => void }) {
  return (
    <div className="space-y-3">
      <RestCard />
      <ChecksCard state={state} />
      <RewardCard state={state} selectedId={selectedId} />
      <ForgeCard state={state} selectedId={selectedId} setTool={setTool} />
      <ChestCard state={state} setTool={setTool} />
    </div>
  );
}

function RestCard() {
  const send = useTable((s) => s.send);
  return (
    <Card title="🛏️ Descanso do grupo">
      <div className="grid grid-cols-2 gap-2">
        <Button variant="subtle" onClick={() => void send({ type: 'party.rest', kind: 'curto' })}>☕ Curto (1 h)</Button>
        <Button variant="subtle" onClick={() => void send({ type: 'party.rest', kind: 'longo' })}>🌙 Longo (noite)</Button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Curto: +¼ do PV máximo e metade da Estamina. Longo: tudo cheio e condições removidas. Fora de combate.</p>
    </Card>
  );
}

const DC_PRESETS = [
  { dc: 5, label: 'Muito fácil' }, { dc: 10, label: 'Fácil' }, { dc: 15, label: 'Médio' }, { dc: 20, label: 'Difícil' }, { dc: 25, label: 'Muito difícil' },
];

function ChecksCard({ state }: { state: ProjectedState }) {
  const send = useTable((s) => s.send);
  const heroes = state.tokens.filter((t) => t.kind === 'personagem' && t.ownerUserId && !t.dead && !t.hidden) as Token[];
  const [who, setWho] = useState<'todos' | string>('todos');
  const [kind, setKind] = useState<CheckKind>('pericia');
  const [key, setKey] = useState('percepcao');
  const [dc, setDc] = useState(10);
  const [secret, setSecret] = useState(false);
  const [label, setLabel] = useState('');
  const options = kind === 'pericia'
    ? Object.entries(SKILLS).map(([k, v]) => ({ value: k, label: `${v.label} (${ABILITY_LABELS[v.ability].short})` }))
    : ABILITIES.map((a) => ({ value: a, label: ABILITY_LABELS[a].label }));
  const checks = [...(state.checks ?? [])].reverse();

  return (
    <Card title="🎯 Pedir um teste">
      <p className="mb-2 text-xs text-slate-400">O jogador recebe um aviso no celular e rola pelo app; o modificador certo (atributo + treino) é somado sozinho.</p>
      <div className="grid grid-cols-2 gap-2">
        <Select label="Quem" value={who} onChange={setWho} options={[{ value: 'todos', label: 'Todos os heróis' }, ...heroes.map((h) => ({ value: h.ownerUserId!, label: h.name }))]} />
        <Select
          label="Tipo"
          value={kind}
          onChange={(v) => {
            setKind(v as CheckKind);
            setKey(v === 'pericia' ? 'percepcao' : 'sabedoria');
          }}
          options={[{ value: 'pericia', label: 'Perícia' }, { value: 'atributo', label: 'Atributo' }, { value: 'resistencia', label: 'Resistência' }]}
        />
        <Select label={kind === 'pericia' ? 'Perícia' : 'Atributo'} value={key} onChange={setKey} options={options} />
        <Field label="CD" type="number" value={String(dc)} onChange={(e) => setDc(Math.max(1, Math.min(40, Number(e.target.value) || 10)))} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {DC_PRESETS.map((p) => (
          <button key={p.dc} onClick={() => setDc(p.dc)} className={cx('rounded-full border px-2 py-0.5 text-[11px]', dc === p.dc ? 'border-amber-400 bg-amber-500/20' : 'border-white/10')}>
            {p.label} {p.dc}
          </button>
        ))}
      </div>
      <Field className="mt-2" label="Motivo (opcional)" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ouvir passos na floresta" />
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={secret} onChange={(e) => setSecret(e.target.checked)} /> Esconder a CD dos jogadores</label>
      <Button
        className="mt-2 w-full"
        variant="gold"
        disabled={!heroes.length}
        onClick={() => {
          void send({ type: 'check.request', userIds: who === 'todos' ? 'todos' : [who], kind, key, dc, secretDc: secret, label: label || undefined });
          setLabel('');
        }}
      >
        Pedir {checkLabel(kind, key)} CD {dc}
      </Button>
      {checks.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">Resultados</p>
            <button className="text-[11px] text-slate-500 hover:text-white" onClick={() => void send({ type: 'check.clear' })}>limpar resolvidos</button>
          </div>
          {checks.map((c) => {
            const hero = state.tokens.find((t) => t.id === c.tokenId);
            return (
              <div key={c.id} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-xs">
                <span className="flex-1">{hero?.name ?? '?'} · {checkLabel(c.kind, c.key)} CD {c.dc}</span>
                {c.status === 'pendente' ? (
                  <>
                    <Badge color="amber">aguardando</Badge>
                    <button className="text-[11px] text-sky-300 hover:underline" onClick={() => void send({ type: 'check.roll', checkId: c.id, advantage: 'normal' })}>rolar por ele</button>
                  </>
                ) : (
                  <Badge color={c.status === 'sucesso' ? 'emerald' : 'rose'}>{c.total} · {c.status}</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function RewardCard({ state, selectedId }: { state: ProjectedState; selectedId: string | null }) {
  const send = useTable((s) => s.send);
  const heroes = state.tokens.filter((t) => t.kind === 'personagem' && t.characterId && !t.dead) as Token[];
  const selectedHero = heroes.find((h) => h.id === selectedId);
  const [who, setWho] = useState<'todos' | 'selecionado'>('todos');
  const [xp, setXp] = useState('0');
  const [dracmas, setDracmas] = useState('0');
  const [itemKey, setItemKey] = useState('');
  const [qty, setQty] = useState('1');
  const [items, setItems] = useState<LootEntry[]>([]);
  const [reason, setReason] = useState('');
  const targets = who === 'selecionado' && selectedHero ? [selectedHero.id] : 'todos';

  return (
    <Card title="🎁 Recompensas e XP">
      <p className="mb-2 text-xs text-slate-400">Monstros derrotados e quests concluídas já dão XP sozinhos. Use aqui para bônus: boa ideia, boa interpretação, marco da história.</p>
      <div className="mb-2 space-y-1">
        {heroes.map((h) => {
          const next = xpForNextLevel(h.level ?? 1);
          return (
            <div key={h.id} className="flex items-center gap-2 text-xs">
              <span className="flex-1">{h.name}</span>
              <Badge color="violet">Nível {h.level ?? 1}</Badge>
              {next && <span className="text-slate-400">próximo: {next} XP</span>}
            </div>
          );
        })}
      </div>
      <Select label="Para" value={who} onChange={(v) => setWho(v as 'todos' | 'selecionado')} options={[{ value: 'todos', label: 'Todos os heróis' }, { value: 'selecionado', label: selectedHero ? `Só ${selectedHero.name} (selecionado)` : 'Só o herói selecionado no mapa' }]} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Field label="XP" type="number" value={xp} onChange={(e) => setXp(e.target.value)} />
        <Field label="Dracmas" type="number" value={dracmas} onChange={(e) => setDracmas(e.target.value)} />
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {[25, 50, 100, 300].map((v) => <button key={v} className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] hover:bg-white/10" onClick={() => setXp(String(v))}>{v} XP</button>)}
      </div>
      <div className="mt-2 grid grid-cols-[1fr_70px_auto] items-end gap-2">
        <Select label="Item" value={itemKey} onChange={setItemKey} options={[{ value: '', label: '—' }, ...Object.values(ITEMS).filter((i) => i.key !== 'dracmas').map((i) => ({ value: i.key, label: i.name }))]} />
        <Field label="Qtd." type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Button size="sm" disabled={!itemKey} onClick={() => { setItems([...items, { itemKey, quantity: Math.max(1, Number(qty) || 1) }]); setItemKey(''); }}>+</Button>
      </div>
      {items.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {items.map((i, idx) => (
            <button key={idx} onClick={() => setItems(items.filter((_, j) => j !== idx))} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{i.quantity}× {getItem(i.itemKey)?.name} ✕</button>
          ))}
        </div>
      )}
      <Field className="mt-2" label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Convenceram o centauro sem lutar" />
      <Button
        className="mt-2 w-full"
        variant="gold"
        disabled={(who === 'selecionado' && !selectedHero) || (!Number(xp) && !Number(dracmas) && !items.length)}
        onClick={() => {
          void send({ type: 'reward.grant', tokenIds: targets, xp: Math.max(0, Number(xp) || 0), dracmas: Math.max(0, Number(dracmas) || 0), items, reason: reason || 'Mestre' });
          setItems([]);
          setReason('');
        }}
      >
        Entregar recompensa
      </Button>
      <TakeItem targets={targets} />
    </Card>
  );
}

function ChestCard({ state, setTool }: { state: ProjectedState; setTool: (t: Tool) => void }) {
  const send = useTable((s) => s.send);
  const lootOn = (state as { options?: { monsterLoot?: boolean } }).options?.monsterLoot !== false;
  const [mode, setMode] = useState<'tabela' | 'manual'>('tabela');
  const [tier, setTier] = useState<LootTier>('comum');
  const [lock, setLock] = useState('');
  const [itemKey, setItemKey] = useState('pocao_cura');
  const [qty, setQty] = useState('1');
  const [items, setItems] = useState<LootEntry[]>([]);
  const [dracmas, setDracmas] = useState('10');

  return (
    <Card title="🧰 Baú de tesouro">
      <p className="mb-2 text-xs text-slate-400">Escolha o conteúdo e clique no mapa. Os jogadores veem o baú, mas não o que tem dentro. Para abrir, o herói fica ao lado e usa "Abrir baú".</p>
      <Select label="Conteúdo" value={mode} onChange={(v) => setMode(v as 'tabela' | 'manual')} options={[{ value: 'tabela', label: 'Sortear por tabela' }, { value: 'manual', label: 'Montar à mão' }]} />
      {mode === 'tabela' ? (
        <Select className="mt-2" label="Tabela" value={tier} onChange={(v) => setTier(v as LootTier)} options={Object.entries(LOOT_TABLES).map(([k, t]) => ({ value: k, label: t.label }))} />
      ) : (
        <>
          <div className="mt-2 grid grid-cols-[1fr_70px_auto] items-end gap-2">
            <Select label="Item" value={itemKey} onChange={setItemKey} options={Object.values(ITEMS).filter((i) => i.key !== 'dracmas').map((i) => ({ value: i.key, label: i.name }))} />
            <Field label="Qtd." type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
            <Button size="sm" onClick={() => setItems([...items, { itemKey, quantity: Math.max(1, Number(qty) || 1) }])}>+</Button>
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {items.map((i, idx) => (
              <button key={idx} onClick={() => setItems(items.filter((_, j) => j !== idx))} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px]">{i.quantity}× {getItem(i.itemKey)?.name} ✕</button>
            ))}
          </div>
          <Field className="mt-2" label="Dracmas" type="number" value={dracmas} onChange={(e) => setDracmas(e.target.value)} />
        </>
      )}
      <Field className="mt-2" label="Trancado? CD para abrir (vazio = aberto)" type="number" value={lock} onChange={(e) => setLock(e.target.value)} placeholder="12" />
      <Button
        className="mt-2 w-full"
        variant="gold"
        onClick={() => setTool({
          kind: 'chest',
          loot: mode === 'manual' ? items : [],
          dracmas: mode === 'manual' ? Math.max(0, Number(dracmas) || 0) : 0,
          lockDc: Number(lock) >= 5 ? Number(lock) : null,
          tier: mode === 'tabela' ? tier : undefined,
        })}
      >
        🧰 Clicar no mapa para colocar o baú
      </Button>
      <label className="mt-3 flex items-center gap-2 border-t border-white/10 pt-2 text-sm">
        <input type="checkbox" checked={lootOn} onChange={(e) => void send({ type: 'table.options', monsterLoot: e.target.checked })} />
        💰 Monstros derrotados deixam espólio (chance maior nos fortes)
      </label>
    </Card>
  );
}

/** Cobrar um item ou dracmas (ex.: Caronte cobra 10 dracmas de cada um). */
function TakeItem({ targets }: { targets: string[] | 'todos' }) {
  const send = useTable((s) => s.send);
  const [itemKey, setItemKey] = useState('dracmas');
  const [qty, setQty] = useState('10');
  return (
    <div className="mt-3 border-t border-white/10 pt-2">
      <p className="text-xs font-semibold text-slate-300">💸 Cobrar / tirar do inventário</p>
      <div className="mt-1 grid grid-cols-[1fr_70px_auto] items-end gap-2">
        <Select label="Item" value={itemKey} onChange={setItemKey} options={Object.values(ITEMS).map((i) => ({ value: i.key, label: i.name }))} />
        <Field label="Qtd." type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
        <Button size="sm" variant="danger" onClick={() => void send({ type: 'item.take', tokenIds: targets, itemKey, quantity: Math.max(1, Number(qty) || 1), reason: 'Cobrança' })}>Cobrar</Button>
      </div>
    </div>
  );
}

/** Forja de Hefesto: o Mestre cria uma arma/armadura com rank e encantamento. */
function ForgeCard({ state, selectedId, setTool }: { state: ProjectedState; selectedId: string | null; setTool: (t: Tool) => void }) {
  const send = useTable((s) => s.send);
  const heroes = state.tokens.filter((t) => t.kind === 'personagem' && t.characterId && !t.dead) as Token[];
  const selectedHero = heroes.find((h) => h.id === selectedId);
  const gear = Object.values(ITEMS).filter((i) => i.kind === 'arma' || i.kind === 'armadura' || i.kind === 'escudo');
  const [base, setBase] = useState('espada_longa');
  const [rank, setRank] = useState(1);
  const [affix, setAffix] = useState('');
  const [cost, setCost] = useState('0');
  const baseItem = ITEMS[base];
  const affixes = baseItem ? Object.values(AFFIXES).filter((a) => affixFits(a, baseItem)) : [];
  const validAffix = affixes.some((a) => a.key === affix) ? affix : '';
  const key = rankedKey(base, rank, validAffix || null);
  const item = getItem(key);

  function give() {
    if (!selectedHero) return;
    void send({ type: 'reward.grant', tokenIds: [selectedHero.id], xp: 0, dracmas: 0, items: [{ itemKey: key, quantity: 1 }], reason: 'Forja de Hefesto' });
    const price = Math.max(0, Number(cost) || 0);
    if (price) void send({ type: 'item.take', tokenIds: [selectedHero.id], itemKey: 'dracmas', quantity: price, reason: 'Forja de Hefesto' });
  }

  return (
    <Card title="🔨 Forja de Hefesto (ranks e encantamentos)">
      <p className="mb-2 text-xs text-slate-400">
        Crie uma arma ou armadura melhor para dar de recompensa, vender na loja ou esconder num baú. Ranks: {RANKS.slice(1).map((r) => <span key={r.rank} style={{ color: r.color }}>{r.label} +{r.bonus} (nível {r.minLevel}) </span>)}
      </p>
      <Select label="Item base" value={base} onChange={setBase} options={gear.map((i) => ({ value: i.key, label: i.name }))} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select label="Rank" value={String(rank)} onChange={(v) => setRank(Number(v))} options={RANKS.map((r) => ({ value: String(r.rank), label: `${r.label}${r.bonus ? ` +${r.bonus}` : ''}` }))} />
        <Select label="Encantamento" value={validAffix} onChange={setAffix} options={[{ value: '', label: '— nenhum —' }, ...affixes.map((a) => ({ value: a.key, label: a.label }))]} />
      </div>
      {item && (
        <div className="mt-2 rounded-lg bg-white/5 p-2 text-sm">
          <ItemName item={item} />
          <p className="text-xs text-slate-400">{item.description}</p>
          <p className="mt-1 text-[11px] text-slate-400">Valor sugerido: {item.value} dracmas · exige nível {item.minLevel ?? 1}</p>
        </div>
      )}
      <Field className="mt-2" label="Cobrar dracmas do herói (0 = presente)" type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="gold" disabled={!item || !selectedHero} onClick={give}>{selectedHero ? `🎁 Dar a ${selectedHero.name}` : 'Selecione um herói'}</Button>
        <Button variant="subtle" disabled={!item} onClick={() => setTool({ kind: 'chest', loot: [{ itemKey: key, quantity: 1 }], dracmas: 0, lockDc: null })}>🧰 Pôr num baú</Button>
      </div>
    </Card>
  );
}
