import { useEffect, useRef, useState } from 'react';
import { CONDITIONS, type Economy, type ProjectedState, type SideQuest, type Token } from '@mesa/shared';
import { Term, TokenAvatar, artKeyFor, cx, isPortraitSpec, portraitUrl } from '@mesa/common';
import type { CharacterDTO } from '../types';

type TokenView = Token & { hpStatus?: string };

/** Retrato redondo: rosto gerado ou arte da classe/monstro. */
function Portrait({ t, size }: { t: TokenView; size: number }) {
  if (isPortraitSpec(t.face)) return <img src={portraitUrl(t.face, size * 2)} width={size} height={size} className="rounded-full" alt="" />;
  return <TokenAvatar artKey={artKeyFor(t)} color={t.color ?? (t.kind === 'monstro' ? '#7f1d1d' : '#334155')} size={size} title={t.emblem} />;
}

/** Barra de PV com rastro: o pedaço perdido fica claro e some devagar (estilo jogos de ação). */
function HpBar({ hp, max, temp }: { hp: number; max: number; temp: number }) {
  const [trail, setTrail] = useState(hp);
  useEffect(() => {
    if (hp >= trail) { setTrail(hp); return; }
    const t = setTimeout(() => setTrail(hp), 650);
    return () => clearTimeout(t);
  }, [hp, trail]);
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%`;
  const low = hp / Math.max(1, max) <= 0.3;
  return (
    <div className="relative h-4 overflow-hidden rounded-full bg-slate-800 ring-1 ring-black/60">
      <div className="absolute inset-y-0 left-0 bg-rose-200/80 transition-[width] duration-700 ease-out" style={{ width: pct(trail) }} />
      <div className={cx('absolute inset-y-0 left-0 bg-gradient-to-b transition-[width] duration-200', low ? 'from-rose-400 to-rose-700 animate-pulse' : 'from-rose-500 to-rose-800')} style={{ width: pct(hp) }} />
      {temp > 0 && <div className="absolute inset-y-0 bg-cyan-300/70" style={{ left: pct(hp), width: pct(temp) }} />}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-white/10" />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]">
        {hp}/{max}{temp > 0 ? ` +${temp}` : ''}
      </span>
    </div>
  );
}

function ThinBar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-800 ring-1 ring-black/60" title={label}>
      <div className={cx('absolute inset-y-0 left-0 transition-[width] duration-300', color)} style={{ width: `${Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))}%` }} />
    </div>
  );
}

/** Ação / Ação bônus / Reação como “pedras” que apagam ao gastar, e o movimento restante. */
function EconomyPips({ economy, speed }: { economy: Economy; speed: number }) {
  const pip = (on: boolean, shape: 'circle' | 'tri' | 'diamond', color: string, label: string, k: string) => (
    <span key={`${k}${on}`} title={label} className={cx('inline-flex h-6 w-6 items-center justify-center', on && 'mesa-pip-pop')}>
      <svg viewBox="0 0 20 20" className={cx('h-5 w-5 transition-opacity', on ? 'opacity-100 drop-shadow-[0_0_6px_currentColor]' : 'opacity-25')} style={{ color }}>
        {shape === 'circle' && <circle cx="10" cy="10" r="8" fill="currentColor" stroke="#0008" strokeWidth="1.5" />}
        {shape === 'tri' && <polygon points="10,2 18.5,17 1.5,17" fill="currentColor" stroke="#0008" strokeWidth="1.5" />}
        {shape === 'diamond' && <polygon points="10,1.5 18.5,10 10,18.5 1.5,10" fill="currentColor" stroke="#0008" strokeWidth="1.5" />}
      </svg>
    </span>
  );
  return (
    <div className="flex items-center gap-1.5">
      {pip(economy.action > 0, 'circle', '#34d399', 'Ação', 'a')}
      {pip(economy.bonusAction > 0, 'tri', '#fb923c', 'Ação bônus', 'b')}
      {pip(economy.reaction > 0, 'diamond', '#c084fc', 'Reação', 'r')}
      <div className="ml-1 flex flex-1 items-center gap-1" title="Movimento restante">
        <span className="text-xs">👣</span>
        <div className="flex flex-1 gap-[2px]">
          {Array.from({ length: Math.max(speed, economy.movement) }, (_, i) => (
            <span key={i} className={cx('h-2 flex-1 rounded-sm', i < economy.movement ? 'bg-sky-400' : 'bg-slate-700')} />
          ))}
        </div>
        <span className="w-6 text-right font-mono text-[11px] text-sky-200">{economy.movement}</span>
      </div>
    </div>
  );
}

/** Quadro do herói (canto superior): retrato com anel de XP, PV, Estamina, CA, condições e economia de ações. */
export function HeroFrame({ me, character, economy, myTurn, onBack, connected }: {
  me: TokenView; character: CharacterDTO | null; economy: Economy | null; myTurn: boolean; onBack: () => void; connected: boolean;
}) {
  const xp = character?.experience ?? 0;
  const next = character?.nextLevelXp ?? null;
  const xpPct = next ? Math.min(1, xp / next) : 1;
  const R = 29;
  const C = 2 * Math.PI * R;
  // Pisca vermelho ao levar dano
  const [hit, setHit] = useState(0);
  const prev = useRef(me.hp);
  useEffect(() => {
    if (me.hp < prev.current) setHit((n) => n + 1);
    prev.current = me.hp;
  }, [me.hp]);

  return (
    <div key={hit} className={cx('rounded-2xl border bg-slate-950/85 p-2 shadow-xl backdrop-blur', myTurn ? 'border-amber-400/80 mesa-glow' : 'border-white/10', hit > 0 && 'mesa-hit')}>
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="self-start rounded-lg px-1 text-lg" aria-label="Sair da mesa">←</button>
        <div className="relative h-16 w-16 shrink-0">
          <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
            <circle cx="32" cy="32" r={R} fill="none" stroke="#1e293b" strokeWidth="4" />
            <circle cx="32" cy="32" r={R} fill="none" stroke="url(#xpg)" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - xpPct)} className="transition-[stroke-dashoffset] duration-1000" />
            <defs><linearGradient id="xpg"><stop offset="0" stopColor="#a78bfa" /><stop offset="1" stopColor="#f0abfc" /></linearGradient></defs>
          </svg>
          <div className="absolute inset-[6px] overflow-hidden rounded-full border-2" style={{ borderColor: me.color ?? '#94a3b8' }}>
            <Portrait t={me} size={48} />
          </div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-1.5 text-[10px] font-bold leading-4 ring-2 ring-slate-950" title={next ? `XP ${xp}/${next}` : `XP ${xp}`}>
            {me.level ?? 1}
          </span>
          {me.emblem && <span className="absolute -right-1 -top-1 text-base drop-shadow">{me.emblem}</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-display text-sm text-amber-100">{me.name}</span>
            {character && <span className="truncate text-[10px] text-slate-400">{character.classLabel} · {character.divinityLabel}</span>}
            <span className="flex-1" />
            <span title={connected ? 'conectado' : 'reconectando'} className={cx('h-2 w-2 shrink-0 rounded-full', connected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse')} />
          </div>
          <HpBar hp={me.hp} max={me.maxHp} temp={me.tempHp} />
          <div className="flex items-center gap-2">
            <div className="flex-1"><ThinBar value={me.stamina} max={me.maxStamina} color="bg-gradient-to-r from-amber-300 to-amber-500" label={`Estamina ${me.stamina}/${me.maxStamina}`} /></div>
            <span className="font-mono text-[10px] text-amber-200">⚡{me.stamina}</span>
            <span className="flex items-center gap-0.5 rounded-md bg-sky-500/15 px-1.5 text-[11px] font-bold text-sky-200" title="Classe de Armadura"><Term k="ca">🛡️{me.ac}</Term></span>
          </div>
        </div>
      </div>
      {(me.conditions.length > 0 || economy) && (
        <div className="mt-1.5 space-y-1">
          {me.conditions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {me.conditions.map((c) => (
                <span key={c} title={CONDITIONS[c]?.description} className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-100 ring-1 ring-rose-400/40">
                  {CONDITIONS[c]?.icon} {CONDITIONS[c]?.label ?? c}
                </span>
              ))}
            </div>
          )}
          {economy && <EconomyPips economy={economy} speed={me.speed} />}
        </div>
      )}
    </div>
  );
}

const HP_STATUS_COLOR: Record<string, string> = { ileso: 'bg-emerald-400', ferido: 'bg-amber-400', 'gravemente ferido': 'bg-rose-500', caido: 'bg-slate-500', morto: 'bg-slate-700' };

/** Fita de iniciativa (estilo BG3): quem age em seguida, com o turno atual destacado. */
export function InitiativeRibbon({ state, meId }: { state: ProjectedState; meId?: string }) {
  const combat = state.combat;
  const ref = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { currentRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }, [combat?.currentTokenId]);
  if (!combat) return null;
  const order = combat.order.map((e) => state.tokens.find((t) => t.id === e.tokenId) as TokenView | undefined).filter(Boolean) as TokenView[];
  const hiddenTurn = combat.currentTokenId === '__oculto__';
  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/80 px-2 py-1.5 shadow-lg backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-400">
        <span>⚔️ Rodada {combat.round}</span>
        {hiddenTurn && <span className="text-rose-300">algo se move nas sombras…</span>}
      </div>
      <div ref={ref} className="mesa-noscroll flex gap-1.5 overflow-x-auto pb-0.5">
        {order.map((t) => {
          const current = t.id === combat.currentTokenId;
          const mine = t.id === meId;
          const pct = typeof t.hp === 'number' && t.maxHp ? t.hp / t.maxHp : null;
          return (
            <div key={t.id} ref={current ? currentRef : undefined} className={cx('relative flex w-11 shrink-0 flex-col items-center transition-transform', current && 'scale-110', t.dead && 'opacity-40 grayscale')}>
              <div className={cx('overflow-hidden rounded-full border-2', current ? 'border-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]' : t.kind === 'monstro' ? 'border-rose-700' : mine ? 'border-sky-400' : 'border-slate-500')}>
                <Portrait t={t} size={36} />
              </div>
              <div className="mt-0.5 h-1 w-9 overflow-hidden rounded-full bg-slate-800">
                {pct !== null
                  ? <div className="h-full bg-rose-500" style={{ width: `${Math.max(0, pct * 100)}%` }} />
                  : <div className={cx('h-full w-full', HP_STATUS_COLOR[t.hpStatus ?? 'ileso'])} />}
              </div>
              <span className={cx('w-full truncate text-center text-[9px]', current ? 'text-amber-200' : 'text-slate-300')}>{mine ? 'Você' : t.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Rastreador de quests: obrigatórias e opcionais, recolhível. */
export function QuestTracker({ quests, chapter, sceneKey, compact }: { quests: SideQuest[]; chapter?: string; sceneKey?: string | null; compact?: boolean }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { setOpen(!compact); }, [compact]);
  // Só as quests da cena atual (e as criadas à mão); obrigatórias primeiro
  const active = quests
    .filter((q) => q.status === 'ativa' && (!q.sceneKey || !sceneKey || q.sceneKey === sceneKey))
    .sort((a, b) => Number(!!b.required) - Number(!!a.required))
    .slice(0, 5);
  if (!active.length && !chapter) return null;
  return (
    <div className="pointer-events-auto max-w-[15rem] rounded-xl border border-amber-400/25 bg-slate-950/80 text-xs shadow-lg backdrop-blur">
      <button className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left" onClick={() => setOpen(!open)}>
        <span>📜</span>
        <span className="flex-1 truncate font-display text-amber-200">{chapter ?? 'Quests'}</span>
        <span className="rounded-full bg-amber-500/20 px-1.5 text-[10px] text-amber-100">{active.length}</span>
        <span className="text-slate-400">{open ? '▴' : '▾'}</span>
      </button>
      {open && active.length > 0 && (
        <ul className="space-y-1 border-t border-white/10 px-2 py-1.5">
          {active.map((q) => {
            const secs = q.expiresAt ? Math.max(0, Math.round((q.expiresAt - Date.now()) / 1000)) : null;
            return (
              <li key={q.id} className="leading-tight">
                <div className="flex items-start gap-1">
                  <span className={cx('mt-0.5 h-2 w-2 shrink-0 rotate-45', q.required ? 'bg-amber-400' : 'border border-sky-300')} title={q.required ? 'Obrigatória' : 'Opcional'} />
                  <span className={cx(q.required ? 'text-amber-50' : 'text-slate-200')}>{q.title}</span>
                </div>
                <div className="ml-3 flex flex-wrap gap-1 text-[10px] text-slate-400">
                  {q.required === false && <span>opcional</span>}
                  {q.target > 1 && <span>{q.progress}/{q.target}</span>}
                  {secs !== null && <span className="text-amber-300">⏳ {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>}
                  {q.rewardXp ? <span className="text-violet-300">{q.rewardXp} XP</span> : null}
                </div>
                {q.target > 1 && <div className="ml-3 mt-0.5 h-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-amber-400" style={{ width: `${(q.progress / q.target) * 100}%` }} /></div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Barra rápida: os botões mais usados no turno, grandes para o dedo. */
export function HotBar({ me, canAct, myTurn, inCombat, attackIndex, onMode, onPotion, onEndTurn }: {
  me: Token; canAct: boolean; myTurn: boolean; inCombat: boolean; attackIndex: number;
  onMode: (m: 'mover' | 'atacar' | 'poder' | 'bau') => void; onPotion: () => void; onEndTurn: () => void;
}) {
  const potions = me.consumables.pocao_cura ?? 0;
  const atk = me.attacks[attackIndex] ?? me.attacks[0];
  const btn = (label: string, icon: string, onClick: () => void, opts: { disabled?: boolean; tone?: string; badge?: string | number } = {}) => (
    <button
      key={label}
      disabled={opts.disabled}
      onClick={onClick}
      className={cx('relative flex h-14 min-w-[3.5rem] flex-1 flex-col items-center justify-center rounded-xl border text-[10px] font-semibold shadow-lg transition active:scale-95 disabled:opacity-35',
        opts.tone ?? 'border-white/15 bg-slate-900/90 text-slate-100')}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="mt-0.5 max-w-[4.5rem] truncate">{label}</span>
      {opts.badge !== undefined && <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-slate-950">{opts.badge}</span>}
    </button>
  );
  return (
    <div className="flex gap-1.5">
      {btn('Mover', '🏃', () => onMode('mover'), { disabled: !canAct })}
      {btn(atk?.name ?? 'Atacar', '⚔️', () => onMode('atacar'), { disabled: !canAct || !atk, tone: 'border-rose-400/40 bg-rose-950/80 text-rose-50' })}
      {me.power && btn(me.power.label, '✨', () => onMode('poder'), { disabled: !canAct || me.stamina < me.power.staminaCost, tone: 'border-violet-400/40 bg-violet-950/80 text-violet-50', badge: `${me.power.staminaCost}⚡` })}
      {btn('Poção', '🧪', onPotion, { disabled: !canAct || potions < 1, tone: 'border-emerald-400/40 bg-emerald-950/80 text-emerald-50', badge: potions })}
      {!inCombat && btn('Baú', '🧰', () => onMode('bau'), { disabled: !canAct })}
      {myTurn && btn('Fim do turno', '⏭️', onEndTurn, { tone: 'border-amber-300 bg-amber-500 text-slate-950' })}
    </div>
  );
}
