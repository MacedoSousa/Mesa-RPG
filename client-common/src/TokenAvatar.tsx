import { useEffect, useState } from 'react';
import { artUrl, loadPaintedArt, onArtLoaded, paintedUrl } from './tokenArt';

/** Miniatura redonda do ícone (ou da arte pintada) de um token/classe/monstro. */
export function TokenAvatar({ artKey, color = '#334155', size = 28, title }: { artKey: string; color?: string; size?: number; title?: string }) {
  const [, bump] = useState(0);
  useEffect(() => {
    if (artKey.startsWith('monstro:')) void loadPaintedArt();
    const off = onArtLoaded(() => bump((n) => n + 1));
    return () => {
      off();
    };
  }, [artKey]);
  const painted = paintedUrl(artKey);
  return (
    <span
      title={title}
      className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/80"
      style={{ width: size, height: size, background: color }}
    >
      {painted ? (
        <img src={painted} alt="" width={size} height={size} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <img src={artUrl(artKey)} alt="" width={size * 0.68} height={size * 0.68} draggable={false} />
      )}
    </span>
  );
}
