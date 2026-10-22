import { useEffect, useRef, useState } from 'react';
import type { Fx, ProjectedState } from '@mesa/shared';
import { onFx } from './stores';
import { cx } from './ui';

type Banner = { id: number; text: string; sub?: string; kind: 'capitulo' | 'turno' | 'nivel' | 'vitoria' };
type Narration = { title?: string; text: string; at: number };
type DiceShow = { id: number; total: number; formula: string; crit: boolean; fumble: boolean };

let seq = 0;

const BANNER_STYLE: Record<Banner['kind'], { icon: string; ring: string; text: string; ms: number }> = {
  capitulo: { icon: '📜', ring: 'from-amber-500/0 via-amber-500/35 to-amber-500/0', text: 'text-amber-100', ms: 3600 },
  turno: { icon: '⚔️', ring: 'from-sky-500/0 via-sky-500/40 to-sky-500/0', text: 'text-sky-50', ms: 2200 },
  nivel: { icon: '⭐', ring: 'from-violet-500/0 via-fuchsia-500/45 to-violet-500/0', text: 'text-fuchsia-50', ms: 4200 },
  vitoria: { icon: '🏆', ring: 'from-emerald-500/0 via-emerald-500/40 to-emerald-500/0', text: 'text-emerald-50', ms: 3400 },
};

/** Faces de um d20 visto de frente (hexágono com triângulo interno). */
function D20({ value, rolling, crit, fumble }: { value: number; rolling: boolean; crit: boolean; fumble: boolean }) {
  const stroke = crit ? '#fde047' : fumble ? '#f87171' : '#e9d5ff';
  return (
    <div className={cx('relative h-28 w-28', rolling ? 'mesa-dice-roll' : 'mesa-dice-land')}>
      <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_6px_18px_rgba(0,0,0,0.6)]">
        <defs>
          <linearGradient id="d20g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={crit ? '#a16207' : fumble ? '#7f1d1d' : '#4c1d95'} />
            <stop offset="1" stopColor={crit ? '#422006' : fumble ? '#450a0a' : '#1e1b4b'} />
          </linearGradient>
        </defs>
        <polygon points="50,3 93,27 93,73 50,97 7,73 7,27" fill="url(#d20g)" stroke={stroke} strokeWidth="2.5" />
        <polygon points="50,20 80,68 20,68" fill="rgba(255,255,255,0.08)" stroke={stroke} strokeWidth="1.5" />
        <path d="M50 3 L50 20 M93 27 L80 68 M7 27 L20 68 M50 97 L80 68 M50 97 L20 68 M93 73 L80 68 M7 73 L20 68 M7 27 L50 20 L93 27" stroke={stroke} strokeWidth="1" opacity="0.55" fill="none" />
        <text x="50" y="58" textAnchor="middle" fontSize={value >= 10 ? 22 : 26} fontWeight="900" fill="#fff" stroke="#000" strokeWidth="0.8" paintOrder="stroke">{value}</text>
      </svg>
    </div>
  );
}

function Confetti({ n = 40 }: { n?: number }) {
  const parts = useRef(Array.from({ length: n }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    dur: 1.8 + Math.random() * 1.4,
    color: ['#fde047', '#f472b6', '#a78bfa', '#38bdf8', '#34d399'][i % 5],
    rot: Math.random() * 360,
  }))).current;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {parts.map((p, i) => (
        <span key={i} className="mesa-confetti absolute top-[-10px] h-3 w-1.5 rounded-sm" style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, transform: `rotate(${p.rot}deg)` }} />
      ))}
    </div>
  );
}

/**
 * Camada cinematográfica sobre o mapa: narração do Mestre, banners de capítulo,
 * "Seu turno!", subida de nível, vitória e o d20 rolando.
 */
