import {
  CharacterBuild, CharacterCreationInput, ITEMS, abilityModifier, canUseItem, deriveStats, inventoryStatus,
  proficiencyBonus, validateCharacterCreation, validateEquipment, validatePointBuy,
} from '../src';
import { fighterBuild } from './helpers';

const validInput: CharacterCreationInput = {
  name: 'Kai',
  race: 'semideus',
  divinity: 'poseidon',
  classKey: 'guerreiro',
  baseAbilities: { forca: 15, destreza: 14, constituicao: 13, inteligencia: 12, sabedoria: 10, carisma: 8 },
  skills: ['atletismo', 'percepcao'],
  equipment: { mainHand: 'espada_bronze_celestial', armor: 'cota_de_malha', shield: 'escudo_bronze' },
  inventory: [
    { itemKey: 'espada_bronze_celestial', quantity: 1 },
    { itemKey: 'cota_de_malha', quantity: 1 },
    { itemKey: 'escudo_bronze', quantity: 1 },
    { itemKey: 'pocao_cura', quantity: 2 },
  ],
};

describe('Atributos e point-buy', () => {
  it('modificador e bônus de proficiência seguem o SRD', () => {
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(15)).toBe(2);
    expect(abilityModifier(20)).toBe(5);
    expect(proficiencyBonus(1)).toBe(2);
    expect(proficiencyBonus(5)).toBe(3);
    expect(proficiencyBonus(17)).toBe(6);
  });

  it('aceita exatamente 27 pontos e rejeita excesso', () => {
    expect(validatePointBuy(validInput.baseAbilities)).toMatchObject({ ok: true, spent: 27, remaining: 0 });
    const over = validatePointBuy({ forca: 15, destreza: 15, constituicao: 15, inteligencia: 10, sabedoria: 10, carisma: 10 });
    expect(over.ok).toBe(false);
    expect(over.errors.join()).toMatch(/limite é 27/);
  });

  it('rejeita valores fora de 8–15 antes dos bônus', () => {
    const r = validatePointBuy({ forca: 16, destreza: 8, constituicao: 8, inteligencia: 8, sabedoria: 8, carisma: 7 });
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(2);
  });
});

describe('Atributos derivados', () => {
  it('aplica bônus de raça e do pai olímpico', () => {
    const s = deriveStats(fighterBuild);
    // semideus +1 CON +1 CAR; Poseidon favorece CON +1
    expect(s.abilities.constituicao).toBe(15);
    expect(s.abilities.carisma).toBe(9);
    // Guerreiro d10 + CON(+2) + Sangue Divino (+1) + Poseidon (+1)
    expect(s.maxHp).toBe(10 + 2 + 2);
    // Cota de malha 16 + escudo 2
    expect(s.armorClass).toBe(18);
    expect(s.resistances).toContain('frio');
    expect(s.speedSquares).toBe(6);
  });
});

