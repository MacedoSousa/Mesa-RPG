import { z } from 'zod';
import { sequelize } from '../config/database';
import { env } from '../config/env';
import { Campaign, Character, CharacterSheet, User } from '../models';
import { HttpError } from '../utils/HttpError';
import {
  dummyVerify, hashPassword, signAccessToken, signRefreshToken, verifyPassword, verifyRefreshToken,
} from '../utils/security';
import { Op } from 'sequelize';

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, 'Use apenas letras, números, ponto, hífen ou underline'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(128),
  displayName: z.string().trim().max(60).optional(),
  masterCode: z.string().trim().max(100).optional(),
});

export const promoteSchema = z.object({ masterCode: z.string().trim().min(1, 'Informe o código de Mestre').max(100) });

/** Comparação tolerante: ignora espaços nas pontas e maiúsculas/minúsculas. */
export function isValidMasterCode(code: string | undefined): boolean {
  const expected = env.MASTER_INVITE_CODE?.trim().toLowerCase();
  return !!expected && !!code && code.trim().toLowerCase() === expected;
}

const WRONG_CODE =
  'Código de Mestre incorreto. Ele fica no arquivo server/.env, na linha MASTER_INVITE_CODE (o terminal do Host também mostra ao iniciar). ' +
  'Atenção: o código de 6 letras da campanha (ex.: K7QX2M) é outra coisa — ele serve para jogadores entrarem numa mesa.';

export const loginSchema = z.object({
  login: z.string().trim().min(1, 'Informe e-mail ou username').max(255),
  password: z.string().min(1).max(128),
});

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

function issueTokens(user: User): AuthTokens {
  return {
    accessToken: signAccessToken({ sub: user.id, username: user.username, role: user.role, tv: user.tokenVersion }),
    refreshToken: signRefreshToken({ sub: user.id, tv: user.tokenVersion }),
  };
}

export const AuthService = {
  async register(input: z.infer<typeof registerSchema>) {
    const data = registerSchema.parse(input);
    const [usernameTaken, emailTaken] = await Promise.all([
      User.findOne({ where: sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), data.username.toLowerCase()) }),
      User.findOne({ where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), data.email) }),
    ]);
    if (usernameTaken || emailTaken) {
      throw new HttpError(409, 'Username ou e-mail já em uso', { username: !!usernameTaken, email: !!emailTaken });
    }

    // O primeiro cadastro do servidor é o Mestre (dono do PC Host). Depois, só com código de convite.
    const hasMaster = (await User.count({ where: { role: 'MASTER' } })) > 0;
    const validCode = isValidMasterCode(data.masterCode);
    // Sem nenhum Mestre ainda, o primeiro cadastro vira Mestre de qualquer jeito (código é ignorado)
    if (hasMaster && data.masterCode && !validCode) throw new HttpError(403, WRONG_CODE, { code: 'master_code' });
    const role = !hasMaster || validCode ? 'MASTER' : 'PLAYER';

    const user = await User.create({
      username: data.username,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      displayName: data.displayName ?? null,
      role,
    });
    return { user, tokens: issueTokens(user) };
  },

  async login(input: z.infer<typeof loginSchema>) {
    const { login, password } = loginSchema.parse(input);
    const needle = login.toLowerCase();
    const user = await User.findOne({
      where: {
        [Op.or]: [
          sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), needle),
          sequelize.where(sequelize.fn('LOWER', sequelize.col('username')), needle),
        ],
      },
    });
    const valid = user ? await verifyPassword(user.passwordHash, password) : await dummyVerify(password).then(() => false);
    if (!user || !valid) throw new HttpError(401, 'Credenciais inválidas');
    return { user, tokens: issueTokens(user) };
  },

  /** Troca um refresh token válido por um novo par (rotação). */
  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw new HttpError(401, 'Sessão expirada');
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new HttpError(401, 'Sessão expirada');
    }
    const user = await User.findByPk(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) throw new HttpError(401, 'Sessão revogada');
    return { user, tokens: issueTokens(user) };
  },

  /** Conta existente de Jogador vira Mestre (também continua podendo jogar nas mesas dos outros). */
  async promote(userId: string, input: unknown) {
    const { masterCode } = promoteSchema.parse(input);
    if (!isValidMasterCode(masterCode)) throw new HttpError(403, WRONG_CODE, { code: 'master_code' });
    const user = await User.findByPk(userId);
    if (!user) throw new HttpError(404, 'Usuário não encontrado');
    if (user.role !== 'MASTER') await user.update({ role: 'MASTER' });
    return { user, tokens: issueTokens(user) };
  },

  /** Invalida todos os refresh tokens do usuário. */
  async logoutEverywhere(userId: string) {
    await User.increment('tokenVersion', { where: { id: userId } });
  },

  /** Soft delete da conta: usuário, fichas, personagens e campanhas que ele mestra. */
  async deleteAccount(userId: string) {
    await sequelize.transaction(async (transaction) => {
      const user = await User.findByPk(userId, { transaction });
      if (!user) throw new HttpError(404, 'Usuário não encontrado');
      const characters = await Character.findAll({ where: { userId }, transaction });
      const ids = characters.map((c) => c.id);
      if (ids.length) {
        await CharacterSheet.destroy({ where: { characterId: ids }, transaction });
        await Character.destroy({ where: { id: ids }, transaction });
      }
      await Campaign.destroy({ where: { masterId: userId }, transaction });
      await user.increment('tokenVersion', { transaction });
      await user.destroy({ transaction });
    });
  },
};
