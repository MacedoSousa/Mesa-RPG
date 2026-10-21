/**
 * Atributos, point-buy e perícias (SRD 5.2.1, CC-BY-4.0).
 */

export const ABILITIES = ['forca', 'destreza', 'constituicao', 'inteligencia', 'sabedoria', 'carisma'] as const;
export type Ability = (typeof ABILITIES)[number];
export type AbilityScores = Record<Ability, number>;

export const ABILITY_LABELS: Record<Ability, { label: string; short: string; hint: string }> = {
  forca: { label: 'Força', short: 'FOR', hint: 'Poder físico: ataques corpo a corpo, carregar peso, empurrar.' },
  destreza: { label: 'Destreza', short: 'DES', hint: 'Agilidade: armas de acuidade e à distância, iniciativa, CA sem armadura pesada.' },
  constituicao: { label: 'Constituição', short: 'CON', hint: 'Resistência: aumenta seus Pontos de Vida e Estamina.' },
  inteligencia: { label: 'Inteligência', short: 'INT', hint: 'Raciocínio e memória: Arcanismo, História, Investigação.' },
  sabedoria: { label: 'Sabedoria', short: 'SAB', hint: 'Percepção e intuição: Percepção, Intuição, Sobrevivência.' },
  carisma: { label: 'Carisma', short: 'CAR', hint: 'Presença: Persuasão, Enganação, Intimidação, Atuação.' },
};

/** Point-buy padrão: 27 pontos, valores base de 8 a 15. */
export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;
export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;
export const ABILITY_CAP = 20;

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : String(mod);
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);
}

export interface PointBuyResult {
  ok: boolean;
  spent: number;
  remaining: number;
  errors: string[];
}

export function validatePointBuy(base: Partial<AbilityScores>): PointBuyResult {
  const errors: string[] = [];
  let spent = 0;
  for (const ability of ABILITIES) {
    const v = base[ability];
    if (typeof v !== 'number' || !Number.isInteger(v)) {
      errors.push(`${ABILITY_LABELS[ability].label}: valor ausente`);
      continue;
    }
    if (v < POINT_BUY_MIN || v > POINT_BUY_MAX) {
      errors.push(`${ABILITY_LABELS[ability].label}: deve ficar entre ${POINT_BUY_MIN} e ${POINT_BUY_MAX} antes dos bônus`);
      continue;
    }
    spent += POINT_BUY_COST[v];
  }
  if (spent > POINT_BUY_BUDGET) errors.push(`Você gastou ${spent} pontos; o limite é ${POINT_BUY_BUDGET}`);
  return { ok: errors.length === 0, spent, remaining: POINT_BUY_BUDGET - spent, errors };
}

// ───────────── Perícias ─────────────

export const SKILLS = {
  acrobacia: { label: 'Acrobacia', ability: 'destreza' },
  arcanismo: { label: 'Arcanismo', ability: 'inteligencia' },
  atletismo: { label: 'Atletismo', ability: 'forca' },
  atuacao: { label: 'Atuação', ability: 'carisma' },
  enganacao: { label: 'Enganação', ability: 'carisma' },
  furtividade: { label: 'Furtividade', ability: 'destreza' },
  historia: { label: 'História', ability: 'inteligencia' },
  intimidacao: { label: 'Intimidação', ability: 'carisma' },
  intuicao: { label: 'Intuição', ability: 'sabedoria' },
  investigacao: { label: 'Investigação', ability: 'inteligencia' },
  lidar_animais: { label: 'Lidar com Animais', ability: 'sabedoria' },
  medicina: { label: 'Medicina', ability: 'sabedoria' },
  natureza: { label: 'Natureza', ability: 'inteligencia' },
  percepcao: { label: 'Percepção', ability: 'sabedoria' },
  persuasao: { label: 'Persuasão', ability: 'carisma' },
  prestidigitacao: { label: 'Prestidigitação', ability: 'destreza' },
  religiao: { label: 'Religião', ability: 'inteligencia' },
  sobrevivencia: { label: 'Sobrevivência', ability: 'sabedoria' },
} as const satisfies Record<string, { label: string; ability: Ability }>;
export type Skill = keyof typeof SKILLS;
export const SKILL_KEYS = Object.keys(SKILLS) as Skill[];

// ───────────── Experiência e níveis (tabela do SRD) ─────────────

export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000] as const;
export const MAX_LEVEL = 20;

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < XP_THRESHOLDS.length; i++) if (xp >= XP_THRESHOLDS[i]) level = i + 1;
  return Math.min(MAX_LEVEL, level);
}

/** XP necessário para chegar ao próximo nível (null no nível máximo). */
export function xpForNextLevel(level: number): number | null {
  return level >= MAX_LEVEL ? null : XP_THRESHOLDS[level];
}
