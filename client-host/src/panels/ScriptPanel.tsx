import { useState } from 'react';
import { ADVENTURES, MONSTERS, SCENES, getScene, type ProjectedState, type Scene } from '@mesa/shared';
import { Badge, Button, cx, toast, useTable } from '@mesa/common';

/** Casa alvo de um ponto fracionário da cena no mapa atual. */
function cellOf(state: ProjectedState, p: { fx: number; fy: number }) {
  return {
    x: Math.round(p.fx * (state.map.width - 1)),
    y: Math.round(p.fy * (state.map.height - 1)),
  };
}

/** Baú/objeto no mapa mais perto de onde a cena o colocou. */
function nearestChest(state: ProjectedState, p: { fx: number; fy: number }, used: Set<number>) {
  const c = cellOf(state, p);
  let best = -1;
  let bestD = Infinity;
  state.map.tiles.forEach((t, i) => {
    if (used.has(i) || !t.o || (t.o.type !== 'bau' && t.o.type !== 'bau_aberto')) return;
    const x = i % state.map.width;
    const y = Math.floor(i / state.map.width);
    const d = Math.max(Math.abs(x - c.x), Math.abs(y - c.y));
    if (d < bestD) { bestD = d; best = i; }
  });
  if (best < 0) return null;
  used.add(best);
  return { i: best, x: best % state.map.width, y: Math.floor(best / state.map.width), tile: state.map.tiles[best] };
}

function List({ items, icon, color }: { items: string[]; icon: string; color: string }) {
  return (
    <ul className="space-y-1">
      {items.map((t) => <li key={t} className={cx('flex gap-1.5 text-xs leading-snug', color)}><span>{icon}</span><span>{t}</span></li>)}
    </ul>
  );
}

