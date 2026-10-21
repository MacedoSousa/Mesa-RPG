import { artUrl } from './tokenArt';

/** Miniatura redonda do ícone de um token/classe/monstro para listas e cartões. */
export function TokenAvatar({ artKey, color = '#334155', size = 28, title }: { artKey: string; color?: string; size?: number; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white/80"
      style={{ width: size, height: size, background: color }}
    >
      <img src={artUrl(artKey)} alt="" width={size * 0.68} height={size * 0.68} draggable={false} />
    </span>
  );
}
