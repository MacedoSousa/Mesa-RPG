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

const paintSchema = z.object({
  image: z.string().min(30).max(4_000_000),
  signature: z.string().min(1).max(40),
  tilesW: z.number().int().min(4).max(200),
  tilesH: z.number().int().min(4).max(200),
  kind: z.string().max(30).optional(),
  mood: z.string().max(30).optional(),
  style: z.string().max(30).optional(),
  denoise: z.number().min(0.2).max(0.8).optional(),
  checkpoint: z.string().max(200).optional(),
  quality: z.enum(['rapida', 'boa', 'caprichada']).optional(),
  prompt: z.string().max(1500).optional(),
});

export const ArtController = {
  mapArt(req: Request, res: Response) {
    res.json({ map: artService.mapArt(String(req.params.campaignId)) });
  },
  paintMap(req: Request, res: Response) {
    const job = artService.paintMap(String(req.params.campaignId), paintSchema.parse(req.body ?? {}));
    res.status(202).json({ job });
  },
  removeMapArt(req: Request, res: Response) {
    artService.removeMapArt(String(req.params.campaignId));
    res.status(204).end();
  },
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
