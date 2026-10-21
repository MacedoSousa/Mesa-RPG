import { z } from 'zod';
import { CONDITION_KEYS } from '../content/conditions';
import { DAMAGE_TYPES } from '../content/items';
import type { Role } from './types';

const id = z.string().min(1).max(100);
const coord = z.number().int().min(0).max(127);
const terrain = z.enum([
  'grama', 'terra', 'pedra', 'areia', 'marmore', 'nuvem', 'madeira', 'agua_rasa', 'agua_profunda', 'lava', 'abismo', 'estige',
  'parede', 'coluna', 'arvore', 'toco', 'escombros', 'ponte', 'portao', 'elevado',
]);
const surface = z.enum(['fogo', 'agua', 'agua_eletrificada', 'gelo', 'oleo', 'veneno', 'vapor']);
const object = z.enum(['barril_explosivo', 'barril_agua', 'barril_oleo', 'caixote', 'estatua', 'braseiro', 'bau', 'bau_aberto', 'espolio']);
const loot = z.array(z.object({ itemKey: z.string().min(1).max(60), quantity: z.number().int().min(1).max(999) })).max(20);
const checkKind = z.enum(['pericia', 'atributo', 'resistencia']);
const damageType = z.enum(DAMAGE_TYPES);
const element = z.enum(['fogo', 'agua', 'raio', 'gelo', 'veneno', 'oleo']);

export const tileSchema = z.object({
  t: terrain,
  hp: z.number().int().optional(),
  s: z.object({ type: surface, rounds: z.number().int().min(0).max(99) }).nullable().optional(),
  o: z.object({ type: object, hp: z.number().int(), loot: loot.optional(), dracmas: z.number().int().min(0).optional(), lockDc: z.number().int().optional() }).nullable().optional(),
});

export const mapSchema = z
  .object({
    id: z.string().nullable(),
    name: z.string().min(1).max(80),
    preset: z.string().nullable().optional(),
    width: z.number().int().min(4).max(64),
    height: z.number().int().min(4).max(64),
    tiles: z.array(tileSchema),
    mood: z.enum(['dia', 'noite', 'caverna', 'submundo', 'olimpo']).optional(),
    seed: z.string().max(40).optional(),
    kind: z.string().max(30).optional(),
  })
  .refine((m) => m.tiles.length === m.width * m.height, { message: 'Quantidade de tiles não confere com largura x altura' });

