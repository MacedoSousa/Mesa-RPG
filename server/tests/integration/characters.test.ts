import request from 'supertest';
import { app, auth, closeAll, createCharacter, registerUser, resetData, setupDatabase, validCharacter } from '../helpers';

beforeAll(setupDatabase);
beforeEach(resetData);
afterAll(closeAll);

describe('Criação de personagem (API)', () => {
  it('cria a ficha com atributos derivados calculados no servidor', async () => {
    const u = await registerUser('percy');
    const c = await createCharacter(u);
    expect(c).toMatchObject({ raceLabel: 'Semideus', divinityLabel: 'Poseidon', classLabel: 'Guerreiro', affinity: 10 });
    const stats = c.stats as { armorClass: number; maxHp: number; abilities: Record<string, number> };
    expect(stats.armorClass).toBe(18);
    expect(stats.abilities.constituicao).toBe(15);
    expect(c.hp).toBe(stats.maxHp);
  });

  it('recusa point-buy acima de 27 pontos', async () => {
    const u = await registerUser('percy');
    const res = await request(app).post('/api/characters').set(auth(u)).send({
      ...validCharacter, baseAbilities: { forca: 15, destreza: 15, constituicao: 15, inteligencia: 15, sabedoria: 8, carisma: 8 },
    }).expect(422);
    expect(res.body.details.errors.join()).toMatch(/limite é 27/);
  });

  it('recusa Mago equipado com Montante e armadura pesada (restrição por classe)', async () => {
    const u = await registerUser('percy');
    const res = await request(app).post('/api/characters').set(auth(u)).send({
      ...validCharacter, classKey: 'mago', skills: ['arcanismo', 'historia'],
      equipment: { mainHand: 'montante', armor: 'cota_de_malha' },
    }).expect(422);
    const reasons = res.body.details.violations.map((v: { reason: string }) => v.reason);
    expect(reasons).toEqual(expect.arrayContaining(['Mago não tem proficiência com Montante (arma marcial)', 'Mago não tem proficiência em armadura pesada']));
  });

  it('inventário marca itens bloqueados e o endpoint de equipar valida as regras de mãos', async () => {
    const u = await registerUser('percy');
    const c = await createCharacter(u);
    const inv = c.inventory as { itemKey: string; allowed: boolean }[];
    expect(inv.every((i) => i.allowed)).toBe(true);

    const blocked = await request(app).post(`/api/characters/${c.id}/equip`).set(auth(u)).send({ slot: 'mainHand', itemKey: 'montante' }).expect(422);
    expect(blocked.body.details.violations[0].reason).toMatch(/duas mãos/);

    await request(app).post(`/api/characters/${c.id}/equip`).set(auth(u)).send({ slot: 'shield', itemKey: null }).expect(200);
    const ok = await request(app).post(`/api/characters/${c.id}/equip`).set(auth(u)).send({ slot: 'mainHand', itemKey: 'montante' }).expect(200);
    expect(ok.body.character.equipment.mainHand).toBe('montante');
    expect(ok.body.character.stats.armorClass).toBe(16);

    await request(app).post(`/api/characters/${c.id}/equip`).set(auth(u)).send({ slot: 'mainHand', itemKey: 'arco_de_apolo' }).expect(422);
  });

  it('Caçador(a) de Ártemis só pode ter Ártemis como patrona', async () => {
    const u = await registerUser('percy');
    const res = await request(app).post('/api/characters').set(auth(u)).send({ ...validCharacter, race: 'cacador_artemis', divinity: 'ares' }).expect(422);
    expect(res.body.details.errors.join()).toMatch(/Ártemis/);
  });

  it('atualiza apenas nome e ficha narrativa', async () => {
    const u = await registerUser('percy');
    const c = await createCharacter(u);
    const res = await request(app).patch(`/api/characters/${c.id}`).set(auth(u)).send({ name: 'Kai', sheet: { notes: 'Deve 3 dracmas a Hermes' } }).expect(200);
    expect(res.body.character.name).toBe('Kai');
    expect(res.body.character.sheet.notes).toMatch(/Hermes/);
  });

  it('expõe o catálogo de regras publicamente', async () => {
    const res = await request(app).get('/api/rules').expect(200);
    expect(Object.keys(res.body.races)).toEqual(expect.arrayContaining(['semideus', 'cacador_artemis', 'satiro', 'ninfa']));
    expect(res.body.maps.map((m: { key: string }) => m.key)).toEqual(['acampamento', 'submundo', 'olimpo', 'rio_hudson']);
  });
});

describe('Armas e armaduras com rank', () => {
  it('guarda item com rank no inventário, compara e respeita o nível exigido', async () => {
    const { CharacterService } = await import('../../src/services/characterService');
    const u = await registerUser('percy');
    const c = await createCharacter(u);
    await CharacterService.grantReward(c.id, { xp: 0, dracmas: 0, items: [{ itemKey: 'espada_longa+1~de_fogo', quantity: 1 }, { itemKey: 'espada_longa+3', quantity: 1 }] });
    const { body } = await request(app).get(`/api/characters/${c.id}`).set(auth(u)).expect(200);
    const fire = body.character.inventory.find((i: { itemKey: string }) => i.itemKey === 'espada_longa+1~de_fogo');
    expect(fire.item).toMatchObject({ name: 'Espada Longa de Fogo +1', rank: 1 });
    expect(fire.allowed).toBe(true);
    const epic = body.character.inventory.find((i: { itemKey: string }) => i.itemKey === 'espada_longa+3');
    expect(epic.allowed).toBe(false);
    expect(epic.reasons.join()).toMatch(/nível 5/);
    await request(app).post(`/api/characters/${c.id}/equip`).set(auth(u)).send({ slot: 'mainHand', itemKey: 'espada_longa+3' }).expect(422);
    const ok = await request(app).post(`/api/characters/${c.id}/equip`).set(auth(u)).send({ slot: 'mainHand', itemKey: 'espada_longa+1~de_fogo' }).expect(200);
    expect(ok.body.character.equipment.mainHand).toBe('espada_longa+1~de_fogo');
  });
});
