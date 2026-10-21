import { z } from 'zod';
import { DAMAGE_TYPES, ITEMS, ItemDef } from '@mesa/shared';
import { Item } from '../models';
import { HttpError } from '../utils/HttpError';

/** Itens personalizados que o Mestre cria para a campanha (armas e consumíveis simples). */
export const customItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('arma'),
    key: z.string().regex(/^[a-z0-9_]{3,40}$/),
    name: z.string().min(2).max(80),
    description: z.string().max(500).default(''),
    category: z.enum(['simples', 'marcial']),
    damage: z.string().regex(/^\d{1,2}d\d{1,3}([+-]\d{1,2})?$/),
    damageType: z.enum(DAMAGE_TYPES),
    properties: z.array(z.enum(['acuidade', 'leve', 'pesada', 'duas_maos', 'versatil', 'arremesso', 'distancia', 'alcance', 'municao'])).default([]),
    range: z.number().int().min(1).max(60).default(1),
    requirements: z.object({
      minAbilities: z.record(z.number().int().min(1).max(30)).optional(),
      divinities: z.array(z.string()).optional(),
      minAffinity: z.number().int().min(0).max(100).optional(),
      races: z.array(z.string()).optional(),
    }).optional(),
  }),
  z.object({
    kind: z.literal('consumivel'),
    key: z.string().regex(/^[a-z0-9_]{3,40}$/),
    name: z.string().min(2).max(80),
    description: z.string().max(500).default(''),
    effect: z.object({ heal: z.string().max(20).optional(), stamina: z.string().max(20).optional() }),
  }),
]);

export const ItemService = {
  /** Mapa de itens personalizados da campanha, no formato usado pelo motor de regras. */
  async customItems(campaignId: string | null | undefined): Promise<Record<string, ItemDef>> {
    if (!campaignId) return {};
    const rows = await Item.findAll({ where: { campaignId } });
    return Object.fromEntries(rows.map((r) => [r.key, r.definition]));
  },

  async list(campaignId?: string | null) {
    const base = await Item.findAll({ where: { campaignId: null }, order: [['kind', 'ASC'], ['name', 'ASC']] });
    const custom = campaignId ? await Item.findAll({ where: { campaignId } }) : [];
    const defs = [...base, ...custom].map((r) => ({ ...r.definition, isCustom: r.isCustom, id: r.id }));
    // Banco vazio (seed não rodado): devolve o catálogo embutido
    return defs.length ? defs : Object.values(ITEMS);
  },

  async createCustom(campaignId: string, input: unknown) {
    const data = customItemSchema.parse(input);
    if (ITEMS[data.key]) throw new HttpError(409, 'Essa chave já existe no catálogo base');
    const exists = await Item.findOne({ where: { campaignId, key: data.key } });
    if (exists) throw new HttpError(409, 'Já existe um item com essa chave na campanha');
    const def = (data.kind === 'arma'
      ? { ...data, material: 'comum', weight: 1, value: 10 }
      : { ...data, weight: 0.5, value: 10 }) as ItemDef;
    return Item.create({ key: data.key, campaignId, kind: data.kind, name: data.name, definition: def, isCustom: true });
  },

  async softDelete(campaignId: string, itemId: string) {
    const item = await Item.findOne({ where: { id: itemId, campaignId } });
    if (!item) throw new HttpError(404, 'Item não encontrado');
    await item.destroy();
  },
};