export function CinematicLayer({ state, myTokenId, myLevel, master = false }: { state: ProjectedState; myTokenId?: string | null; myLevel?: number; master?: boolean }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [narration, setNarration] = useState<Narration | null>(null);
  const [typed, setTyped] = useState(0);
  const [dice, setDice] = useState<DiceShow | null>(null);
  const [rollFace, setRollFace] = useState(1);
  const [rolling, setRolling] = useState(false);

  const pushBanner = (b: Omit<Banner, 'id'>) => setBanners((bs) => [...bs.filter((x) => x.kind !== b.kind), { ...b, id: ++seq }]);

  // Efeitos vindos do servidor
  useEffect(() => {
    const off = onFx((fx: Fx) => {
    if (fx.type === 'narracao') { setNarration({ title: fx.title, text: fx.text, at: Date.now() }); setTyped(0); }
    if (fx.type === 'banner') pushBanner({ text: fx.text, sub: fx.sub, kind: fx.kind });
    if (fx.type === 'dado' && /d20/.test(fx.formula) && (fx.visibility === 'publico' || master)) {
      setDice({ id: ++seq, total: fx.total, formula: fx.formula, crit: false, fumble: false });
    }
    });
    return off;
  }, [master]);

  // Banner expira sozinho
  useEffect(() => {
    if (!banners.length) return;
    const b = banners[0];
    const t = setTimeout(() => setBanners((bs) => bs.filter((x) => x.id !== b.id)), BANNER_STYLE[b.kind].ms);
    return () => clearTimeout(t);
  }, [banners]);

  // Narração: máquina de escrever e fecha sozinha
  useEffect(() => {
    if (!narration) return;
    if (typed < narration.text.length) {
      // Pelo relógio: mesmo com a página ocupada (bonecos sendo montados), o texto não "trava"
      const t = setTimeout(() => setTyped((n) => Math.max(n, Math.min(narration.text.length, Math.floor((Date.now() - narration.at) / 12)))), 24);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setNarration(null), master ? 7000 : Math.max(6000, narration.text.length * 45));
    return () => clearTimeout(t);
  }, [narration, typed, master]);

  // d20: gira mostrando números e cai no resultado
  useEffect(() => {
    if (!dice) return;
    setRolling(true);
    let n = 0;
    const spin = setInterval(() => { setRollFace(1 + Math.floor(Math.random() * 20)); n++; }, 60);
    const land = setTimeout(() => { clearInterval(spin); setRolling(false); setRollFace(dice.total); }, 720);
    const hide = setTimeout(() => setDice((d) => (d?.id === dice.id ? null : d)), 2300);
    return () => { clearInterval(spin); clearTimeout(land); clearTimeout(hide); void n; };
  }, [dice]);

  // "Seu turno!"
  const myTurn = !!state.combat && !!myTokenId && state.combat.currentTokenId === myTokenId;
  const prevTurn = useRef(false);
  useEffect(() => {
    if (myTurn && !prevTurn.current) pushBanner({ kind: 'turno', text: 'Seu turno!', sub: `Rodada ${state.combat?.round ?? 1}` });
    prevTurn.current = myTurn;
  }, [myTurn, state.combat?.round]);

  // Subiu de nível
  const prevLevel = useRef<number | undefined>(myLevel);
  useEffect(() => {
    if (myLevel && prevLevel.current && myLevel > prevLevel.current) pushBanner({ kind: 'nivel', text: `Nível ${myLevel}!`, sub: 'Os deuses notaram seus feitos. Veja a ficha: mais PV e novos poderes.' });
    prevLevel.current = myLevel;
  }, [myLevel]);

  // Vitória: combate terminou sem monstros de pé
  const hadCombat = useRef(!!state.combat);
  useEffect(() => {
    const inCombat = !!state.combat;
    if (hadCombat.current && !inCombat) {
      const standing = state.tokens.some((t) => t.kind === 'monstro' && !t.dead);
      if (!standing) pushBanner({ kind: 'vitoria', text: 'Vitória!', sub: 'O combate acabou. Respirem, curem-se e procurem espólios.' });
    }
    hadCombat.current = inCombat;
  }, [state.combat, state.tokens]);

  const banner = banners[0];
  const style = banner ? BANNER_STYLE[banner.kind] : null;
  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      {banner && style && (
        <div key={banner.id} className="mesa-banner absolute inset-x-0 top-[28%] flex flex-col items-center" style={{ ['--mesa-banner-ms' as string]: `${style.ms}ms` }}>
          <div className={cx('w-full bg-gradient-to-r py-4 text-center backdrop-blur-[2px]', style.ring)}>
            <p className="text-3xl">{style.icon}</p>
            {banner.kind === 'capitulo' && banner.sub && <p className="text-xs uppercase tracking-[0.4em] text-amber-200/90">{banner.sub}</p>}
            <p className={cx('font-display text-4xl font-bold drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)] sm:text-5xl', style.text)}>{banner.text}</p>
            {banner.kind !== 'capitulo' && banner.sub && <p className="mx-auto mt-1 max-w-md px-4 text-sm text-white/90 drop-shadow">{banner.sub}</p>}
          </div>
          {(banner.kind === 'nivel' || banner.kind === 'vitoria') && <Confetti />}
        </div>
      )}

      {dice && (
        <div key={dice.id} className="absolute right-3 top-[42%] flex flex-col items-center">
          <D20 value={rolling ? rollFace : dice.total} rolling={rolling} crit={!rolling && /d20/.test(dice.formula) && dice.total >= 20 && dice.formula === '1d20'} fumble={!rolling && dice.formula === '1d20' && dice.total === 1} />
          <span className="mt-1 rounded-full bg-black/70 px-2 py-0.5 font-mono text-xs text-white">{dice.formula} = {dice.total}</span>
        </div>
      )}

      {narration && master && (
        <div className="mesa-narration absolute inset-x-4 bottom-4 rounded-xl border border-amber-400/40 bg-black/80 p-3 text-sm">
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300">📺 Na tela dos jogadores{narration.title ? ` · ${narration.title}` : ''}</p>
          <p className="line-clamp-3 font-serif italic text-amber-50">{narration.text}</p>
        </div>
      )}
      {narration && !master && (
        <button
          type="button"
          className="pointer-events-auto absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/10 text-left"
          onClick={() => (typed < narration.text.length ? setTyped(narration.text.length) : setNarration(null))}
        >
          <span className="absolute inset-x-0 top-0 h-[7%] bg-black" />
          <span className="absolute inset-x-0 bottom-0 h-[4%] bg-black" />
          <div className="mesa-narration absolute inset-x-0 bottom-[9%] mx-auto w-full max-w-2xl px-6">
            {narration.title && <p className="mb-2 font-display text-sm uppercase tracking-[0.35em] text-amber-300">{narration.title}</p>}
            <p className="font-serif text-lg italic leading-relaxed text-amber-50 sm:text-xl">
              {narration.text.slice(0, typed)}
              {typed < narration.text.length && <span className="animate-pulse">▍</span>}
            </p>
            <p className="mt-4 text-[11px] text-white/50">{typed < narration.text.length ? 'toque para ver tudo' : 'toque para fechar'}</p>
          </div>
        </button>
      )}
    </div>
  );
}
