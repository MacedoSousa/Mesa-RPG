import {
  AFFIXES, applyCommand, canUseItem, compareEquip, deriveStats, getItem, parseItemKey, rankedKey, rollGear, rollLoot, seededRng,
  tileAt, tokenFromCharacter, validateEquipment, type CharacterBuild,
} from '../src';
import { MASTER, PLAYER, baseState, fighterBuild, heroToken, monster, withTokens } from './helpers';

const plain: CharacterBuild = { ...fighterBuild, equipment: { mainHand: 'espada_longa', armor: 'cota_de_malha' } };

describe('Ranks de armas e armaduras', () => {
  it('lê e monta chaves com rank e encantamento', () => {
    expect(parseItemKey('espada_longa+2~de_fogo')).toEqual({ base: 'espada_longa', rank: 2, affix: 'de_fogo' });
    expect(parseItemKey('espada_longa')).toEqual({ base: 'espada_longa', rank: 0, affix: null });
    expect(rankedKey('couro', 1, 'contra_fogo')).toBe('couro+1~contra_fogo');
    expect(rankedKey('couro')).toBe('couro');
  });

  it('arma +2 soma acerto e dano; encantamento de fogo soma 1d4', () => {
    const w = getItem('espada_longa+2~de_fogo');
    expect(w).toMatchObject({ kind: 'arma', rank: 2, baseKey: 'espada_longa', name: 'Espada Longa de Fogo +2', attackBonus: 2, extraDamage: '1d4', minLevel: 3 });
    const base = tokenFromCharacter({ id: 'a', userId: 'u', name: 'A', build: plain, hp: 99, stamina: 9, inventory: [] }, 0, 0);
    const lvl3 = { ...plain, level: 3, equipment: { ...plain.equipment, mainHand: 'espada_longa+2~de_fogo' } };
    const up = tokenFromCharacter({ id: 'b', userId: 'u', name: 'B', build: lvl3, hp: 99, stamina: 9, inventory: [] }, 0, 0);
    expect(up.attacks[0].toHit).toBe(base.attacks[0].toHit + 2); // +2 do rank (proficiência segue +2 até o nível 4)
    expect(up.attacks[0].damage).toMatch(/\+1d4$/);
  });

  it('armadura com rank aumenta a CA e encantamentos dão resistência ou atributo', () => {
    const a = deriveStats(plain);
    const b = deriveStats({ ...plain, equipment: { ...plain.equipment, armor: 'cota_de_malha+1~contra_fogo' } });
    expect(b.armorClass).toBe(a.armorClass + 1);
    expect(b.resistances).toContain('fogo');
    const c = deriveStats({ ...plain, equipment: { ...plain.equipment, armor: 'cota_de_malha~do_vigor' } });
    expect(c.abilities.constituicao).toBe(a.abilities.constituicao + 1);
    expect(c.maxHp).toBeGreaterThanOrEqual(a.maxHp);
  });

  it('encantamento com preço: Fortaleza dá +2 CA mas tira deslocamento', () => {
    const a = deriveStats(plain);
    const b = deriveStats({ ...plain, equipment: { ...plain.equipment, armor: 'cota_de_malha~da_fortaleza' } });
    expect(b.armorClass).toBe(a.armorClass + 2);
    expect(b.speed).toBe(a.speed - 1.5);
  });

  it('rank alto exige nível; encantamento de arma não vai em armadura', () => {
    expect(canUseItem(plain, getItem('espada_longa+3')!).reasons).toContain('Requer nível 5 (rank Épico)');
    expect(validateEquipment({ ...plain, equipment: { mainHand: 'espada_longa+3' } })[0].reason).toMatch(/nível 5/);
    expect(canUseItem({ ...plain, level: 5 }, getItem('espada_longa+3')!).allowed).toBe(true);
    expect(getItem('couro~de_fogo')).toBeUndefined();
    expect(getItem('pocao_cura+2')).toBeUndefined();
    expect(getItem('espada_longa+9')).toBeUndefined();
  });

  it('proficiência racial vale para a versão com rank (arco da caçadora)', () => {
    const huntress: CharacterBuild = { ...plain, race: 'cacador_artemis', divinity: 'artemis', classKey: 'mago', equipment: {} };
    expect(canUseItem(huntress, getItem('arco_curto')!).allowed).toBe(true);
    expect(canUseItem(huntress, getItem('arco_curto+1')!).allowed).toBe(true);
  });

  it('compara com o equipado: setas de melhora e piora', () => {
    const up = compareEquip(plain, 'espada_longa+1');
    expect(up.allowed).toBe(true);
    expect(up.deltas.find((d) => d.label === 'Acerto')).toMatchObject({ delta: 2 });
    expect(up.score).toBeGreaterThan(0);
    const worse = compareEquip(plain, 'adaga');
    expect(worse.score).toBeLessThan(0);
    const fort = compareEquip(plain, 'cota_de_malha~da_fortaleza');
    expect(fort.deltas.map((d) => d.label)).toEqual(expect.arrayContaining(['CA', 'Deslocamento']));
  });

  it('baús sorteiam armas/armaduras com rank', () => {
    const rng = seededRng(3);
    const keys = Array.from({ length: 30 }, () => rollGear('raro', rng));
    for (const k of keys) {
      const item = getItem(k)!;
      expect(item).toBeDefined();
      expect(item.rank).toBeGreaterThanOrEqual(2);
      if (item.affix) expect(AFFIXES[item.affix]).toBeDefined();
    }
    const raro = rollLoot('raro', seededRng(5));
    expect(raro.loot.some((l) => getItem(l.itemKey)!.rank! >= 2)).toBe(true);
  });

  it('monstro forte derrotado deixa espólio que o herói recolhe', () => {
    let s = withTokens(baseState(), heroToken('c1', PLAYER.userId, 4, 5), monster('quimera', 5, 5, 'm1'));
    s = applyCommand(s, MASTER, { type: 'token.damage', tokenIds: ['m1'], amount: 999, damageType: 'cortante', heal: false, half: false }, seededRng(1)).state;
    const bag = tileAt(s.map, 5, 5)!.o!;
    expect(bag.type).toBe('espolio');
    expect(bag.loot!.length).toBeGreaterThan(0);
    const { state, ctx } = applyCommand(s, PLAYER, { type: 'object.open', tokenId: 'tok_c1', x: 5, y: 5 });
    expect(tileAt(state.map, 5, 5)!.o).toBeUndefined();
    expect(ctx.sideEffects).toContainEqual(expect.objectContaining({ type: 'reward', characterId: 'c1' }));
  });

  it('Mestre pode desligar o espólio dos monstros', () => {
    let s = withTokens(baseState(), heroToken('c1', PLAYER.userId, 4, 5), monster('quimera', 5, 5, 'm1'));
    s = applyCommand(s, MASTER, { type: 'table.options', monsterLoot: false }).state;
    s = applyCommand(s, MASTER, { type: 'token.damage', tokenIds: ['m1'], amount: 999, damageType: 'cortante', heal: false, half: false }, seededRng(1)).state;
    expect(tileAt(s.map, 5, 5)!.o).toBeUndefined();
  });
});
