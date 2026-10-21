import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  CLASSES, CONDITIONS, DIVINITIES, GUIDE, ITEMS, MONSTERS, PRESET_MAPS, RACES, SKILLS, ABILITY_LABELS,
  POINT_BUY_BUDGET, POINT_BUY_COST, STANDARD_ARRAY, buildPresetMap, characterCreationSchema, validateCharacterCreation,
  OBJECTS, SURFACES, TERRAIN,
} from '@mesa/shared';
import { CharacterService } from '../services/characterService';

const idParam = z.object({ id: z.string().uuid('ID inválido') });

export const CharacterController = {
  async list(req: Request, res: Response) {
    res.json({ characters: await CharacterService.list(req.actor!.userId, req.query.includeDeleted === 'true') });
  },
  async get(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    res.json({ character: await CharacterService.get(req.actor!.userId, id) });
  },
  /** Pré-validação dos 4 passos sem salvar (a UI usa para mostrar erros e stats ao vivo). */
  async preview(req: Request, res: Response) {
    const input = characterCreationSchema.parse(req.body);
    res.json(validateCharacterCreation(input));
  },
  async create(req: Request, res: Response) {
    res.status(201).json({ character: await CharacterService.create(req.actor!.userId, req.body) });
  },
  async update(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    res.json({ character: await CharacterService.update(req.actor!.userId, id, req.body) });
  },
  async equip(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    res.json({ character: await CharacterService.equip(req.actor!.userId, id, req.body) });
  },
  async remove(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    await CharacterService.softDelete(req.actor!.userId, id);
    res.status(204).send();
  },
  async restore(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    res.json({ character: await CharacterService.restore(req.actor!.userId, id) });
  },
};

/** Catálogo público de regras e conteúdo (criação de ficha, guia, editor de mapas). */
export const RulesController = {
  catalog(_req: Request, res: Response) {
    res.json({
      abilities: ABILITY_LABELS,
      pointBuy: { budget: POINT_BUY_BUDGET, cost: POINT_BUY_COST, standardArray: STANDARD_ARRAY },
      skills: SKILLS,
      races: RACES,
      divinities: DIVINITIES,
      classes: CLASSES,
      items: ITEMS,
      monsters: MONSTERS,
      conditions: CONDITIONS,
      terrain: TERRAIN,
      surfaces: SURFACES,
      objects: OBJECTS,
      maps: PRESET_MAPS.map((p) => ({ key: p.key, name: p.name, description: p.description })),
      guide: GUIDE,
    });
  },
  presetMap(req: Request, res: Response) {
    res.json({ map: buildPresetMap(String(req.params.key)) });
  },
};
