import { Request, Response } from 'express';
import { z } from 'zod';
import {
  CharacterModel,
  CharacterRow,
  createCharacterSchema,
  updateCharacterSchema,
} from '../models/Character';
import { ARMORS, CLASSES, GODLY_PARENTS, RACES, WEAPONS, affinityTier, attributeModifier, proficiencyBonus } from '../models/gameData';
import { canUseArmor, canUseWeapon } from '../models/equipmentRules';
import { HttpError } from '../utils/HttpError';
import { broadcastCharacterUpdate } from '../sockets';

const idParam = z.object({ id: z.string().uuid('ID inválido') });

/** Formata a ficha para o cliente, com valores derivados. */
export function serializeCharacter(c: CharacterRow) {
  const attributes = {
    forca: c.forca,
    destreza: c.destreza,
    constituicao: c.constituicao,
    inteligencia: c.inteligencia,
    sabedoria: c.sabedoria,
    carisma: c.carisma,
  };
  const modifiers = Object.fromEntries(
    Object.entries(attributes).map(([k, v]) => [k, attributeModifier(v)]),
  );

  return {
    id: c.id,
    userId: c.user_id,
    name: c.name,
    race: c.race,
    raceLabel: RACES[c.race].label,
    class: c.class,
    classLabel: CLASSES[c.class].label,
    subclass: c.subclass,
    level: c.level,
    experience: c.experience,
    proficiencyBonus: proficiencyBonus(c.level),
    godlyParent: c.godly_parent,
    godlyParentLabel: GODLY_PARENTS[c.godly_parent].label,
    godlyAffinity: c.godly_affinity,
    godlyAffinityTier: affinityTier(c.godly_affinity),
    attributes,
    modifiers,
    hp: { max: c.max_hp, current: c.current_hp, temp: c.temp_hp },
    armorClass: c.armor_class,
    speed: RACES[c.race].speed,
    equipment: c.equipment,
    inventory: c.inventory,
    sheet: c.sheet,
    backstory: c.backstory,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    deletedAt: c.deleted_at,
  };
}

export const CharacterController = {
  async list(req: Request, res: Response) {
    const includeDeleted = req.query.includeDeleted === 'true';
    const characters = await CharacterModel.listByUser(req.auth!.sub, includeDeleted);
    res.json({ characters: characters.map(serializeCharacter) });
  },

  async get(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    const character = await CharacterModel.findById(id, req.auth!.sub);
    if (!character) throw new HttpError(404, 'Personagem não encontrado');
    res.json({ character: serializeCharacter(character) });
  },

  async create(req: Request, res: Response) {
    const input = createCharacterSchema.parse(req.body);
    const character = await CharacterModel.create(req.auth!.sub, input);
    res.status(201).json({ character: serializeCharacter(character) });
  },

  async update(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    const input = updateCharacterSchema.parse(req.body);
    const character = await CharacterModel.update(id, req.auth!.sub, input);
    if (!character) throw new HttpError(404, 'Personagem não encontrado');

    const payload = serializeCharacter(character);
    broadcastCharacterUpdate(payload);
    res.json({ character: payload });
  },

  async remove(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    const ok = await CharacterModel.softDelete(id, req.auth!.sub);
    if (!ok) throw new HttpError(404, 'Personagem não encontrado');
    res.status(204).send();
  },

  async restore(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    const character = await CharacterModel.restore(id, req.auth!.sub);
    if (!character) throw new HttpError(404, 'Personagem não encontrado na lixeira');
    res.json({ character: serializeCharacter(character) });
  },
};

/** Catálogo público de regras — útil para montar a tela de criação de ficha. */
export const RulesController = {
  catalog(_req: Request, res: Response) {
    const classes = Object.fromEntries(
      Object.entries(CLASSES).map(([key, cls]) => {
        const k = key as keyof typeof CLASSES;
        return [
          key,
          {
            ...cls,
            allowedWeapons: (Object.keys(WEAPONS) as (keyof typeof WEAPONS)[]).filter((w) => canUseWeapon(k, w)),
            allowedArmors: (Object.keys(ARMORS) as (keyof typeof ARMORS)[]).filter((a) => canUseArmor(k, a).ok),
          },
        ];
      }),
    );
    res.json({ races: RACES, classes, godlyParents: GODLY_PARENTS, weapons: WEAPONS, armors: ARMORS });
  },
};
