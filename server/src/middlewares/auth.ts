import { NextFunction, Request, Response } from 'express';
import { UserModel } from '../models/User';
import { HttpError } from '../utils/HttpError';
import { TokenPayload, verifyToken } from '../utils/jwt';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

/** Exige header "Authorization: Bearer <token>" de um usuário ativo (não soft-deletado). */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Token não informado');

  let payload: TokenPayload;
  try {
    payload = verifyToken(header.slice(7));
  } catch {
    throw new HttpError(401, 'Token inválido ou expirado');
  }

  const user = await UserModel.findById(payload.sub);
  if (!user) throw new HttpError(401, 'Usuário não encontrado ou removido');

  req.auth = { sub: user.id, username: user.username, role: user.role };
  next();
}
