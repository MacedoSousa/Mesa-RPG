import { AFFIXES, rankOf, type EquipComparison, type ItemDef } from '@mesa/shared';
import { cx } from './ui';

/** Nome do item na cor do rank (cinza → verde → azul → roxo → dourado). */
export function ItemName({ item, fallback, className }: { item: ItemDef | null | undefined; fallback?: string; className?: string }) {
  const r = rankOf(item ?? undefined);
  const special = (item?.rank ?? 0) > 0 || !!item?.affix;
  return (
    <span className={cx('font-semibold', className)} style={special ? { color: r.color } : undefined}>
      {item?.name ?? fallback}
      {special && (
        <span className="ml-1.5 rounded px-1 py-px align-middle text-[10px] font-bold uppercase tracking-wide" style={{ background: `${r.color}22`, color: r.color, border: `1px solid ${r.color}66` }}>
          {r.label}
        </span>
      )}
    </span>
  );
}

/** Linha curta com o efeito do encantamento. */
export function AffixLine({ item }: { item: ItemDef | null | undefined }) {
  const a = item?.affix ? AFFIXES[item.affix] : null;
  if (!a) return null;
  return <p className="text-[11px] text-violet-200">✨ {a.label}: {a.description}</p>;
}

/** Setas ▲▼ comparando com o que está equipado. */
export function CompareDeltas({ cmp, compact }: { cmp: EquipComparison; compact?: boolean }) {
  if (!cmp.deltas.length) return compact ? null : <p className="text-[11px] text-slate-400">= igual ao que você usa</p>;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {cmp.score > 0 && cmp.allowed && <span className="rounded-full bg-emerald-500/20 px-2 py-px text-[11px] font-bold text-emerald-300">⬆ Melhor que o seu</span>}
      {cmp.deltas.map((d) => (
        <span
          key={d.label}
          title={`${d.before} → ${d.after}`}
          className={cx('rounded-full px-2 py-px text-[11px]', d.delta > 0 ? 'bg-emerald-500/15 text-emerald-300' : d.delta < 0 ? 'bg-rose-500/15 text-rose-300' : 'bg-white/10 text-slate-300')}
        >
          {d.delta > 0 ? '▲' : d.delta < 0 ? '▼' : '•'} {d.label} {d.before} → {d.after}
        </span>
      ))}
    </div>
  );
}
