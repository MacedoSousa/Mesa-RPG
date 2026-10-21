import type { DamageType, Element, ObjectType, SurfaceType, TerrainType } from '@mesa/shared';

/** Ferramenta ativa no mapa do Mestre: define o que um clique faz. */
export type Tool =
  | { kind: 'select' }
  | { kind: 'spawn'; monsterKey: string; hidden: boolean }
  | { kind: 'paint'; terrain?: TerrainType; object?: ObjectType | null; surface?: SurfaceType | null }
  | { kind: 'element'; element: Element; radius: number; damage: string }
  | { kind: 'damage'; amount: number; damageType: DamageType };

export function toolLabel(t: Tool): string {
  switch (t.kind) {
    case 'select': return '🖱️ Selecionar / mover';
    case 'spawn': return `👹 Invocar ${t.monsterKey}${t.hidden ? ' (oculto)' : ''}`;
    case 'paint': return `🖌️ Pintar ${t.terrain ?? (t.object === null ? 'remover objeto' : t.object) ?? (t.surface === null ? 'limpar superfície' : t.surface) ?? ''}`;
    case 'element': return `🌪️ Elemento: ${t.element} (raio ${t.radius})`;
    case 'damage': return `💥 Dano ao cenário: ${t.amount} ${t.damageType}`;
  }
}
