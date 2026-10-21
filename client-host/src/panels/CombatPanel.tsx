import { useState } from 'react';
import { CONDITIONS, CONDITION_KEYS, type ProjectedState, type Token } from '@mesa/shared';
import { Badge, Button, Field, cx, useTable } from '@mesa/common';

export function CombatPanel({ state, selectedId, onSelect }: { state: ProjectedState; selectedId: string | null; onSelect: (id: string | null) => void }) {
  const send = useTable((s) => s.send);
  const combat = state.combat;
  const [picked, setPicked] = useState<string[]>([]);
  const alive = state.tokens.filter((t) => !t.dead);
  const byId = (id: string) => state.tokens.find((t) => t.id === id) as Token | undefined;

  return (
    <div className="space-y-3">
      {!combat ? (
        <>
          <p className="text-sm text-slate-300">Escolha quem entra no combate (vazio = todos no mapa) e role a <strong>iniciativa</strong>.</p>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {alive.map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-sm">
                <input type="checkbox" checked={picked.includes(t.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, t.id] : picked.filter((x) => x !== t.id))} />
                <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                <span className="flex-1">{t.name}</span>
                {t.hidden && <Badge color="violet">oculto</Badge>}
              </label>
            ))}
          </div>
          <Button variant="danger" className="w-full" onClick={() => void send({ type: 'combat.start', tokenIds: picked.length ? picked : undefined })}>⚔️ Iniciar combate</Button>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Badge color="amber">Rodada {combat.round}</Badge>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void send({ type: 'combat.next' })}>⏭️ Próximo turno</Button>
              <Button size="sm" variant="ghost" onClick={() => void send({ type: 'combat.end' })}>Encerrar</Button>
            </div>
          </div>
          <ol className="space-y-1">
            {combat.order.map((e, i) => {
              const t = byId(e.tokenId);
              if (!t) return null;
              const eco = combat.economy[t.id];
              const current = i === combat.turnIndex;
              return (
                <li key={e.tokenId}>
                  <button onClick={() => onSelect(t.id)} className={cx('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm', current ? 'bg-amber-500/25 ring-1 ring-amber-400' : 'bg-white/5', selectedId === t.id && 'outline outline-1 outline-sky-400', t.dead && 'opacity-40 line-through')}>
                    <span className="w-6 text-right font-mono text-amber-200">{e.initiative}</span>
                    <span className="h-3 w-3 rounded-full" style={{ background: t.color }} />
                    <span className="flex-1">{t.name}</span>
                    <span className="text-xs text-slate-300">{t.hp}/{t.maxHp}</span>
                    {eco && current && <span className="text-[10px] text-slate-400">A{eco.action} B{eco.bonusAction} R{eco.reaction} M{eco.movement}</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
      {selectedId && byId(selectedId) && <TokenInspector token={byId(selectedId)!} onClose={() => onSelect(null)} />}
    </div>
  );
}

/** Edição rápida do token selecionado (PV, condições, visibilidade, ataques). */
export function TokenInspector({ token, onClose }: { token: Token; onClose: () => void }) {
  const send = useTable((s) => s.send);
  const [hp, setHp] = useState(String(token.hp));
  const combat = useTable((s) => s.state?.combat);
  const isTurn = combat?.currentTokenId === token.id;
  const patch = (p: Record<string, unknown>) => void send({ type: 'token.update', tokenId: token.id, patch: p });

  return (
    <div className="space-y-2 rounded-xl border border-sky-400/30 bg-sky-950/30 p-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg">{token.name}</p>
        <button onClick={onClose} className="text-slate-400 hover:text-white">×</button>
      </div>
      <div className="flex flex-wrap gap-1 text-xs">
        <Badge color="rose">PV {token.hp}/{token.maxHp}</Badge>
        <Badge color="sky">CA {token.ac}</Badge>
        <Badge>Desl. {token.speed}</Badge>
        {token.kind === 'personagem' && <Badge color="amber">Estamina {token.stamina}/{token.maxStamina}</Badge>}
        {token.resistances.map((r) => <Badge key={r} color="emerald">{r}</Badge>)}
      </div>
      <div className="flex items-end gap-2">
        <Field label="PV" type="number" value={hp} onChange={(e) => setHp(e.target.value)} className="w-24" />
        <Button size="sm" onClick={() => patch({ hp: Math.max(0, Number(hp) || 0) })}>Definir</Button>
        <Button size="sm" variant="danger" onClick={() => patch({ hp: Math.max(0, token.hp - 5) })}>−5</Button>
        <Button size="sm" variant="subtle" onClick={() => patch({ hp: token.hp + 5 })}>+5</Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {CONDITION_KEYS.map((c) => {
          const on = token.conditions.includes(c);
          return (
            <button key={c} onClick={() => patch({ conditions: on ? token.conditions.filter((x) => x !== c) : [...token.conditions, c] })} className={cx('rounded-full border px-2 py-0.5 text-xs', on ? 'border-rose-400 bg-rose-500/20' : 'border-white/10 bg-white/5')}>
              {CONDITIONS[c].icon} {CONDITIONS[c].label}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => patch({ hidden: !token.hidden })}>{token.hidden ? '👁️ Revelar' : '🙈 Ocultar'}</Button>
        {token.kind === 'personagem' && (
          <>
            <Button size="sm" variant="subtle" onClick={() => void send({ type: 'affinity.adjust', tokenId: token.id, delta: 10 })}>🌟 +10 afinidade</Button>
            <Button size="sm" variant="subtle" onClick={() => void send({ type: 'affinity.adjust', tokenId: token.id, delta: -10 })}>🌩️ −10</Button>
          </>
        )}
        {token.kind !== 'personagem' && <Button size="sm" variant="danger" onClick={() => { void send({ type: 'token.remove', tokenId: token.id }); onClose(); }}>Remover</Button>}
        {isTurn && <Button size="sm" variant="gold" onClick={() => void send({ type: 'combat.endTurn', tokenId: token.id })}>Encerrar turno</Button>}
      </div>
      {token.attacks.length > 0 && (
        <div className="text-xs text-slate-300">
          {token.attacks.map((a, i) => <p key={i}>⚔️ {a.name}: +{a.toHit} · {a.damage} {a.damageType} · alcance {a.range}</p>)}
        </div>
      )}
      <p className="text-[11px] text-slate-400">Com o token selecionado, clique no mapa para movê-lo (no turno dele usa o movimento; fora do turno, teleporta). Clique em outro token para atacá-lo no turno deste.</p>
    </div>
  );
}
