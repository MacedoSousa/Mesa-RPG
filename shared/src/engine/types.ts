import type { Condition } from '../content/conditions';
import type { DivinePower } from '../content/divinities';
import type { DamageType } from '../content/items';
import type { AttackDef } from '../content/monsters';
import type { AbilityScores } from '../rules/abilities';

export const TABLE_SCHEMA_VERSION = 1;

export type TerrainType =
  | 'grama' | 'terra' | 'pedra' | 'areia' | 'marmore' | 'nuvem' | 'madeira'
  | 'agua_rasa' | 'agua_profunda' | 'lava' | 'abismo' | 'estige'
  | 'parede' | 'coluna' | 'arvore' | 'toco' | 'escombros' | 'ponte' | 'portao' | 'elevado';

export type SurfaceType = 'fogo' | 'agua' | 'agua_eletrificada' | 'gelo' | 'oleo' | 'veneno' | 'vapor';

export type ObjectType = 'barril_explosivo' | 'barril_agua' | 'barril_oleo' | 'caixote' | 'estatua' | 'braseiro';

export interface Surface {
  type: SurfaceType;
  rounds: number;
}

export interface MapObject {
  type: ObjectType;
  hp: number;
}

export interface Tile {
  t: TerrainType;
  /** PV restante do terreno destrutível (ausente = intacto/indestrutível). */
  hp?: number;
  s?: Surface | null;
  o?: MapObject | null;
}

export interface MapState {
  id: string | null;
  name: string;
  preset?: string | null;
  width: number;
  height: number;
  tiles: Tile[];
}

export type TokenKind = 'personagem' | 'monstro' | 'npc';

export interface Token {
  id: string;
  kind: TokenKind;
  name: string;
  ownerUserId: string | null;
  characterId?: string | null;
  monsterKey?: string | null;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  tempHp: number;
  ac: number;
  /** Deslocamento em quadrados. */
  speed: number;
  stamina: number;
  maxStamina: number;
  initiativeBonus: number;
  abilityMods: AbilityScores;
  proficiency: number;
  attacks: AttackDef[];
  resistances: DamageType[];
  conditionAdvantage: string[];
  conditions: Condition[];
  power: DivinePower | null;
  /** Consumíveis carregados para a mesa (sincronizados com o inventário). */
  consumables: Record<string, number>;
  hidden: boolean;
  dead: boolean;
  color?: string;
}

export interface Economy {
  action: number;
  bonusAction: number;
  reaction: number;
  movement: number;
}

export interface InitiativeEntry {
  tokenId: string;
  initiative: number;
}

export interface CombatState {
  round: number;
  order: InitiativeEntry[];
  turnIndex: number;
  economy: Record<string, Economy>;
}

export interface Chapter {
  id: string;
  title: string;
  description: string;
  status: 'pendente' | 'ativo' | 'concluido';
  order: number;
}

export interface QuestExpireTrigger {
  message?: string;
  spawn?: { monsterKey: string; x: number; y: number; hidden?: boolean };
}

export interface SideQuest {
  id: string;
  title: string;
  description: string;
  status: 'ativa' | 'concluida' | 'falhou' | 'expirada';
  hidden: boolean;
  progress: number;
  target: number;
  /** Expira ao fim desta rodada de combate. */
  expiresAtRound: number | null;
  /** Expira neste instante (epoch ms) — contagem regressiva em tempo real. */
  expiresAt: number | null;
  reward: string;
  onExpire: QuestExpireTrigger | null;
  createdAt: number;
}

/** publico: todos · mestre: só o Mestre · privado: o autor e o Mestre. */
export type Visibility = 'publico' | 'mestre' | 'privado';

export interface LogEntry {
  id: number;
  at: number;
  type: string;
  text: string;
  visibility: Visibility;
  actorUserId?: string | null;
  data?: Record<string, unknown>;
}

export interface PlayerInfo {
  userId: string;
  username: string;
  characterId: string | null;
  paused: boolean;
  connected: boolean;
}

export type Phase = 'exploracao' | 'combate';

export interface TableState {
  schemaVersion: number;
  campaignId: string;
  name: string;
  phase: Phase;
  paused: boolean;
  chapters: Chapter[];
  activeChapterId: string | null;
  map: MapState;
  tokens: Token[];
  combat: CombatState | null;
  sideQuests: SideQuest[];
  players: Record<string, PlayerInfo>;
  log: LogEntry[];
  /** Incrementa a cada comando aplicado (ordem/ressincronização). */
  seq: number;
  logSeq: number;
  updatedAt: number;
}

/** Efeitos visuais transitórios enviados aos clientes (animações). */
export type Fx =
  | { type: 'explosao'; x: number; y: number; radius: number }
  | { type: 'destruicao'; x: number; y: number }
  | { type: 'superficie'; x: number; y: number; radius: number; surface: SurfaceType | null }
  | { type: 'dano'; tokenId: string; amount: number; damageType: DamageType }
  | { type: 'cura'; tokenId: string; amount: number }
  | { type: 'errou'; tokenId: string }
  | { type: 'dado'; total: number; formula: string; visibility: Visibility }
  | { type: 'movimento'; tokenId: string; path: { x: number; y: number }[] };

export type Role = 'MASTER' | 'PLAYER';

export interface Actor {
  userId: string;
  username: string;
  role: Role;
}
