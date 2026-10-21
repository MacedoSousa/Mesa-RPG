import { ITEMS } from '@mesa/shared';
import { Item } from '../models';

/** Semeia (ou atualiza) o catálogo base de itens. Idempotente. */
export async function seedItems(): Promise<number> {
  let count = 0;
  for (const def of Object.values(ITEMS)) {
    const existing = await Item.findOne({ where: { key: def.key, campaignId: null } });
    if (existing) {
      await existing.update({ kind: def.kind, name: def.name, definition: def });
    } else {
      await Item.create({ key: def.key, campaignId: null, kind: def.kind, name: def.name, definition: def, isCustom: false });
    }
    count++;
  }
  return count;
}
