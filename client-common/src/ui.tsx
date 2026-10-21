import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { findGuideTerm } from '@mesa/shared';
import { useToasts } from './stores';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'ghost' | 'danger' | 'gold' | 'subtle';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-sky-600 hover:bg-sky-500 text-white',
  gold: 'bg-amber-500 hover:bg-amber-400 text-slate-950',
  danger: 'bg-rose-700 hover:bg-rose-600 text-white',
  ghost: 'bg-transparent hover:bg-white/10 text-slate-100 border border-white/15',
  subtle: 'bg-white/5 hover:bg-white/10 text-slate-100',
};

export function Button({ variant = 'primary', className, size = 'md', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'px-2.5 py-1 text-sm', md: 'px-3.5 py-2', lg: 'px-5 py-3 text-lg' };
  return (
    <button
      {...p}
      className={cx('rounded-lg font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none', VARIANTS[variant], sizes[size], className)}
    />
  );
}

export function Card({ children, className, title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={cx('rounded-xl border border-white/10 bg-slate-900/70 p-4 shadow-lg backdrop-blur', className)}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title && <h2 className="font-display text-lg text-amber-200">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, className, ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm text-slate-300">{label}</span>
      <input {...p} className="w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-400" />
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function TextArea({ label, value, onChange, rows = 4 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-slate-300">{label}</span>
      <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-slate-100 outline-none focus:border-sky-400" />
    </label>
  );
}

export function Select<T extends string>({ label, value, onChange, options, className }: { label?: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="mb-1 block text-sm text-slate-300">{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-slate-100">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: 'slate' | 'amber' | 'sky' | 'rose' | 'emerald' | 'violet' }) {
  const colors = {
    slate: 'bg-slate-700/70 text-slate-100', amber: 'bg-amber-500/20 text-amber-200 border-amber-400/40', sky: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
    rose: 'bg-rose-500/20 text-rose-200 border-rose-400/40', emerald: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40', violet: 'bg-violet-500/20 text-violet-200 border-violet-400/40',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5 text-xs font-semibold', colors[color])}>{children}</span>;
}

export function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="w-full">
      <div className="mb-0.5 flex justify-between text-xs font-semibold"><span>{label}</span><span>{value}/{max}</span></div>
      <div className="h-2.5 overflow-hidden rounded-full bg-black/50">
        <div className={cx('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: { key: T; label: ReactNode }[]; value: T; onChange: (k: T) => void; className?: string }) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto', className)}>
      {tabs.map((t) => (
        <button key={t.key} onClick={() => onChange(t.key)} className={cx('whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition', value === t.key ? 'bg-amber-500 text-slate-950' : 'bg-white/5 text-slate-200 hover:bg-white/10')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-xl text-amber-200">{title}</h3>
          <button onClick={onClose} className="rounded-lg px-2 text-2xl text-slate-400 hover:text-white" aria-label="Fechar">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * Termo com tooltip do Guia para Novatos. Passe o mouse (PC) ou toque (celular).
 * Ex.: <Term k="ca">CA</Term>
 */
export function Term({ k, children }: { k: string; children?: ReactNode }) {
  const term = findGuideTerm(k);
  const [open, setOpen] = useState(false);
  if (!term) return <>{children}</>;
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} className="cursor-help border-b border-dotted border-amber-300/70 text-inherit">
        {children ?? term.term}
      </button>
      {open && (
        <span role="tooltip" className="absolute bottom-full left-1/2 z-40 mb-2 w-60 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-slate-950 p-2 text-left text-xs font-normal leading-snug text-slate-100 shadow-xl">
          <strong className="block text-amber-200">{term.term}</strong>
          {term.tooltip}
        </span>
      )}
    </span>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  const colors = { info: 'border-sky-400/50', erro: 'border-rose-400/70 bg-rose-950/90', sucesso: 'border-emerald-400/60', dado: 'border-amber-400/70' };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[60] flex flex-col-reverse items-center gap-2 px-2">
      {toasts.map((t) => (
        <button key={t.id} onClick={() => dismiss(t.id)} className={cx('pointer-events-auto max-w-md rounded-xl border bg-slate-900/95 px-4 py-2 text-sm text-slate-100 shadow-xl', colors[t.kind])}>
          {t.text}
        </button>
      ))}
    </div>
  );
}

export function Spinner({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-8 text-slate-300">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-amber-300 border-t-transparent" />
      {label}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-slate-300">
      <div className="text-4xl">{icon}</div>
      <p className="mt-2 font-semibold text-slate-100">{title}</p>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}

// ───────────── Roteamento por hash (#/rota/param) ─────────────

export function useHashRoute(): [string[], (path: string) => void] {
  const parse = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [parts, setParts] = useState(parse);
  useEffect(() => {
    const on = () => setParts(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return [parts, (path: string) => { window.location.hash = path.startsWith('/') ? path : `/${path}`; }];
}

export const navigate = (path: string) => { window.location.hash = path.startsWith('/') ? path : `/${path}`; };
