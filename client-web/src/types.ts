import type { AbilityScores, DerivedStats, Equipment, ItemDef } from '@mesa/shared';

/** Ficha como o servidor devolve (ver server/src/services/characterService.ts). */
export interface CharacterDTO {
  id: string;
  userId: string;
  campaignId: string | null;
  name: string;
  race: string;
  raceLabel: string;
  divinity: string;
  divinityLabel: string;
  classKey: string;
  classLabel: string;
  level: number;
  experience: number;
  affinity: number;
  affinityTier: string;
  baseAbilities: AbilityScores;
  skills: string[];
  equipment: Equipment;
  hp: number;
  stamina: number;
  stats: DerivedStats;
  inventory: { itemKey: string; quantity: number; item: ItemDef | null; allowed: boolean; reasons: string[] }[];
  sheet: { backstory: string; personality: string; appearance: string; notes: string; languages: string[] } | null;
  deletedAt: string | null;
}

export interface CampaignDTO {
  id: string;
  name: string;
  description: string;
  joinCode?: string;
  masterId?: string;
  isMaster?: boolean;
}
