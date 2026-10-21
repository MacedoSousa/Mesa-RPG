export const CONDITIONS = {
  caido: { label: 'Caído', icon: '🛌', description: 'Ataques corpo a corpo contra você têm vantagem; à distância, desvantagem. Levantar custa metade do movimento.' },
  esquivando: { label: 'Esquivando', icon: '🌀', description: 'Ataques contra você têm desvantagem até o início do seu próximo turno.' },
  molhado: { label: 'Molhado', icon: '💧', description: 'Resistência a fogo, mas dano elétrico e de frio é dobrado.' },
  envenenado: { label: 'Envenenado', icon: '🤢', description: 'Desvantagem em jogadas de ataque.' },
  atordoado: { label: 'Atordoado', icon: '💫', description: 'Perde o próximo turno; ataques contra você têm vantagem.' },
  amedrontado: { label: 'Amedrontado', icon: '😱', description: 'Desvantagem em ataques enquanto a fonte do medo estiver visível.' },
  enfeiticado: { label: 'Enfeitiçado', icon: '💘', description: 'Não pode atacar quem o enfeitiçou (o Mestre controla).' },
  inconsciente: { label: 'Inconsciente', icon: '😵', description: 'Com 0 PV: não age; ataques corpo a corpo contra você são críticos.' },
  desengajado: { label: 'Desengajado', icon: '🏃', description: 'Seu movimento não provoca ataques de oportunidade neste turno.' },
} as const;

export type Condition = keyof typeof CONDITIONS;
export const CONDITION_KEYS = Object.keys(CONDITIONS) as Condition[];
