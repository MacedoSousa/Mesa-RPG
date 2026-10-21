import { useEffect, useRef } from 'react';
import type { LogEntry } from '@mesa/shared';
import { cx } from './ui';

const TYPE_STYLE: Record<string, string> = {
  dado: 'border-l-amber-400',
  combate: 'border-l-rose-400',
  turno: 'border-l-sky-400',
  mapa: 'border-l-orange-400',
  quest: 'border-l-emerald-400',
  capitulo: 'border-l-violet-400',
  chat: 'border-l-slate-400',
  divino: 'border-l-yellow-300',
};

export function LogFeed({ entries, className, onLoadMore }: { entries: LogEntry[]; className?: string; onLoadMore?: () => void }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [entries.length]);
  return (
    <div className={cx('space-y-1 overflow-y-auto pr-1 text-sm', className)}>
      {onLoadMore && (
        <button onClick={onLoadMore} className="w-full rounded bg-white/5 py-1 text-xs text-slate-300 hover:bg-white/10">Carregar histórico anterior</button>
      )}
      {entries.map((e) => (
        <div key={e.id} className={cx('rounded border-l-4 bg-white/5 px-2 py-1 text-slate-100', TYPE_STYLE[e.type] ?? 'border-l-slate-600', e.visibility !== 'publico' && 'bg-violet-950/40')}>
          <span className="mr-2 text-[10px] text-slate-400">{new Date(e.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          {e.text}
        </div>
      ))}
      <div ref={end} />
    </div>
  );
}
