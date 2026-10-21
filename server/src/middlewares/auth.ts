import type { NextFunction, Request, Response } from 'express';
import type { Actor, Role } from '@mesa/shared';
import { User } from '../models';
import { HttpError } from '../utils/HttpError';
import { verifyAccessToken } from '../utils/security';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}

/** Exige "Authorization: Bearer <access token>" de um usuário ativo (não removido). */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Faça login para continuar');
  let payload;
  try {
    payload = verifyAccessToken(header.slice(7));
  } catch {
    throw new HttpError(401, 'Sessão expirada', { code: 'token_expired' });
  }
  const user = await User.findByPk(payload.sub);
  if (!user || user.tokenVersion !== payload.tv) throw new HttpError(401, 'Sessão inválida');
  req.actor = { userId: user.id, username: user.username, role: user.role };
  next();
}

/** RBAC na API REST: restringe a rota a um papel global. */
export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.actor?.role !== role) throw new HttpError(403, role === 'MASTER' ? 'Apenas Mestres podem fazer isso' : 'Acesso negado');
    next();
  };
}

/** Limitador simples em memória (por IP) para login/cadastro. */
export function rateLimit(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip ?? 'anon';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.reset < now) {
      hits.set(key, { count: 1, reset: now + opts.windowMs });
      return next();
    }
    entry.count += 1;
    if (entry.count > opts.max) throw new HttpError(429, 'Muitas tentativas. Aguarde um pouco e tente novamente.');
    next();
  };
}