export const commandSchema = z.discriminatedUnion('type', [
  // ── Jogador (sobre o próprio token) ou Mestre ──
  z.object({ type: z.literal('token.move'), tokenId: id, x: coord, y: coord }),
  z.object({ type: z.literal('combat.attack'), tokenId: id, targetId: id, attackIndex: z.number().int().min(0).max(9).default(0) }),
  z.object({ type: z.literal('combat.attackTile'), tokenId: id, x: coord, y: coord, attackIndex: z.number().int().min(0).max(9).default(0) }),
  z.object({ type: z.literal('combat.action'), tokenId: id, action: z.enum(['disparada', 'desengajar', 'esquivar']) }),
  z.object({ type: z.literal('combat.shove'), tokenId: id, targetId: id }),
  z.object({ type: z.literal('combat.power'), tokenId: id, x: coord, y: coord }),
  z.object({ type: z.literal('combat.endTurn'), tokenId: id }),
  z.object({ type: z.literal('item.use'), tokenId: id, itemKey: z.string().min(1).max(60), targetId: id.optional() }),
  z.object({ type: z.literal('object.open'), tokenId: id, x: coord, y: coord }),
  // ── Jogador rola o teste que o Mestre pediu ──
  z.object({ type: z.literal('check.roll'), checkId: id, advantage: z.enum(['normal', 'vantagem', 'desvantagem']).default('normal') }),
  // ── Qualquer participante ──
  z.object({
    type: z.literal('dice.roll'), formula: z.string().min(1).max(60), label: z.string().max(60).optional(),
    visibility: z.enum(['publico', 'privado', 'secreto']).default('publico'),
  }),
  z.object({ type: z.literal('chat.say'), text: z.string().trim().min(1).max(500) }),
  // ── Somente Mestre ──
  z.object({ type: z.literal('table.setPaused'), paused: z.boolean() }),
  z.object({ type: z.literal('table.options'), monsterLoot: z.boolean().optional() }),
  z.object({ type: z.literal('chapter.create'), title: z.string().trim().min(1).max(80), description: z.string().max(2000).default('') }),
  z.object({ type: z.literal('chapter.update'), id, title: z.string().trim().min(1).max(80).optional(), description: z.string().max(2000).optional(), status: z.enum(['pendente', 'ativo', 'concluido']).optional() }),
  z.object({ type: z.literal('chapter.delete'), id }),
  z.object({ type: z.literal('chapter.activate'), id }),
  z.object({ type: z.literal('monster.spawn'), monsterKey: z.string().min(1), x: coord, y: coord, hidden: z.boolean().default(false), name: z.string().max(40).optional(), rollHp: z.boolean().default(false) }),
  z.object({
    type: z.literal('token.update'), tokenId: id,
    patch: z.object({
      name: z.string().min(1).max(40).optional(),
      hp: z.number().int().min(0).max(9999).optional(),
      tempHp: z.number().int().min(0).max(999).optional(),
      stamina: z.number().int().min(0).max(999).optional(),
      ac: z.number().int().min(0).max(40).optional(),
      x: coord.optional(), y: coord.optional(),
      hidden: z.boolean().optional(),
      conditions: z.array(z.enum(CONDITION_KEYS as [string, ...string[]])).optional(),
    }),
  }),
  z.object({ type: z.literal('token.remove'), tokenId: id }),
  z.object({ type: z.literal('combat.start'), tokenIds: z.array(id).optional() }),
  z.object({ type: z.literal('combat.end') }),
  z.object({ type: z.literal('combat.next') }),
  z.object({ type: z.literal('map.set'), map: mapSchema }),
  z.object({
    type: z.literal('map.generate'),
    kind: z.enum(['floresta', 'caverna', 'submundo', 'templo', 'rio', 'praia', 'interior', 'estrada']),
    width: z.number().int().min(12).max(48).default(28), height: z.number().int().min(10).max(40).default(20),
    seed: z.string().trim().min(1).max(40).optional(),
  }),
  z.object({ type: z.literal('map.mood'), mood: z.enum(['dia', 'noite', 'caverna', 'submundo', 'olimpo']) }),
  z.object({
    type: z.literal('map.paint'),
    cells: z.array(z.object({ x: coord, y: coord, t: terrain.optional(), o: object.nullable().optional(), s: surface.nullable().optional() })).min(1).max(4096),
  }),
  z.object({ type: z.literal('map.element'), x: coord, y: coord, radius: z.number().int().min(0).max(5).default(0), element, damage: z.string().max(20).optional() }),
  z.object({ type: z.literal('map.damage'), x: coord, y: coord, amount: z.number().int().min(1).max(999), damageType: z.enum(DAMAGE_TYPES) }),
  z.object({
    type: z.literal('quest.create'), title: z.string().trim().min(1).max(80), description: z.string().max(2000).default(''),
    hidden: z.boolean().default(false), target: z.number().int().min(1).max(999).default(1), reward: z.string().max(200).default(''),
    rewardXp: z.number().int().min(0).max(100000).default(0), rewardDracmas: z.number().int().min(0).max(100000).default(0), rewardItems: loot.default([]),
    expiresInRounds: z.number().int().min(1).max(999).optional(), expiresInSeconds: z.number().int().min(10).max(86400).optional(),
    onExpire: z.object({
      message: z.string().max(300).optional(),
      spawn: z.object({ monsterKey: z.string(), x: coord, y: coord, hidden: z.boolean().optional() }).optional(),
    }).optional(),
  }),
  z.object({ type: z.literal('quest.update'), id, status: z.enum(['ativa', 'concluida', 'falhou', 'expirada']).optional(), hidden: z.boolean().optional(), title: z.string().max(80).optional(), description: z.string().max(2000).optional() }),
  z.object({ type: z.literal('quest.progress'), id, delta: z.number().int().min(-999).max(999) }),
  z.object({ type: z.literal('quest.delete'), id }),
  z.object({ type: z.literal('player.pause'), userId: id, paused: z.boolean() }),
  z.object({ type: z.literal('player.ban'), userId: id }),
  z.object({ type: z.literal('affinity.adjust'), tokenId: id, delta: z.number().int().min(-100).max(100) }),
  // ── Mestre: monstros agem, dano/cura direto, testes, recompensas, baús ──
  z.object({ type: z.literal('combat.auto'), tokenId: id }),
  z.object({
    type: z.literal('token.damage'), tokenIds: z.array(id).min(1).max(20),
    amount: z.number().int().min(0).max(9999).optional(), formula: z.string().max(40).optional(),
    damageType: damageType.default('concussao'), heal: z.boolean().default(false), half: z.boolean().default(false),
    source: z.string().max(60).optional(),
  }),
  z.object({
    type: z.literal('check.request'), userIds: z.union([z.literal('todos'), z.array(id).min(1)]),
    kind: checkKind, key: z.string().min(1).max(30), dc: z.number().int().min(1).max(40), secretDc: z.boolean().default(false),
    label: z.string().max(80).optional(),
  }),
  z.object({ type: z.literal('check.clear') }),
  z.object({ type: z.literal('party.rest'), kind: z.enum(['curto', 'longo']) }),
  z.object({
    type: z.literal('item.take'), tokenIds: z.union([z.literal('todos'), z.array(id).min(1)]),
    itemKey: z.string().min(1).max(60), quantity: z.number().int().min(1).max(100000), reason: z.string().max(80).default('Mestre'),
  }),
  z.object({
    type: z.literal('reward.grant'), tokenIds: z.union([z.literal('todos'), z.array(id).min(1)]),
    xp: z.number().int().min(0).max(100000).default(0), dracmas: z.number().int().min(0).max(100000).default(0),
    items: loot.default([]), reason: z.string().trim().min(1).max(80).default('Mestre'),
  }),
  z.object({
    type: z.literal('chest.place'), x: coord, y: coord, loot: loot.default([]), dracmas: z.number().int().min(0).max(100000).default(0),
    lockDc: z.number().int().min(5).max(30).nullable().optional(), tier: z.enum(['comum', 'incomum', 'raro']).optional(),
  }),
  z.object({
    type: z.literal('adventure.load'),
    chapters: z.array(z.object({ title: z.string().min(1).max(80), description: z.string().max(4000).default('') })).max(30),
    quests: z.array(z.object({
      title: z.string().min(1).max(80), description: z.string().max(2000).default(''), hidden: z.boolean().default(false),
      target: z.number().int().min(1).max(999).default(1), reward: z.string().max(200).default(''),
      rewardXp: z.number().int().min(0).max(100000).default(0), rewardDracmas: z.number().int().min(0).max(100000).default(0),
      rewardItems: loot.default([]),
    })).max(60),
    replace: z.boolean().default(false),
  }),
]);

export type Command = z.infer<typeof commandSchema>;
export type CommandType = Command['type'];

/** Comandos que agem sobre um token específico (exigem posse e turno). */
export const TOKEN_COMMANDS: CommandType[] = [
  'token.move', 'combat.attack', 'combat.attackTile', 'combat.action', 'combat.shove', 'combat.power', 'combat.endTurn', 'item.use', 'object.open',
];

export const PLAYER_COMMANDS: CommandType[] = [...TOKEN_COMMANDS, 'dice.roll', 'chat.say', 'check.roll'];

/** RBAC: o Mestre pode tudo; o Jogador apenas os comandos de jogador. */
export function canIssue(role: Role, type: CommandType): boolean {
  if (role === 'MASTER') return true;
  return PLAYER_COMMANDS.includes(type);
}
