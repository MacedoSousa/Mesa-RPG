import bcrypt from 'bcryptjs';
import { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { UserModel, toPublicUser } from '../models/User';
import { HttpError } from '../utils/HttpError';
import { signToken } from '../utils/jwt';

const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_.-]+$/, 'Use apenas letras, números, ponto, hífen ou underline'),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(128),
  displayName: z.string().trim().max(60).optional(),
});

const loginSchema = z.object({
  login: z.string().trim().min(1, 'Informe e-mail ou username'),
  password: z.string().min(1),
});

export const AuthController = {
  async register(req: Request, res: Response) {
    const data = registerSchema.parse(req.body);

    const taken = await UserModel.existsActive(data.username, data.email);
    if (taken.username || taken.email) {
      throw new HttpError(409, 'Username ou e-mail já em uso', {
        username: taken.username,
        email: taken.email,
      });
    }

    const passwordHash = await bcrypt.hash(data.password, env.BCRYPT_ROUNDS);
    // Todo cadastro público nasce como "jogador"; o Mestre é promovido manualmente no banco
    const user = await UserModel.create({
      username: data.username,
      email: data.email,
      passwordHash,
      displayName: data.displayName,
    });

    const token = signToken({ sub: user.id, username: user.username, role: user.role });
    res.status(201).json({ user: toPublicUser(user), token });
  },

  async login(req: Request, res: Response) {
    const { login, password } = loginSchema.parse(req.body);

    const user = await UserModel.findByLogin(login);
    // Mesma mensagem para usuário inexistente/removido e senha errada
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;
    if (!user || !valid) throw new HttpError(401, 'Credenciais inválidas');

    const token = signToken({ sub: user.id, username: user.username, role: user.role });
    res.json({ user: toPublicUser(user), token });
  },

  async me(req: Request, res: Response) {
    const user = await UserModel.findById(req.auth!.sub);
    if (!user) throw new HttpError(404, 'Usuário não encontrado');
    res.json({ user: toPublicUser(user) });
  },

  /** Soft delete da própria conta (e das fichas dela). */
  async deleteMe(req: Request, res: Response) {
    const ok = await UserModel.softDelete(req.auth!.sub);
    if (!ok) throw new HttpError(404, 'Usuário não encontrado');
    res.status(204).send();
  },
};
