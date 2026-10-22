import type { DamageType, Element, LootEntry, LootTier, ObjectType, SurfaceType, TerrainType } from '@mesa/shared';

/** Ferramenta ativa no mapa do Mestre: define o que um clique faz. */
export type Tool =
  | { kind: 'select' }
  | { kind: 'spawn'; monsterKey: string; hidden: boolean }
  | { kind: 'paint'; terrain?: TerrainType; object?: ObjectType | null; surface?: SurfaceType | null }
  | { kind: 'element'; element: Element; radius: number; damage: string }
  | { kind: 'damage'; amount: number; damageType: DamageType }
  /** Mestre escolheu um golpe do monstro: o próximo clique num alvo ataca. */
  | { kind: 'attack'; attackerId: string; attackIndex: number; label: string }
  | { kind: 'chest'; loot: LootEntry[]; dracmas: number; lockDc: number | null; tier?: LootTier; hidden?: boolean };

export function toolLabel(t: Tool): string {
  switch (t.kind) {
    case 'select': return '🖱️ Selecionar / mover';
    case 'spawn': return `👹 Invocar ${t.monsterKey}${t.hidden ? ' (oculto)' : ''}`;
    case 'paint': return `🖌️ Pintar ${t.terrain ?? (t.object === null ? 'remover objeto' : t.object) ?? (t.surface === null ? 'limpar superfície' : t.surface) ?? ''}`;
    case 'element': return `🌪️ Elemento: ${t.element} (raio ${t.radius})`;
    case 'damage': return `💥 Dano ao cenário: ${t.amount} ${t.damageType}`;
    case 'attack': return `⚔️ ${t.label}: clique no alvo`;
    case 'chest': return `🧰 Colocar baú${t.hidden ? ' escondido' : ''}${t.tier ? ` (${t.tier})` : ''}${t.lockDc ? ` trancado CD ${t.lockDc}` : ''}`;
  }
}
