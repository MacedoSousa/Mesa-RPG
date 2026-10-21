import { useState } from 'react';
import { CONDITIONS, DIVINITIES, GUIDE, MONSTERS } from '@mesa/shared';
import { Button, Card, cx, navigate } from '@mesa/common';

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
                  {t.example && <p className="mt-1 text-sm text-amber-200">Exemplo: {t.example}</p>}
                </details>
              ))}
            </div>
          )}
        </section>
      ))}

      {!compact && (
        <>
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
                <div key={m.key} className={cx('rounded-lg bg-white/5 p-2 text-sm')}>
                  <strong>{m.label}</strong> <span className="text-slate-400">(ND {m.cr})</span>
                  <p className="text-slate-300">{m.description}</p>
                  <p className="text-xs italic text-slate-400">📜 {m.lore}</p>
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
