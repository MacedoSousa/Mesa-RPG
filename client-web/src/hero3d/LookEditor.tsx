import { BODY_KEYS, BODY_LABELS, OUTFIT_COLORS, cx, type HeroLook, type PortraitSpec } from '@mesa/common';

/** Ajustes do corpo 3D: silhueta, cor da roupa, altura, porte e elmo/chapéu. */
export function LookEditor({ spec, onChange }: { spec: PortraitSpec; onChange: (s: PortraitSpec) => void }) {
  const look: HeroLook = spec.look ?? {};
  const set = (patch: Partial<HeroLook>) => onChange({ ...spec, look: { ...look, ...patch } });
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-xs text-slate-400">Silhueta</p>
        <div className="flex flex-wrap gap-1.5">
          {BODY_KEYS.map((b) => (
            <button key={b} type="button" onClick={() => set({ body: b })} className={cx('rounded-full border px-3 py-1 text-xs', (look.body ?? 'auto') === b ? 'border-amber-400 bg-amber-500/20 text-amber-100' : 'border-white/15 bg-white/5')}>
              {BODY_LABELS[b]}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 text-xs text-slate-400">Cor da roupa</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => set({ outfit: null })} className={cx('h-7 rounded-full border-2 px-2 text-[11px]', !look.outfit ? 'border-amber-300' : 'border-white/20')}>original</button>
          {OUTFIT_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => set({ outfit: c })} title={c === '#f97316' ? 'Laranja do Acampamento' : c} className={cx('h-7 w-7 rounded-full border-2', look.outfit === c ? 'border-amber-300 ring-2 ring-amber-400/50' : 'border-white/20')} style={{ background: c }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-400">
          Altura
          <input type="range" min={0.9} max={1.1} step={0.01} value={look.height ?? 1} onChange={(e) => set({ height: Number(e.target.value) })} className="w-full accent-amber-400" />
        </label>
        <label className="text-xs text-slate-400">
          Porte
          <input type="range" min={0.9} max={1.15} step={0.01} value={look.build ?? 1} onChange={(e) => set({ build: Number(e.target.value) })} className="w-full accent-amber-400" />
        </label>
      </div>
      <div>
        <p className="mb-1 text-xs text-slate-400">Elmo / chapéu / capuz</p>
        <div className="flex gap-1.5">
          {([['auto', undefined], ['mostrar', true], ['esconder', false]] as const).map(([label, v]) => (
            <button key={label} type="button" onClick={() => set({ headgear: v })} className={cx('rounded-full border px-3 py-1 text-xs', look.headgear === v ? 'border-amber-400 bg-amber-500/20 text-amber-100' : 'border-white/15 bg-white/5')}>
              {label === 'auto' ? 'Automático (pela armadura)' : label === 'mostrar' ? 'Mostrar' : 'Esconder'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
