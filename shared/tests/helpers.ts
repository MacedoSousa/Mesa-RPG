import {
  Actor, CharacterBuild, TableState, Token, createBlankMap, createMonsterToken, createTableState, tokenFromCharacter,
} from '../src';

export const MASTER: Actor = { userId: 'u_master', username: 'Quíron', role: 'MASTER' };
export const PLAYER: Actor = { userId: 'u_p1', username: 'percy', role: 'PLAYER' };
export const PLAYER2: Actor = { userId: 'u_p2', username: 'annabeth', role: 'PLAYER' };

export const fighterBuild: CharacterBuild = {
  race: 'semideus',
  divinity: 'poseidon',
  classKey: 'guerreiro',
  level: 1,
  affinity: 10,
  baseAbilities: { forca: 15, destreza: 14, constituicao: 13, inteligencia: 12, sabedoria: 10, carisma: 8 },
  skills: ['atletismo', 'percepcao'],
  equipment: { mainHand: 'espada_bronze_celestial', armor: 'cota_de_malha', shield: 'escudo_bronze' },
};

export function heroToken(id = 'c1', owner = PLAYER.userId, x = 1, y = 1, build: CharacterBuild = fighterBuild): Token {
  return tokenFromCharacter(
    { id, userId: owner, name: `Herói ${id}`, build, hp: 999, stamina: 999, inventory: [{ itemKey: 'pocao_cura', quantity: 2 }] },
    x, y,
  );
}

export function baseState(width = 10, height = 10): TableState {
  const state = createTableState('camp1', 'Mesa de Teste', createBlankMap(width, height, 'terra'), 0);
  state.players[PLAYER.userId] = { userId: PLAYER.userId, username: PLAYER.username, characterId: 'c1', paused: false, connected: true };
  state.players[PLAYER2.userId] = { userId: PLAYER2.userId, username: PLAYER2.username, characterId: 'c2', paused: false, connected: true };
  return state;
}

export function withTokens(state: TableState, ...tokens: Token[]): TableState {
  state.tokens.push(...tokens);
  return state;
}

export function monster(key: string, x: number, y: number, id = `m_${key}_${x}_${y}`, hidden = false): Token {
  return createMonsterToken(key, x, y, id, { hidden });
}
