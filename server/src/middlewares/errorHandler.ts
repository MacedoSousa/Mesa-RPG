import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { EquipmentRestrictionError } from '../models/Character';
import { HttpError } from '../utils/HttpError';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

// Express identifica o handler de erro pela assinatura de 4 argumentos
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof EquipmentRestrictionError) {
    return res.status(422).json({ error: err.message, details: err.violations });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  // Violação de unique do PostgreSQL
  if (typeof err === 'object' && err && 'code' in err && (err as { code: string }).code === '23505') {
    return res.status(409).json({ error: 'Registro duplicado' });
  }

  console.error('❌ Erro não tratado:', err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}
