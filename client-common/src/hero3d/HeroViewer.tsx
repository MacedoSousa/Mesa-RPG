import { useEffect, useRef, useState } from 'react';
import { cx } from '../index';
import { HeroStage, type HeroAction, type HeroConfig } from './heroKit';

const MONSTER_ACTIONS: HeroAction[] = ['atacar', 'ferido', 'andar', 'cair', 'parado'];

export interface HeroViewerHandle {
  play: (a: HeroAction) => void;
  focus: (f: 'corpo' | 'rosto') => void;
  snapshot: () => string | null;
}

const ACTIONS: { key: HeroAction; label: string }[] = [
  { key: 'atacar', label: '⚔️ Atacar' },
  { key: 'defender', label: '🛡️ Defender' },
  { key: 'magia', label: '✨ Magia' },
  { key: 'esquivar', label: '💨 Esquivar' },
  { key: 'pular', label: '🦘 Pular' },
  { key: 'comemorar', label: '🎉 Comemorar' },
  { key: 'reclamado', label: '🌟 Reclamado' },
  { key: 'andar', label: '🚶 Andar' },
  { key: 'correr', label: '🏃 Correr' },
  { key: 'sentar', label: '🔥 Fogueira' },
  { key: 'ferido', label: '💥 Ferido' },
  { key: 'cair', label: '💀 Cair' },
  { key: 'parado', label: '🧍 Parado' },
];

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Palco 3D do herói com rotação por arrasto, zoom e botões de animação. */
export default function HeroViewer({ config, monster, focus = 'corpo', className, compact, onReady, controls = true }: {
  config?: HeroConfig;
  /** Mostra um monstro do bestiário em vez de um herói. */
  monster?: string;
  focus?: 'corpo' | 'rosto';
  className?: string;
  compact?: boolean;
  controls?: boolean;
  onReady?: (h: HeroViewerHandle) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<HeroStage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);
  const [showActions, setShowActions] = useState(!compact);
  const key = JSON.stringify(monster ? { monster } : { hero: config });

  useEffect(() => {
    if (!host.current) return;
    if (!webglAvailable()) {
      setFailed('Seu navegador não liberou o 3D (WebGL). O retrato 2D continua valendo.');
      return;
    }
    let s: HeroStage;
    try {
      s = new HeroStage(host.current);
    } catch {
      setFailed('Não foi possível iniciar o 3D neste aparelho.');
      return;
    }
    stage.current = s;
    (window as unknown as { __heroStage?: HeroStage }).__heroStage = s; // usado pelos testes visuais
    s.onLoading = setLoading;
    s.onError = () => setFailed('Não consegui carregar o modelo 3D. Verifique a conexão com o Host.');
    onReady?.({
      play: (a) => s.play(a),
      focus: (f) => s.setFocus(f),
      snapshot: () => s.snapshot(),
    });
    return () => {
      s.dispose();
      stage.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (monster) void stage.current?.show({ monster });
    else if (config) void stage.current?.show({ hero: config });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    stage.current?.setFocus(focus);
  }, [focus]);

  return (
    <div className={cx('relative overflow-hidden rounded-2xl border border-amber-500/20 bg-slate-950 shadow-2xl', className)}>
      <div ref={host} className="absolute inset-0" />
      {failed && <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-slate-300">{failed}</div>}
      {loading && !failed && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-full bg-slate-950/70 px-4 py-2 text-sm text-amber-200">⚒️ Forjando o herói…</div>
        </div>
      )}
      {!failed && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-2 text-[11px] text-slate-300/80">
            <span>↔ arraste para girar · pinça/roda para aproximar</span>
          </div>
          <div className="absolute right-2 top-7 flex flex-col gap-1">
            <button type="button" onClick={() => stage.current?.setFocus('rosto')} className="rounded-lg bg-slate-900/70 px-2 py-1 text-xs hover:bg-slate-800" title="Aproximar do rosto">🔍 Rosto</button>
            <button type="button" onClick={() => stage.current?.setFocus('corpo')} className="rounded-lg bg-slate-900/70 px-2 py-1 text-xs hover:bg-slate-800" title="Corpo inteiro">🧍 Corpo</button>
          </div>
          {controls && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-2">
              {compact && (
                <button type="button" onClick={() => setShowActions((v) => !v)} className="mb-1 rounded-full bg-slate-900/80 px-3 py-1 text-xs text-amber-200">
                  {showActions ? '▾ Esconder poses' : '▴ Poses e animações'}
                </button>
              )}
              {showActions && (
                <div className="flex flex-wrap justify-center gap-1">
                  {ACTIONS.filter((a) => !monster || MONSTER_ACTIONS.includes(a.key)).map((a) => (
                    <button key={a.key} type="button" onClick={() => stage.current?.play(a.key)} className="rounded-full bg-slate-900/80 px-2.5 py-1 text-xs text-slate-100 ring-1 ring-white/10 hover:bg-amber-500/30">
                      {a.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
