import type { Request, Response } from 'express';
import { z } from 'zod';
import { artService } from '../services/artService';

const generateSchema = z.object({
  prompt: z.string().max(1500).optional(),
  negative: z.string().max(800).optional(),
  seed: z.number().int().min(0).max(2 ** 32).optional(),
  checkpoint: z.string().max(200).optional(),
  steps: z.number().int().min(1).max(60).optional(),
  quality: z.enum(['rapida', 'boa', 'caprichada']).optional(),
  style: z.string().max(30).optional(),
  lora: z.string().max(200).nullable().optional(),
});

export const ArtController = {
  list(_req: Request, res: Response) {
    res.json({ monsters: artService.list() });
  },
  async status(_req: Request, res: Response) {
    res.json(await artService.status());
  },
  prompts(req: Request, res: Response) {
    res.json({ prompts: artService.prompts(String(req.query.style ?? 'epico')), styles: artService.styles() });
  },
  jobs(_req: Request, res: Response) {
    res.json({ jobs: artService.jobs() });
  },
  generate(req: Request, res: Response) {
    const job = artService.generate(String(req.params.key), generateSchema.parse(req.body ?? {}));
    res.status(202).json({ job });
  },
  upload(req: Request, res: Response) {
    const url = artService.upload(String(req.params.key), String(req.body?.image ?? ''));
    res.json({ url });
  },
  remove(req: Request, res: Response) {
    artService.remove(String(req.params.key));
    res.status(204).end();
  },
};
