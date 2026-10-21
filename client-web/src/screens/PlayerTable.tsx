import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ABILITIES, ABILITY_LABELS, ITEMS, SKILLS, TERRAIN, checkLabel, checkModifier, d20Formula, formatModifier, gridDistance, reachableCells,
  type AdvantageState, type LogEntry, type PendingCheck, type ProjectedState, type Skill, type TableState, type Token,
} from '@mesa/shared';
import {
  Badge, Bar, Button, LogFeed, MapCanvas, Spinner, Term, api, cx, navigate, toast, useSession, useTable,
  type Cell, type Highlight, TokenAvatar, artKeyFor, isPortraitSpec, portraitUrl } from '@mesa/common';
import type { CharacterDTO } from '../types';
import { GuideContent } from './Guide';

type Tab = 'acoes' | 'dados' | 'itens' | 'historico' | 'guia';
type Mode = 'mover' | 'atacar' | 'cenario' | 'empurrar' | 'poder' | 'bau' | null;

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'acoes', icon: '⚔️', label: 'Ações' },
  { key: 'dados', icon: '🎲', label: 'Dados' },
  { key: 'itens', icon: '🎒', label: 'Itens' },
  { key: 'historico', icon: '📜', label: 'Histórico' },
  { key: 'guia', icon: '📘', label: 'Guia' },
];

function useCountdown(enabled: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [enabled]);
}

