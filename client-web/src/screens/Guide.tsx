import { useState } from 'react';
import { CLASSES, CONDITIONS, DIVINITIES, GUIDE, MONSTERS, RACES, XP_THRESHOLDS } from '@mesa/shared';
import { Button, Card, TokenAvatar, cx, navigate } from '@mesa/common';

/** "Guia para Novatos": mecânicas de RPG de mesa + mitologia, com exemplos. */
export function GuideContent({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState<string | null>(GUIDE[0].key);
  return (
    <div className="space-y-3">
      {GUIDE.map((s) => (
        <section key={s.key} className="rounded-xl border border-white/10 bg-white/5">
          <button onClick={() => setOpen(open === s.key ? null : s.key)} className="flex w-full items-center justify-between p-3 text-left">
            <span className="font-display text-lg text-amber-200">{s.icon} {s.title}</span>
            <span className="text-slate-400">{open === s.key ? '−' : '+'}</span>
          </button>
          {open === s.key && (
            <div className="space-y-2 px-3 pb-3">
              <p className="text-sm text-slate-300">{s.intro}</p>
              {s.terms.map((t) => (
                <details key={t.key} className="rounded-lg bg-slate-950/50 p-2">
                  <summary className="cursor-pointer font-semibold text-slate-100">{t.term} <span className="font-normal text-slate-400">— {t.tooltip}</span></summary>
                  <p className="mt-2 text-sm text-slate-300">{t.details}</p>
                  {t.steps && (
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-200">
                      {t.steps.map((st) => <li key={st}>{st}</li>)}
                    </ol>
                  )}
                  {t.example && <p className="mt-1 text-sm text-amber-200">Exemplo: {t.example}</p>}
                </details>
              ))}
            </div>
          )}
        </section>
      ))}

      {!compact && (
        <>
          <Card title="🧑‍🎓 As classes">
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.values(CLASSES).map((c) => (
                <div key={c.key} className="flex gap-2 rounded-lg bg-white/5 p-2 text-sm">
                  <TokenAvatar artKey={`classe:${c.key}`} size={34} />
                  <div>
                    <strong>{c.label}</strong> <span className="text-slate-400">· d{c.hitDie} de vida</span>
                    <p className="text-slate-300">{c.description}</p>
                    <p className="text-xs text-slate-400">Armaduras: {c.armorProficiencies.join(', ') || 'nenhuma'} · Armas: {[...c.weaponCategoryProficiencies, ...c.weaponProficiencies].slice(0, 5).join(', ') || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="🧬 As raças">
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.values(RACES).map((r) => (
                <div key={r.key} className="rounded-lg bg-white/5 p-2 text-sm">
                  <strong>{r.label}</strong>
                  <p className="text-slate-300">{r.description}</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-slate-400">{r.traits.map((t) => <li key={t.key}><strong>{t.label}:</strong> {t.description}</li>)}</ul>
                </div>
              ))}
            </div>
          </Card>
          <Card title="⭐ Tabela de níveis">
            <div className="grid grid-cols-5 gap-1 text-center text-xs">
              {XP_THRESHOLDS.slice(0, 10).map((xp, i) => (
                <div key={i} className="rounded bg-white/5 p-1"><strong>Nível {i + 1}</strong><br />{xp.toLocaleString('pt-BR')} XP</div>
              ))}
            </div>
          </Card>
          <Card title="😵 Condições">
            <ul className="space-y-1 text-sm">
              {Object.values(CONDITIONS).map((c) => <li key={c.label}><strong>{c.icon} {c.label}:</strong> <span className="text-slate-300">{c.description}</span></li>)}
            </ul>
          </Card>
          <Card title="⚡ Os deuses">
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.values(DIVINITIES).map((d) => (
                <div key={d.key} className="rounded-lg bg-white/5 p-2 text-sm">
                  <strong>{d.symbol} {d.label}</strong> <span className="text-slate-400">— {d.domain}</span>
                  <p className="text-slate-300">{d.description}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card title="👹 Bestiário">
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.values(MONSTERS).map((m) => (
                <div key={m.key} className={cx('flex gap-2 rounded-lg bg-white/5 p-2 text-sm')}>
                  <TokenAvatar artKey={`monstro:${m.key}`} color="#7f1d1d" size={34} />
                  <div>
                  <strong>{m.label}</strong> <span className="text-slate-400">(ND {m.cr} · {m.xp} XP)</span>
                  <p className="text-slate-300">{m.description}</p>
                  <p className="text-xs italic text-slate-400">📜 {m.lore}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

export function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 pb-16">
      <header className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => (history.length > 1 ? history.back() : navigate('/'))}>← Voltar</Button>
        <h1 className="font-display text-2xl text-amber-200">📘 Guia para Novatos</h1>
        <span />
      </header>
      <GuideContent />
    </div>
  );
}