describe('Restrição de armas e armaduras por classe', () => {
  const mage: CharacterBuild = { ...fighterBuild, classKey: 'mago', skills: ['arcanismo', 'historia'], equipment: {} };

  it('Mago não usa Montante nem armadura de placas', () => {
    const montante = canUseItem(mage, ITEMS.montante);
    expect(montante.allowed).toBe(false);
    expect(montante.reasons[0]).toMatch(/Mago não tem proficiência/);
    const placas = canUseItem(mage, ITEMS.armadura_placas);
    expect(placas.allowed).toBe(false);
    expect(placas.reasons.join()).toMatch(/armadura pesada/);
  });

  it('Druida recusa armadura de metal mesmo sendo armadura média', () => {
    const druid: CharacterBuild = { ...fighterBuild, classKey: 'druida', equipment: {} };
    expect(canUseItem(druid, ITEMS.gibao_de_peles).allowed).toBe(true);
    const escamas = canUseItem(druid, ITEMS.cota_de_escamas);
    expect(escamas.allowed).toBe(false);
    expect(escamas.reasons.join()).toMatch(/metal/);
  });

  it('armadura pesada exige Força mínima', () => {
    const weak: CharacterBuild = { ...fighterBuild, baseAbilities: { ...fighterBuild.baseAbilities, forca: 10 } };
    const r = canUseItem(weak, ITEMS.armadura_placas);
    expect(r.reasons).toContain('Requer Força 15');
  });

  it('Arco de Apolo exige divindade, Destreza 13 e afinidade 30', () => {
    const ranger: CharacterBuild = { ...fighterBuild, classKey: 'patrulheiro', divinity: 'apolo', affinity: 10 };
    const low = canUseItem(ranger, ITEMS.arco_de_apolo);
    expect(low.allowed).toBe(false);
    expect(low.reasons.join()).toMatch(/afinidade divina 30/);
    expect(canUseItem({ ...ranger, affinity: 30 }, ITEMS.arco_de_apolo).allowed).toBe(true);
    const sonOfAres = canUseItem({ ...ranger, divinity: 'ares', affinity: 90 }, ITEMS.arco_de_apolo);
    expect(sonOfAres.reasons.join()).toMatch(/Apolo ou Ártemis/);
  });

  it('Legado não pode consumir Ambrosia', () => {
    const legado: CharacterBuild = { ...fighterBuild, race: 'legado', divinity: 'atena' };
    expect(canUseItem(legado, ITEMS.ambrosia).allowed).toBe(false);
    expect(canUseItem(legado, ITEMS.pocao_cura).allowed).toBe(true);
  });

  it('proficiência racial libera arma fora da classe (Caçador(a) + arco longo como Mago)', () => {
    const hunterMage: CharacterBuild = { ...mage, race: 'cacador_artemis', divinity: 'artemis' };
    expect(canUseItem(hunterMage, ITEMS.arco_longo).allowed).toBe(true);
    expect(canUseItem(mage, ITEMS.arco_longo).allowed).toBe(false);
  });

  it('valida regras de mãos: duas mãos + escudo e mão secundária leve', () => {
    const v = validateEquipment({ ...fighterBuild, equipment: { mainHand: 'montante', shield: 'escudo_bronze' } });
    expect(v.map((x) => x.reason)).toContain('Não dá para usar escudo com arma de duas mãos');
    const v2 = validateEquipment({ ...fighterBuild, equipment: { mainHand: 'espada_curta', offHand: 'espada_longa' } });
    expect(v2.map((x) => x.reason)).toContain('A arma da mão secundária precisa ser leve');
  });

  it('inventoryStatus marca itens bloqueados para a UI', () => {
    const status = inventoryStatus(mage, ['adaga', 'montante']);
    expect(status[0].allowed).toBe(true);
    expect(status[1].allowed).toBe(false);
  });
});

describe('Criação de personagem (4 passos)', () => {
  it('aceita uma ficha válida', () => {
    const r = validateCharacterCreation(validInput);
    expect(r.errors).toEqual([]);
    expect(r.violations).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it('raça restringe o pai divino (Caçador(a) só com Ártemis)', () => {
    const r = validateCharacterCreation({ ...validInput, race: 'cacador_artemis', divinity: 'zeus' });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/só pode ter como patrono: Ártemis/);
  });

  it('exige a quantidade certa de perícias da classe', () => {
    const r = validateCharacterCreation({ ...validInput, skills: ['atletismo'] });
    expect(r.errors.join()).toMatch(/exatamente 2 perícias/);
  });

  it('item equipado precisa estar no inventário', () => {
    const r = validateCharacterCreation({ ...validInput, inventory: [] });
    expect(r.errors.join()).toMatch(/precisa estar no inventário/);
  });

  it('bloqueia equipamento proibido para a classe', () => {
    const r = validateCharacterCreation({
      ...validInput, classKey: 'mago', skills: ['arcanismo', 'historia'],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
  });
});