export function PlayerTable({ campaignId }: { campaignId: string }) {
  const user = useSession((s) => s.user)!;
  const { state, status, kicked, connect, disconnect, send } = useTable();
  const [tab, setTab] = useState<Tab | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [attackIndex, setAttackIndex] = useState(0);
  const [character, setCharacter] = useState<CharacterDTO | null>(null);

  useEffect(() => {
    connect(campaignId);
    return () => disconnect();
  }, [campaignId, connect, disconnect]);

  const me = state?.tokens.find((t) => t.ownerUserId === user.id) as Token | undefined;
  const myCharId = me?.characterId;

  useEffect(() => {
    if (!myCharId) return;
    api<{ character: CharacterDTO }>(`/characters/${myCharId}`).then((r) => setCharacter(r.character)).catch(() => undefined);
  }, [myCharId]);

  useCountdown(!!state?.sideQuests.some((q) => q.status === 'ativa' && q.expiresAt));

  // Aviso de dano/cura no próprio personagem (o PV já é descontado sozinho pelo servidor)
  const prevHp = useRef<number | null>(null);
  useEffect(() => {
    if (!me) return;
    const before = prevHp.current;
    prevHp.current = me.hp;
    if (before === null || before === me.hp) return;
    if (me.hp < before) toast(`💥 Você sofreu ${before - me.hp} de dano! PV ${me.hp}/${me.maxHp}`, 'erro');
    else toast(`💚 Você recuperou ${me.hp - before} PV! PV ${me.hp}/${me.maxHp}`, 'sucesso');
  }, [me?.hp, me?.maxHp, me]);

  if (kicked) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl">🚫</div>
        <p className="text-lg">{kicked}</p>
        <Button onClick={() => navigate('/')}>Voltar ao início</Button>
      </div>
    );
  }
  if (!state) return <Spinner label={status === 'erro' ? 'Não foi possível entrar na mesa' : 'Entrando na mesa...'} />;

  const combat = state.combat;
  const myTurn = !!combat && !!me && combat.currentTokenId === me.id;
  const canAct = !!me && !state.paused && !state.players[user.id]?.paused && (!combat || myTurn);
  const economy = me && combat ? combat.economy[me.id] : null;
  const currentName = combat?.currentTokenId === '__oculto__' ? '???' : state.tokens.find((t) => t.id === combat?.currentTokenId)?.name;
  const activeChapter = state.chapters.find((c) => c.id === state.activeChapterId);
  const myChecks = (state.checks ?? []).filter((c) => c.userId === user.id && c.status === 'pendente');

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden">
      {/* ── Barra flutuante de PV/Estamina e turno ── */}
      <div className="absolute inset-x-2 top-2 z-20 space-y-2">
        <div className="rounded-xl border border-white/10 bg-slate-950/85 p-2 shadow-xl backdrop-blur">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="rounded-lg px-1 text-lg" aria-label="Sair da mesa">←</button>
            {me && (isPortraitSpec(me.face)
              ? <img src={portraitUrl(me.face, 72)} width={38} height={38} className="rounded-full border-2" style={{ borderColor: me.color }} alt="" />
              : <TokenAvatar artKey={artKeyFor(me)} color={me.color} size={34} title={me.emblem} />)}
            {me ? (
              <div className="grid flex-1 grid-cols-2 gap-2">
                <Bar label={`❤️ ${me.name}`} value={me.hp as number} max={me.maxHp as number} color="bg-rose-500" />
                <Bar label="⚡ Estamina" value={me.stamina} max={me.maxStamina} color="bg-amber-400" />
              </div>
            ) : <span className="flex-1 text-sm text-slate-300">Aguardando seu personagem...</span>}
            <span title={status} className={cx('h-2.5 w-2.5 rounded-full', status === 'conectado' ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse')} />
          </div>
          {me && (
            <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
              <Badge color="sky">🛡️ <Term k="ca">CA</Term> {me.ac}</Badge>
              <Badge color="violet">⭐ Nível {me.level ?? 1}</Badge>
              {me.conditions.map((c) => <Badge key={c} color="rose">{c}</Badge>)}
              {economy && (
                <>
                  <Badge color={economy.action ? 'emerald' : 'slate'}><Term k="acao">Ação</Term> {economy.action}</Badge>
                  <Badge color={economy.bonusAction ? 'emerald' : 'slate'}><Term k="acao_bonus">Bônus</Term> {economy.bonusAction}</Badge>
                  <Badge color={economy.reaction ? 'emerald' : 'slate'}><Term k="reacao">Reação</Term> {economy.reaction}</Badge>
                  <Badge color="amber"><Term k="movimento">Mov.</Term> {economy.movement}</Badge>
                </>
              )}
            </div>
          )}
        </div>
        {myChecks.map((c) => (
          <div key={c.id} className="rounded-lg border border-amber-400 bg-amber-950/95 p-2 text-sm shadow-lg">
            <p className="font-semibold">🎯 O Mestre pede: {checkLabel(c.kind, c.key)}{c.dc ? ` CD ${c.dc}` : ''}{c.label ? ` — ${c.label}` : ''}</p>
            <p className="text-xs text-amber-100/80">Toque para rolar 1d20 + seu modificador{me && ` (${formatModifier(checkModifier(me, c.kind, c.key).mod)})`}.</p>
            <div className="mt-1 grid grid-cols-3 gap-1">
              <Button size="sm" variant="gold" onClick={() => void send({ type: 'check.roll', checkId: c.id, advantage: 'normal' })}>🎲 Rolar</Button>
              <Button size="sm" variant="subtle" onClick={() => void send({ type: 'check.roll', checkId: c.id, advantage: 'vantagem' })}>com vantagem</Button>
              <Button size="sm" variant="ghost" onClick={() => void send({ type: 'check.roll', checkId: c.id, advantage: 'desvantagem' })}>desvantagem</Button>
            </div>
          </div>
        ))}
        {me && me.hp === 0 && !me.dead && me.deathSaves && (
          <div className="rounded-lg bg-violet-950/95 p-2 text-center text-sm">
            😵 Você está caído! No seu turno o app rola a <Term k="morte">salvaguarda contra a morte</Term>: ✔ {me.deathSaves.successes}/3 · ✖ {me.deathSaves.failures}/3{me.deathSaves.stable ? ' · estável' : ''}. Peça para um aliado te curar!
          </div>
        )}
        {(state.paused || state.players[user.id]?.paused) && <div className="rounded-lg bg-violet-900/90 p-2 text-center text-sm font-semibold">⏸️ {state.paused ? 'O Mestre pausou a mesa' : 'O Mestre pausou você por um momento'}</div>}
        {combat && (
          <div className={cx('rounded-lg p-2 text-center text-sm font-bold shadow-lg', myTurn ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-slate-900/90')}>
            {myTurn ? '⚔️ É O SEU TURNO!' : `Rodada ${combat.round} · Turno de ${currentName ?? '...'}`}
          </div>
        )}
        {mode && <ModeHint mode={mode} onCancel={() => setMode(null)} />}
      </div>

      {/* ── Mapa ── */}
      <div className="relative flex-1">
        <MapCanvas
          state={state}
          focusTokenId={me?.id}
          selectedTokenId={me?.id}
          highlights={me && canAct ? highlightsFor(state, me, mode, attackIndex, economy?.movement) : []}
          onCellClick={(cell, tokenId) => void onMapClick(cell, tokenId)}
        />
      </div>

      {/* ── Painel inferior ── */}
      {tab && (
        <div className="absolute inset-x-0 bottom-14 z-30 max-h-[55vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur">
          {tab === 'acoes' && (
            <ActionsPanel
              me={me} canAct={canAct} inCombat={!!combat} myTurn={myTurn} attackIndex={attackIndex} setAttackIndex={setAttackIndex}
              setMode={(m) => { setMode(m); setTab(null); }}
              onAction={(a) => me && void send({ type: 'combat.action', tokenId: me.id, action: a })}
              onEndTurn={() => me && void send({ type: 'combat.endTurn', tokenId: me.id })}
            />
          )}
          {tab === 'dados' && <DicePanel me={me} character={character} send={send} pending={myChecks} />}
          {tab === 'itens' && <ItemsPanel me={me} character={character} canAct={canAct} send={send} allies={state.tokens.filter((t) => t.kind !== 'monstro') as Token[]} />}
          {tab === 'historico' && <HistoryPanel campaignId={campaignId} state={state} chapterTitle={activeChapter?.title} />}
          {tab === 'guia' && <GuideContent compact />}
        </div>
      )}
      <nav className="z-30 grid h-14 grid-cols-5 border-t border-white/10 bg-slate-950">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(tab === t.key ? null : t.key)} className={cx('flex flex-col items-center justify-center text-[11px]', tab === t.key ? 'text-amber-300' : 'text-slate-300')}>
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );

  async function onMapClick(cell: Cell, tokenId: string | null) {
    if (!me || !canAct) return;
    const target = tokenId ? state!.tokens.find((t) => t.id === tokenId) : undefined;
    switch (mode) {
      case 'mover':
      case null:
        if (!target) {
          const tile = state!.map.tiles[cell.y * state!.map.width + cell.x];
          if (tile?.o?.type === 'bau') {
            if (await send({ type: 'object.open', tokenId: me.id, x: cell.x, y: cell.y })) setMode(null);
            return;
          }
          if (await send({ type: 'token.move', tokenId: me.id, x: cell.x, y: cell.y })) setMode(null);
        } else if (mode === null && target.kind === 'monstro') {
          setMode('atacar');
          toast('Modo ataque: toque no inimigo de novo para atacar', 'info');
        }
        return;
      case 'atacar':
        if (!target || target.id === me.id) return toast('Toque num alvo', 'erro');
        if (await send({ type: 'combat.attack', tokenId: me.id, targetId: target.id, attackIndex })) setMode(null);
        return;
      case 'cenario':
        if (await send({ type: 'combat.attackTile', tokenId: me.id, x: cell.x, y: cell.y, attackIndex })) setMode(null);
        return;
      case 'empurrar':
        if (!target) return toast('Toque numa criatura adjacente', 'erro');
        if (await send({ type: 'combat.shove', tokenId: me.id, targetId: target.id })) setMode(null);
        return;
      case 'poder':
        if (await send({ type: 'combat.power', tokenId: me.id, x: cell.x, y: cell.y })) setMode(null);
        return;
      case 'bau':
        if (await send({ type: 'object.open', tokenId: me.id, x: cell.x, y: cell.y })) setMode(null);
        return;
    }
  }
}

function highlightsFor(state: ProjectedState, me: Token, mode: Mode, attackIndex: number, movement?: number): Highlight[] {
  const out: Highlight[] = [];
  if (mode === null || mode === 'mover') {
    const cells = reachableCells(state as unknown as TableState, me.id, me, movement ?? (mode === 'mover' ? 12 : 0));
    for (const k of cells.keys()) {
      const [x, y] = k.split(',').map(Number);
      out.push({ x, y, color: 0x38bdf8, alpha: 0.18 });
    }
  }
  const attack = me.attacks[attackIndex];
  if ((mode === 'atacar' || mode === 'empurrar') && attack) {
    const range = mode === 'empurrar' ? 1 : (attack.longRange ?? attack.range);
    for (const t of state.tokens) if (t.id !== me.id && !t.dead && gridDistance(me, t) <= range) out.push({ x: t.x, y: t.y, color: t.kind === 'monstro' ? 0xff3b30 : 0xffcc00, alpha: 0.35 });
  }
  if (mode === 'bau') {
    state.map.tiles.forEach((tile, i) => {
      if (tile.o?.type !== 'bau') return;
      const x = i % state.map.width;
      const y = Math.floor(i / state.map.width);
      out.push({ x, y, color: gridDistance(me, { x, y }) <= 1 ? 0xffd34d : 0x888888, alpha: 0.45 });
    });
  }
  if (mode === 'cenario' && attack) {
    const range = attack.longRange ?? attack.range;
    state.map.tiles.forEach((tile, i) => {
      const x = i % state.map.width;
      const y = Math.floor(i / state.map.width);
      if ((tile.o || TERRAIN[tile.t].maxHp) && gridDistance(me, { x, y }) <= range) out.push({ x, y, color: 0xff9500, alpha: 0.35 });
    });
  }
  if (mode === 'poder' && me.power) {
    for (let y = me.y - (me.power.range ?? 6); y <= me.y + (me.power.range ?? 6); y++) {
      for (let x = me.x - (me.power.range ?? 6); x <= me.x + (me.power.range ?? 6); x++) {
        if (x >= 0 && y >= 0 && x < state.map.width && y < state.map.height) out.push({ x, y, color: 0xc084fc, alpha: 0.12 });
      }
    }
  }
  return out;
}

function ModeHint({ mode, onCancel }: { mode: Exclude<Mode, null>; onCancel: () => void }) {
  const text = { mover: 'Toque numa casa azul para mover', atacar: 'Toque num alvo em vermelho', cenario: 'Toque num objeto/parede em laranja', empurrar: 'Toque numa criatura adjacente', poder: 'Toque no ponto do mapa para o poder divino', bau: 'Toque no baú dourado ao seu lado' }[mode];
  return (
    <div className="flex items-center justify-between rounded-lg bg-sky-900/90 p-2 text-sm">
      <span>👆 {text}</span>
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancelar</Button>
    </div>
  );
}

function ActionsPanel(p: {
  me?: Token; canAct: boolean; inCombat: boolean; myTurn: boolean; attackIndex: number; setAttackIndex: (i: number) => void;
  setMode: (m: Mode) => void; onAction: (a: 'disparada' | 'desengajar' | 'esquivar') => void; onEndTurn: () => void;
}) {
  if (!p.me) return <p className="text-slate-300">Seu personagem ainda não está no mapa.</p>;
  const me = p.me;
  return (
    <div className="space-y-3">
      {!p.canAct && <p className="rounded-lg bg-white/5 p-2 text-sm text-slate-300">{p.inCombat ? 'Aguarde o seu turno — acompanhe a ordem no topo.' : 'Aguarde o Mestre.'}</p>}
      <div>
        <p className="mb-1 text-sm text-slate-400">Arma / ataque</p>
        <div className="flex flex-wrap gap-2">
          {me.attacks.map((a, i) => (
            <button key={a.name} onClick={() => p.setAttackIndex(i)} className={cx('rounded-lg border px-3 py-1.5 text-left text-sm', p.attackIndex === i ? 'border-amber-400 bg-amber-500/15' : 'border-white/10 bg-white/5')}>
              <span className="block font-semibold">{a.name}</span>
              <span className="text-xs text-slate-400">{formatModifier(a.toHit)} · {a.damage} {a.damageType} · alcance {a.range}{a.longRange ? `/${a.longRange}` : ''}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button disabled={!p.canAct} onClick={() => p.setMode('mover')}>🏃 Mover</Button>
        <Button disabled={!p.canAct} variant="danger" onClick={() => p.setMode('atacar')}>⚔️ Atacar</Button>
        <Button disabled={!p.canAct} variant="subtle" onClick={() => p.setMode('cenario')}>🪓 Golpear cenário</Button>
        <Button disabled={!p.canAct} variant="subtle" onClick={() => p.setMode('empurrar')}>✋ Empurrar <span className="text-[10px]">(bônus)</span></Button>
        {me.power && <Button disabled={!p.canAct} variant="gold" onClick={() => p.setMode('poder')}>✨ {me.power.label} <span className="text-[10px]">({me.power.staminaCost}⚡)</span></Button>}
        <Button disabled={!p.canAct} variant="subtle" onClick={() => p.setMode('bau')}>🧰 Abrir baú</Button>
      </div>
      {p.inCombat && (
        <div className="grid grid-cols-3 gap-2">
          <Button disabled={!p.canAct} variant="ghost" size="sm" onClick={() => p.onAction('disparada')}>Disparada</Button>
          <Button disabled={!p.canAct} variant="ghost" size="sm" onClick={() => p.onAction('desengajar')}>Desengajar</Button>
          <Button disabled={!p.canAct} variant="ghost" size="sm" onClick={() => p.onAction('esquivar')}>Esquivar</Button>
        </div>
      )}
      {p.myTurn && <Button variant="gold" size="lg" className="w-full" onClick={p.onEndTurn}>⏭️ Encerrar turno</Button>}
      <p className="text-xs text-slate-400">Dica: toque direto numa casa vazia para andar e num monstro para atacar. Veja <Term k="acao">Ação</Term>, <Term k="acao_bonus">Ação Bônus</Term> e <Term k="terreno_elevado">terreno elevado</Term>.</p>
    </div>
  );
}

function DicePanel({ me, character, send, pending }: { me?: Token; character: CharacterDTO | null; send: ReturnType<typeof useTable.getState>['send']; pending: PendingCheck[] }) {
  const [adv, setAdv] = useState<AdvantageState>('normal');
  const [priv, setPriv] = useState(false);
  const [formula, setFormula] = useState('1d20');
  const rollF = (f: string, label?: string) => void send({ type: 'dice.roll', formula: f, label, visibility: priv ? 'privado' : 'publico' });
  const mods = me?.abilityMods;
  const prof = me?.proficiency ?? 2;
  const skills = useMemo(() => new Set(character?.stats.skillProficiencies ?? []), [character]);

  return (
    <div className="space-y-3">
      <p className="rounded-lg bg-white/5 p-2 text-xs text-slate-300">
        Rolagens livres aparecem para todos e o Mestre pode usá-las (por exemplo, aplicar o total como dano). Quando o Mestre <strong>pedir um teste</strong>,
        a perícia pedida pisca em verde aqui: tocar nela rola e o resultado (sucesso/falha) vale na hora.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {(['normal', 'vantagem', 'desvantagem'] as const).map((a) => (
          <button key={a} onClick={() => setAdv(a)} className={cx('rounded-full px-3 py-1 text-sm', adv === a ? 'bg-amber-500 text-slate-950' : 'bg-white/5')}>{a}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> 🔒 Só eu e o Mestre</label>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
        {[4, 6, 8, 10, 12, 20, 100].map((d) => <Button key={d} variant="subtle" onClick={() => rollF(d === 20 ? d20Formula(0, adv) : `1d${d}`)}>d{d}</Button>)}
      </div>
      {mods && (
        <div>
          <p className="mb-1 text-sm text-slate-400"><Term k="atributos">Testes de atributo</Term></p>
          <div className="grid grid-cols-3 gap-2">
            {ABILITIES.map((a) => (
              <Button
                key={a}
                variant="ghost"
                size="sm"
                onClick={() => {
                  const req = pending.find((c) => c.kind !== 'pericia' && c.key === a);
                  if (req) void send({ type: 'check.roll', checkId: req.id, advantage: adv });
                  else rollF(d20Formula(mods[a], adv), `Teste de ${ABILITY_LABELS[a].label}`);
                }}
              >
                {ABILITY_LABELS[a].short} {formatModifier(mods[a])}
              </Button>
            ))}
          </div>
          <p className="mb-1 mt-3 text-sm text-slate-400">Perícias</p>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(SKILLS) as Skill[]).map((s) => {
              const mod = mods[SKILLS[s].ability] + (skills.has(s) ? prof : 0);
              return (
                <button
                  key={s}
                  onClick={() => {
                    const req = pending.find((c) => c.kind === 'pericia' && c.key === s);
                    if (req) void send({ type: 'check.roll', checkId: req.id, advantage: adv });
                    else rollF(d20Formula(mod, adv), SKILLS[s].label);
                  }}
                  className={cx('rounded-full border px-2 py-1 text-xs', pending.some((c) => c.kind === 'pericia' && c.key === s) ? 'border-emerald-400 bg-emerald-500/20 animate-pulse' : skills.has(s) ? 'border-amber-400/60 bg-amber-500/10' : 'border-white/10 bg-white/5')}
                >
                  {SKILLS[s].label} {formatModifier(mod)}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <input value={formula} onChange={(e) => setFormula(e.target.value)} className="flex-1 rounded-lg border border-white/15 bg-slate-900 px-3 py-2" placeholder="2d6+3" />
        <Button variant="gold" onClick={() => rollF(formula, 'Rolagem livre')}>Rolar</Button>
      </div>
      <p className="text-xs text-slate-400">Dados são rolados no Host — ninguém trapaceia. <Term k="notacao">Como ler fórmulas</Term>.</p>
    </div>
  );
}

function ItemsPanel({ me, character, canAct, send, allies }: { me?: Token; character: CharacterDTO | null; canAct: boolean; send: ReturnType<typeof useTable.getState>['send']; allies: Token[] }) {
  const consumables = Object.entries(me?.consumables ?? {}).filter(([, q]) => q > 0);
  // Aliados ao lado (para dar a poção a quem caiu)
  const near = me ? allies.filter((a) => a.id !== me.id && !a.dead && Math.max(Math.abs(a.x - me.x), Math.abs(a.y - me.y)) <= 1) : [];
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-sm text-slate-400">Consumíveis (<Term k="acao_bonus">Ação Bônus</Term>)</p>
        {consumables.length === 0 && <p className="text-sm text-slate-300">Nenhum consumível.</p>}
        <div className="space-y-2">
          {consumables.map(([key, qty]) => (
            <div key={key} className="flex items-center gap-2 rounded-lg bg-white/5 p-2">
              <span className="text-xl">🧪</span>
              <span className="flex-1"><strong>{ITEMS[key]?.name ?? key}</strong> ×{qty}<span className="block text-xs text-slate-400">{ITEMS[key]?.description}</span></span>
              <div className="flex flex-col gap-1">
                <Button size="sm" disabled={!canAct} onClick={() => me && void send({ type: 'item.use', tokenId: me.id, itemKey: key })}>Usar</Button>
                {near.map((a) => (
                  <Button key={a.id} size="sm" variant="subtle" disabled={!canAct} onClick={() => me && void send({ type: 'item.use', tokenId: me.id, itemKey: key, targetId: a.id })}>
                    em {a.name}{a.hp === 0 ? ' 😵' : ''}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {character && (
        <div>
          <p className="mb-1 text-sm text-slate-400">Equipamento</p>
          <div className="space-y-1">
            {character.inventory.filter((i) => i.item?.kind !== 'consumivel').map((i) => {
              const equipped = Object.values(character.equipment).includes(i.itemKey);
              return (
                <div key={i.itemKey} className={cx('flex items-center gap-2 rounded-lg p-2 text-sm', equipped ? 'bg-amber-500/10' : 'bg-white/5', !i.allowed && 'opacity-50')}>
                  <span>{i.allowed ? (equipped ? '✅' : '▫️') : '🔒'}</span>
                  <span className="flex-1">{i.item?.name ?? i.itemKey}{!i.allowed && <span className="block text-xs text-rose-300">{i.reasons[0]}</span>}</span>
                </div>
              );
            })}
          </div>
          <Button className="mt-2" size="sm" variant="ghost" onClick={() => navigate(`/personagem/${character.id}`)}>Trocar equipamento na ficha</Button>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ campaignId, state, chapterTitle }: { campaignId: string; state: ProjectedState; chapterTitle?: string }) {
  const [older, setOlder] = useState<LogEntry[]>([]);
  async function loadMore() {
    const before = older[0]?.id ?? undefined;
    const r = await api<{ events: { id: number; logId: number; at: string; type: string; text: string; visibility: LogEntry['visibility'] }[] }>(`/campaigns/${campaignId}/history${before ? `?before=${before}` : ''}`);
    const known = new Set(state.log.map((l) => l.id));
    const mapped = r.events.filter((e) => !known.has(e.logId)).map((e) => ({ id: e.id, at: new Date(e.at).getTime(), type: e.type, text: e.text, visibility: e.visibility })).reverse();
    setOlder([...mapped, ...older]);
  }
  const quests = state.sideQuests.filter((q) => q.status === 'ativa');
  return (
    <div className="space-y-3">
      {chapterTitle && <p className="font-display text-amber-200">📖 {chapterTitle}</p>}
      {quests.length > 0 && (
        <div className="space-y-1">
          {quests.map((q) => {
            const secs = q.expiresAt ? Math.max(0, Math.round((q.expiresAt - Date.now()) / 1000)) : null;
            return (
              <div key={q.id} className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2 text-sm">
                <strong>📜 {q.title}</strong> {q.target > 1 && <span>({q.progress}/{q.target})</span>}
                {secs !== null && <span className="ml-2 text-amber-200">⏳ {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>}
                {q.expiresAtRound !== null && <span className="ml-2 text-amber-200">⏳ até a rodada {q.expiresAtRound}</span>}
                {q.description && <p className="text-xs text-slate-300">{q.description}</p>}
              </div>
            );
          })}
        </div>
      )}
      <LogFeed entries={[...older, ...state.log]} className="max-h-[38vh]" onLoadMore={() => void loadMore().catch(() => toast('Sem mais histórico', 'info'))} />
    </div>
  );
}

