import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { CommandError, SaveMigrationError } from '@mesa/shared';
import { UniqueConstraintError, ValidationError } from 'sequelize';
import { HttpError } from '../utils/HttpError';

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
  if (err instanceof CommandError) return res.status(422).json({ error: err.message, code: err.code });
  if (err instanceof SaveMigrationError) return res.status(422).json({ error: err.message });
  if (err instanceof UniqueConstraintError) return res.status(409).json({ error: 'Registro duplicado' });
  if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'JSON inválido' });

  console.error('❌ Erro não tratado:', err);
  return res.status(500).json({ error: 'Erro interno do servidor' });
}
