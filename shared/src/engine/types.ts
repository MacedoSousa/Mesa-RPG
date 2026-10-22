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

export type ObjectType = 'barril_explosivo' | 'barril_agua' | 'barril_oleo' | 'caixote' | 'estatua' | 'braseiro' | 'bau' | 'bau_aberto' | 'espolio';

export interface Surface {
  type: SurfaceType;
  rounds: number;
}

export interface LootEntry {
  itemKey: string;
  quantity: number;
}

export interface MapObject {
  type: ObjectType;
  hp: number;
  /** Baús: conteúdo (nunca enviado aos jogadores). */
  loot?: LootEntry[];
  dracmas?: number;
  /** Baú trancado: CD do teste para abrir (Prestidigitação/DES ou Atletismo/FOR). */
  lockDc?: number;
  /** Projeção para jogadores: só sabem SE está trancado. */
  locked?: boolean;
  /** Escondido pelo Mestre: jogadores não veem e não abrem até ser revelado. */
  hidden?: boolean;
}

export interface Tile {
  t: TerrainType;
  /** PV restante do terreno destrutível (ausente = intacto/indestrutível). */
  hp?: number;
  s?: Surface | null;
  o?: MapObject | null;
}

/** Ambiente visual: muda luz, cores e efeitos (não afeta regras). */
export type MapMood = 'dia' | 'noite' | 'caverna' | 'submundo' | 'olimpo';

export interface MapState {
  id: string | null;
  name: string;
  preset?: string | null;
  width: number;
  height: number;
  tiles: Tile[];
  mood?: MapMood;
  /** Mapas gerados: tipo e semente (reproduzíveis). */
  seed?: string;
  kind?: string;
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
  /** Arte do token: "classe:<classe>" para heróis, "monstro:<chave>" para monstros. */
  portrait?: string;
  /** Emblema pequeno (símbolo do pai olímpico). */
  emblem?: string;
  /** Perícias e testes de resistência com proficiência (testes pedidos pelo Mestre). */
  skills?: string[];
  saves?: string[];
  level?: number;
  /** Salvaguardas contra a morte (heróis com 0 PV). */
  deathSaves?: { successes: number; failures: number; stable: boolean };
  /** Retrato gerado (PortraitSpec serializada) para desenhar o rosto do herói. */
  face?: unknown;
  /** Dados para montar o boneco 3D do herói no mapa (classe, raça, deus e equipamento). */
  look3d?: { classKey: string; race: string; divinity: string; equipment: Partial<Record<'mainHand' | 'offHand' | 'armor' | 'shield', string | null>>; inventory?: string[] };
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
  /** Recompensa automática para todos os heróis ao concluir. */
  rewardXp?: number;
  rewardDracmas?: number;
  rewardItems?: LootEntry[];
  onExpire: QuestExpireTrigger | null;
  createdAt: number;
  /** Quest obrigatória da história (as outras são opcionais). */
  required?: boolean;
  /** Cena pronta que criou a quest (o rastreador mostra só as da cena atual). */
  sceneKey?: string;
}

export type CheckKind = 'pericia' | 'atributo' | 'resistencia';

/** Teste pedido pelo Mestre a um jogador: ele rola pelo app e o resultado vale. */
export interface PendingCheck {
  id: string;
  userId: string;
  tokenId: string;
  kind: CheckKind;
  key: string;
  dc: number;
  /** Jogador não vê a CD (vê só sucesso/falha). */
  secretDc: boolean;
  label: string | null;
  status: 'pendente' | 'sucesso' | 'falha';
  total?: number;
  natural?: number | null;
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
  /** Testes pedidos pelo Mestre (pendentes e resultados recentes). */
  checks?: PendingCheck[];
  /** Opções da mesa definidas pelo Mestre. */
  options?: { monsterLoot?: boolean };
  /** Cena pronta carregada pelo Mestre (chave em SCENES). */
  sceneKey?: string | null;
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
  | { type: 'ataque'; tokenId: string; targetId: string }
  | { type: 'dado'; total: number; formula: string; visibility: Visibility }
  | { type: 'movimento'; tokenId: string; path: { x: number; y: number }[] }
  | { type: 'narracao'; title?: string; text: string }
  | { type: 'banner'; text: string; sub?: string; kind: 'capitulo' | 'turno' | 'nivel' | 'vitoria' }
  | { type: 'revelar'; x: number; y: number }
  | { type: 'bau'; x: number; y: number }
  | { type: 'poder'; tokenId: string; divinity?: string; x?: number; y?: number; radius?: number };

export type Role = 'MASTER' | 'PLAYER';

export interface Actor {
  userId: string;
  username: string;
  role: Role;
}
