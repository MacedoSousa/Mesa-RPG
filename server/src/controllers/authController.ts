import type { CookieOptions, Request, Response } from 'express';
import { env } from '../config/env';
import { User } from '../models';
import { AuthService } from '../services/authService';
import { HttpError } from '../utils/HttpError';
import { REFRESH_COOKIE } from '../utils/security';

function cookieOptions(req: Request): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
  };
}

function respond(req: Request, res: Response, status: number, result: { user: User; tokens: { accessToken: string; refreshToken: string } }) {
  res.cookie(REFRESH_COOKIE, result.tokens.refreshToken, cookieOptions(req));
  res.status(status).json({ user: result.user.toPublic(), accessToken: result.tokens.accessToken });
}

export const AuthController = {
  async register(req: Request, res: Response) {
    respond(req, res, 201, await AuthService.register(req.body));
  },

  async login(req: Request, res: Response) {
    respond(req, res, 200, await AuthService.login(req.body));
  },

  async refresh(req: Request, res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
    respond(req, res, 200, await AuthService.refresh(token));
  },

  async promote(req: Request, res: Response) {
    respond(req, res, 200, await AuthService.promote(req.actor!.userId, req.body));
  },

  async logout(req: Request, res: Response) {
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(req), maxAge: undefined });
    res.status(204).send();
  },

  async logoutEverywhere(req: Request, res: Response) {
    await AuthService.logoutEverywhere(req.actor!.userId);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(req), maxAge: undefined });
    res.status(204).send();
  },

  async me(req: Request, res: Response) {
    const user = await User.findByPk(req.actor!.userId);
    if (!user) throw new HttpError(404, 'Usuário não encontrado');
    res.json({ user: user.toPublic() });
  },

  async deleteMe(req: Request, res: Response) {
    await AuthService.deleteAccount(req.actor!.userId);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(req), maxAge: undefined });
    res.status(204).send();
  },
};
