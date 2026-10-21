import { useMemo } from 'react';
import {
  BG_COLORS, EYE_COLORS, HAIR_COLORS, PORTRAIT_FIELDS, RACE_FEATURES, SKIN_TONES, portraitUrl, randomPortrait, type PortraitSpec,
} from './portrait';
import { Button, cx } from './ui';

const LABELS: Record<string, string> = {
  oval: 'Oval', redondo: 'Redondo', quadrado: 'Quadrado', longo: 'Longo', coracao: 'Coração',
  curto: 'Curto', arrepiado: 'Arrepiado', rabo: 'Rabo de cavalo', coque: 'Coque', cacheado: 'Cacheado', trancas: 'Tranças', raspado: 'Raspado', franja: 'Franja', black_power: 'Black power',
  normal: 'Normal', amendoado: 'Amendoado', sereno: 'Sereno (fechados)', determinado: 'Determinado',
  sorriso: 'Sorriso', neutro: 'Neutro', confiante: 'Confiante', aberto: 'Rindo', serio: 'Sério',
  nenhuma: 'Nenhuma', curta: 'Curta', cheia: 'Cheia', cavanhaque: 'Cavanhaque', bigode: 'Bigode',
  bochecha: 'Bochecha', olho: 'No olho', queixo: 'Queixo',
  nenhum: 'Nenhum', louros: 'Coroa de louros', elmo: 'Elmo grego', diadema: 'Diadema', capuz: 'Capuz', faixa: 'Faixa', brinco: 'Brincos', oculos: 'Óculos',
  satiro: 'Sátiro (chifres)', ninfa: 'Ninfa (folhas)', ciclope: 'Ciclope (um olho)', cacadora: 'Caçador(a)', divino: 'Brilho divino',
};

function Swatches({ value, colors, onChange }: { value: string; colors: readonly string[]; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} title={c} className={cx('h-7 w-7 rounded-full border-2', value === c ? 'border-amber-300 ring-2 ring-amber-400/50' : 'border-white/20')} style={{ background: c }} />
      ))}
    </div>
  );
}

/** Editor do rosto do herói: sorteia por semente e deixa ajustar cada parte. */
export function PortraitEditor({ value, onChange, race, name }: { value: PortraitSpec | null; onChange: (s: PortraitSpec) => void; race: string; name?: string }) {
  const spec = useMemo(() => value ?? randomPortrait(`${name || 'heroi'}-${race}`, race), [value, race, name]);
  const set = <K extends keyof PortraitSpec>(k: K, v: PortraitSpec[K]) => onChange({ ...spec, [k]: v });
  const reroll = () => onChange(randomPortrait(`${Date.now()}-${Math.random()}`, race));
  const cycle = (field: keyof typeof PORTRAIT_FIELDS, dir: 1 | -1) => {
    const opts = PORTRAIT_FIELDS[field].options as readonly string[];
    const i = opts.indexOf(spec[field] as string);
    set(field, opts[(i + dir + opts.length) % opts.length] as never);
  };

  return (
    <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
      <div className="flex flex-col items-center gap-2">
        <img src={portraitUrl(spec, 180)} alt="Retrato do herói" width={170} height={170} className="rounded-full shadow-xl" />
        <Button size="sm" variant="gold" onClick={reroll}>🎲 Sortear outro rosto</Button>
        <p className="text-center text-[11px] text-slate-400">Seu rosto aparece no token do mapa e na ficha.</p>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {(Object.keys(PORTRAIT_FIELDS) as (keyof typeof PORTRAIT_FIELDS)[]).map((f) => (
            <div key={f} className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-sm">
              <span className="w-20 text-slate-400">{PORTRAIT_FIELDS[f].label}</span>
              <button type="button" className="rounded px-2 hover:bg-white/10" onClick={() => cycle(f, -1)} aria-label="anterior">‹</button>
              <span className="flex-1 text-center">{LABELS[spec[f] as string] ?? spec[f]}</span>
              <button type="button" className="rounded px-2 hover:bg-white/10" onClick={() => cycle(f, 1)} aria-label="próximo">›</button>
            </div>
          ))}
          <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-sm">
            <span className="w-20 text-slate-400">Traço</span>
            <select value={spec.race} onChange={(e) => set('race', e.target.value as PortraitSpec['race'])} className="flex-1 rounded bg-slate-900 px-1 py-0.5">
              {RACE_FEATURES.map((r) => <option key={r} value={r}>{LABELS[r] ?? r}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1 text-sm">
            <input type="checkbox" checked={spec.freckles} onChange={(e) => set('freckles', e.target.checked)} /> Sardas
          </label>
        </div>
        <div><p className="mb-1 text-xs text-slate-400">Pele</p><Swatches value={spec.skin} colors={SKIN_TONES} onChange={(c) => set('skin', c)} /></div>
        <div><p className="mb-1 text-xs text-slate-400">Cabelo</p><Swatches value={spec.hairColor} colors={HAIR_COLORS} onChange={(c) => set('hairColor', c)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><p className="mb-1 text-xs text-slate-400">Olhos</p><Swatches value={spec.eyeColor} colors={EYE_COLORS} onChange={(c) => set('eyeColor', c)} /></div>
          <div><p className="mb-1 text-xs text-slate-400">Fundo</p><Swatches value={spec.bg} colors={BG_COLORS} onChange={(c) => set('bg', c)} /></div>
        </div>
      </div>
    </div>
  );
}
