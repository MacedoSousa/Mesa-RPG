import { useEffect, useState } from 'react';
import { MONSTERS, type ProjectedState } from '@mesa/shared';
import { Badge, Button, Field, Select, TextArea, cx, useTable } from '@mesa/common';

/** Fases / capítulos da campanha. */
export function ChaptersPanel({ state }: { state: ProjectedState }) {
  const send = useTable((s) => s.send);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        {state.chapters.length === 0 && <p className="text-sm text-slate-400">Nenhum capítulo. Divida a aventura em fases!</p>}
        {state.chapters.map((c) => (
          <div key={c.id} className={cx('rounded-lg p-2 text-sm', c.status === 'ativo' ? 'bg-amber-500/20 ring-1 ring-amber-400' : 'bg-white/5')}>
            <div className="flex items-center gap-2">
              <span className="font-mono text-slate-400">{c.order}.</span>
              <span className="flex-1 font-semibold">{c.title}</span>
              <Badge color={c.status === 'ativo' ? 'amber' : c.status === 'concluido' ? 'emerald' : 'slate'}>{c.status}</Badge>
            </div>
            {c.description && <p className="mt-1 text-xs text-slate-400">{c.description}</p>}
            <div className="mt-2 flex gap-1">
              {c.status !== 'ativo' && <Button size="sm" variant="gold" onClick={() => void send({ type: 'chapter.activate', id: c.id })}>Iniciar</Button>}
              {c.status === 'ativo' && <Button size="sm" variant="subtle" onClick={() => void send({ type: 'chapter.update', id: c.id, status: 'concluido' })}>Concluir</Button>}
              <Button size="sm" variant="danger" onClick={() => void send({ type: 'chapter.delete', id: c.id })}>Excluir</Button>
            </div>
          </div>
        ))}
      </div>
      <Field label="Novo capítulo" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Capítulo 1 — A chegada ao acampamento" />
      <TextArea label="Notas do Mestre" value={description} onChange={setDescription} rows={2} />
      <Button className="w-full" disabled={!title.trim()} onClick={() => { void send({ type: 'chapter.create', title, description }); setTitle(''); setDescription(''); }}>Criar capítulo</Button>
    </div>
  );
}

/** Side quests temporárias com contadores e gatilhos. */
export function QuestsPanel({ state }: { state: ProjectedState }) {
  const send = useTable((s) => s.send);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const [f, setF] = useState({ title: '', description: '', target: '1', reward: '', hidden: false, timerKind: 'nenhum' as 'nenhum' | 'rodadas' | 'segundos', timer: '3', message: '', spawn: '', sx: '0', sy: '0' });
  const set = (k: keyof typeof f, v: string | boolean) => setF({ ...f, [k]: v });

  function create() {
    void send({
      type: 'quest.create',
      title: f.title,
      description: f.description,
      hidden: f.hidden,
      target: Math.max(1, Number(f.target) || 1),
      reward: f.reward,
      expiresInRounds: f.timerKind === 'rodadas' ? Number(f.timer) : undefined,
      expiresInSeconds: f.timerKind === 'segundos' ? Math.max(10, Number(f.timer)) : undefined,
      onExpire: f.message || f.spawn ? { message: f.message || undefined, spawn: f.spawn ? { monsterKey: f.spawn, x: Number(f.sx), y: Number(f.sy), hidden: false } : undefined } : undefined,
    });
    setF({ ...f, title: '', description: '', reward: '', message: '' });
  }

  return (
    <div className="space-y-3">
      {state.sideQuests.map((q) => {
        const secs = q.expiresAt ? Math.max(0, Math.round((q.expiresAt - Date.now()) / 1000)) : null;
        return (
          <div key={q.id} className={cx('rounded-lg p-2 text-sm', q.status === 'ativa' ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40' : 'bg-white/5 opacity-70')}>
            <div className="flex items-center gap-2">
              <span className="flex-1 font-semibold">{q.title}</span>
              {q.hidden && <Badge color="violet">oculta</Badge>}
              <Badge color={q.status === 'ativa' ? 'emerald' : q.status === 'concluida' ? 'sky' : 'rose'}>{q.status}</Badge>
            </div>
            <p className="text-xs text-slate-300">
              Progresso {q.progress}/{q.target}
              {secs !== null && q.status === 'ativa' && ` · ⏳ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}
              {q.expiresAtRound !== null && ` · ⏳ fim da rodada ${q.expiresAtRound}`}
              {q.onExpire?.spawn && ` · gatilho: ${q.onExpire.spawn.monsterKey}`}
            </p>
            {q.status === 'ativa' && (
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="subtle" onClick={() => void send({ type: 'quest.progress', id: q.id, delta: 1 })}>+1</Button>
                <Button size="sm" variant="subtle" onClick={() => void send({ type: 'quest.progress', id: q.id, delta: -1 })}>−1</Button>
                <Button size="sm" variant="ghost" onClick={() => void send({ type: 'quest.update', id: q.id, hidden: !q.hidden })}>{q.hidden ? 'Revelar' : 'Ocultar'}</Button>
                <Button size="sm" variant="danger" onClick={() => void send({ type: 'quest.update', id: q.id, status: 'falhou' })}>Falhou</Button>
              </div>
            )}
            <button className="mt-1 text-[11px] text-slate-500 hover:text-rose-300" onClick={() => void send({ type: 'quest.delete', id: q.id })}>excluir</button>
          </div>
        );
      })}
      <div className="space-y-2 rounded-xl border border-white/10 p-2">
        <Field label="Título" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Resgate o sátiro antes da maré subir" />
        <TextArea label="Descrição" value={f.description} onChange={(v) => set('description', v)} rows={2} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Meta (contador)" type="number" value={f.target} onChange={(e) => set('target', e.target.value)} />
          <Field label="Recompensa" value={f.reward} onChange={(e) => set('reward', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select label="Tempo limite" value={f.timerKind} onChange={(v) => set('timerKind', v)} options={[{ value: 'nenhum', label: 'Sem limite' }, { value: 'rodadas', label: 'Rodadas de combate' }, { value: 'segundos', label: 'Segundos (tempo real)' }]} />
          {f.timerKind !== 'nenhum' && <Field label={f.timerKind} type="number" value={f.timer} onChange={(e) => set('timer', e.target.value)} />}
        </div>
        <Field label="Mensagem ao expirar" value={f.message} onChange={(e) => set('message', e.target.value)} />
        <div className="grid grid-cols-[2fr_1fr_1fr] gap-2">
          <Select label="Invocar ao expirar" value={f.spawn} onChange={(v) => set('spawn', v)} options={[{ value: '', label: '—' }, ...Object.values(MONSTERS).map((m) => ({ value: m.key, label: m.label }))]} />
          <Field label="x" type="number" value={f.sx} onChange={(e) => set('sx', e.target.value)} />
          <Field label="y" type="number" value={f.sy} onChange={(e) => set('sy', e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.hidden} onChange={(e) => set('hidden', e.target.checked)} /> Oculta dos jogadores</label>
        <Button className="w-full" variant="gold" disabled={!f.title.trim()} onClick={create}>Criar side quest</Button>
      </div>
    </div>
  );
}