/** 🎬 Roteiro: o Mestre carrega uma cena pronta e segue o passo a passo. */
export function ScriptPanel({ state }: { state: ProjectedState }) {
  const send = useTable((s) => s.send);
  const adventure = ADVENTURES[0];
  const current = state.sceneKey ? getScene(state.sceneKey) : undefined;
  const [chapter, setChapter] = useState<number>(current?.chapter ?? 1);
  const [pick, setPick] = useState<string | null>(null);
  const scene: Scene | undefined = pick ? getScene(pick) : current;
  const loaded = !!scene && scene.key === state.sceneKey;

  async function load(s: Scene) {
    const heroes = state.tokens.filter((t) => t.kind === 'personagem').length;
    if (state.combat) return toast('Encerre o combate antes de trocar de cena', 'erro');
    if (state.tokens.some((t) => t.kind === 'monstro') && !window.confirm('Trocar de cena remove os monstros atuais do mapa. Continuar?')) return;
    if (await send({ type: 'scene.load', sceneKey: s.key })) {
      setPick(null);
      toast(`🎬 ${s.title} carregada${heroes ? '' : '. Os heróis aparecem quando os jogadores entrarem.'}`, 'sucesso');
    }
  }

  const hiddenMonsters = state.tokens.filter((t) => t.kind === 'monstro' && t.hidden && !t.dead);
  const used = new Set<number>();

  return (
    <div className="space-y-3">
      {/* Capítulos */}
      <div>
        <p className="mb-1 text-xs uppercase tracking-wider text-slate-400">{adventure.title} · capítulos</p>
        <div className="flex flex-wrap gap-1">
          {adventure.chapters.map((c, i) => (
            <button
              key={c.title}
              title={c.title}
              onClick={() => { setChapter(i + 1); setPick(null); }}
              className={cx('rounded-lg px-2.5 py-1 text-sm', chapter === i + 1 ? 'bg-amber-500/30 text-amber-100 ring-1 ring-amber-400' : 'bg-white/5 hover:bg-white/10')}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-300">{adventure.chapters[chapter - 1]?.title}</p>
      </div>

      {/* Cenas do capítulo */}
      <div className="space-y-1">
        {SCENES.filter((s) => s.chapter === chapter).map((s) => (
          <button
            key={s.key}
            onClick={() => setPick(s.key)}
            className={cx('flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm',
              s.key === state.sceneKey ? 'bg-emerald-500/15 ring-1 ring-emerald-400/60' : scene?.key === s.key ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10')}
          >
            <span>🎬</span>
            <span className="flex-1 font-semibold">{s.title}</span>
            {s.key === state.sceneKey && <Badge color="emerald">no mapa</Badge>}
            <span className="text-[11px] text-slate-400">👹{s.monsters.length} 🧰{s.chests.length}</span>
          </button>
        ))}
      </div>

      {!scene && (
        <p className="rounded-lg bg-sky-500/10 p-2 text-xs text-sky-100">
          Primeira vez como Mestre? Escolha o capítulo 1, clique em <b>Fuga na tempestade</b> e depois em <b>Carregar cena</b>. O mapa, os monstros, os baús e as quests aparecem sozinhos.
        </p>
      )}

      {scene && (
        <div className="space-y-3 rounded-xl border border-amber-400/30 bg-slate-900/60 p-3">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="font-display text-lg text-amber-200">{scene.title}</p>
              <p className="text-xs text-slate-300">🎯 {scene.goal}</p>
            </div>
          </div>
          {!loaded ? (
            <Button className="w-full" variant="gold" onClick={() => void load(scene)}>🎬 Carregar cena no mapa</Button>
          ) : (
            <Button className="w-full" variant="subtle" size="sm" onClick={() => void load(scene)}>↻ Recomeçar cena</Button>
          )}

          {/* Ler em voz alta */}
          <div className="rounded-lg border-l-4 border-amber-400 bg-amber-950/30 p-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300">📢 Leia em voz alta</p>
            <p className="font-serif text-sm italic leading-relaxed text-amber-50">{scene.readAloud}</p>
            <Button size="sm" variant="subtle" className="mt-2" onClick={() => void send({ type: 'table.narrate', title: scene.title, text: scene.readAloud })}>📺 Mostrar na tela dos jogadores</Button>
          </div>

          {/* Regra que a cena ensina */}
          <div className="rounded-lg bg-sky-500/10 p-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">📘 Regra desta cena</p>
            <p className="text-xs text-sky-50">{scene.gm.regra}</p>
          </div>

          {/* Escondidos */}
          {loaded && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">🙈 Escondidos (só você vê)</p>
              {scene.chests.map((c, i) => {
                const found = nearestChest(state, c, used);
                const hidden = !!found?.tile.o?.hidden;
                const opened = found?.tile.o?.type === 'bau_aberto';
                return (
                  <div key={i} className={cx('rounded-lg p-2 text-xs', hidden ? 'bg-violet-500/10 ring-1 ring-violet-400/40' : 'bg-white/5')}>
                    <div className="flex items-center gap-2">
                      <span>🧰</span>
                      <span className="flex-1 font-semibold">{hidden ? 'Baú escondido' : 'Baú à mostra'}{found ? ` · (${found.x}, ${found.y})` : ''}</span>
                      {opened ? <Badge color="emerald">aberto</Badge> : hidden && found ? (
                        <Button size="sm" variant="gold" onClick={() => void send({ type: 'object.reveal', x: found.x, y: found.y })}>✨ Revelar</Button>
                      ) : c.lockDc ? <Badge color="amber">CD {c.lockDc}</Badge> : null}
                    </div>
                    {c.note && <p className="mt-1 text-slate-300">{c.note}</p>}
                  </div>
                );
              })}
              {scene.monsters.filter((m) => m.note || m.hidden).map((m, i) => {
                const tok = hiddenMonsters.find((t) => t.monsterKey === m.key && (!m.name || t.name === m.name));
                return (
                  <div key={i} className={cx('rounded-lg p-2 text-xs', tok ? 'bg-rose-500/10 ring-1 ring-rose-400/40' : 'bg-white/5')}>
                    <div className="flex items-center gap-2">
                      <span>👹</span>
                      <span className="flex-1 font-semibold">{m.name ?? MONSTERS[m.key]?.label ?? m.key}{m.hidden ? (tok ? ' · escondido' : ' · revelado') : ''}</span>
                      {tok && <Button size="sm" variant="danger" onClick={() => void send({ type: 'token.update', tokenId: tok.id, patch: { hidden: false } })}>👁️ Revelar</Button>}
                    </div>
                    {m.note && <p className="mt-1 text-slate-300">{m.note}</p>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Quests */}
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">📜 Quests</p>
            {scene.quests.map((q) => {
              const live = state.sideQuests.find((x) => x.title === q.title);
              return (
                <div key={q.title} className="rounded-lg bg-white/5 p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge color={q.required ? 'rose' : 'sky'}>{q.required ? 'obrigatória' : 'opcional'}</Badge>
                    {q.hidden && <Badge color="violet">secreta</Badge>}
                    <span className="flex-1 font-semibold">{q.title}</span>
                    <span className="text-amber-200">{q.rewardXp ? `${q.rewardXp} XP` : ''}</span>
                  </div>
                  <p className="mt-1 text-slate-300">{q.description}</p>
                  {live && live.status === 'ativa' && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {live.target > 1 && <Button size="sm" variant="subtle" onClick={() => void send({ type: 'quest.progress', id: live.id, delta: 1 })}>+1 ({live.progress}/{live.target})</Button>}
                      {live.hidden && <Button size="sm" variant="ghost" onClick={() => void send({ type: 'quest.update', id: live.id, hidden: false })}>👁️ Mostrar</Button>}
                      <Button size="sm" variant="gold" onClick={() => void send({ type: 'quest.update', id: live.id, status: 'concluida' })}>✅ Concluir</Button>
                      {!q.required && <Button size="sm" variant="ghost" onClick={() => void send({ type: 'quest.update', id: live.id, status: 'falhou' })}>✖ Falhou</Button>}
                    </div>
                  )}
                  {live && live.status !== 'ativa' && <Badge color={live.status === 'concluida' ? 'emerald' : 'slate'}>{live.status}</Badge>}
                </div>
              );
            })}
          </div>

          {/* Pode / não pode / dicas */}
          <div className="grid gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">✅ Você pode</p>
              <List items={scene.gm.pode} icon="•" color="text-emerald-50" />
            </div>
            <div className="rounded-lg bg-rose-500/10 p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-rose-300">⛔ Evite</p>
              <List items={scene.gm.naoPode} icon="•" color="text-rose-50" />
            </div>
            <div className="rounded-lg bg-amber-500/10 p-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-amber-300">💡 Dicas de Mestre</p>
              <List items={scene.gm.dicas} icon="•" color="text-amber-50" />
            </div>
          </div>
          <p className="rounded-lg bg-white/5 p-2 text-xs text-slate-300">➡️ <b>Depois:</b> {scene.next}</p>
          {loaded && (
            <p className="text-[11px] text-slate-500">
              No mapa, itens escondidos aparecem translúcidos com 👁 só para você.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
