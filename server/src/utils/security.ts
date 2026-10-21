import argon2 from 'argon2';
import { randomInt } from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import type { Role } from '@mesa/shared';
import { env } from '../config/env';

// ───────────── Senhas: Argon2id com os parâmetros mínimos da OWASP ─────────────
const ARGON_OPTS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON_OPTS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/** Hash fixo para gastar o mesmo tempo quando o usuário não existe (evita enumeração por tempo). */
let dummyHash: Promise<string> | null = null;
export function dummyVerify(password: string) {
  dummyHash ??= hashPassword('senha-inexistente-para-equalizar-tempo');
  return dummyHash.then((h) => verifyPassword(h, password));
}

// ───────────── JWT ─────────────
export interface AccessPayload {
  sub: string;
  username: string;
  role: Role;
  tv: number;
  typ: 'access';
}

export interface RefreshPayload {
  sub: string;
  tv: number;
  typ: 'refresh';
}

export function signAccessToken(p: Omit<AccessPayload, 'typ'>): string {
  return jwt.sign({ ...p, typ: 'access' }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'] });
}

export function signRefreshToken(p: Omit<RefreshPayload, 'typ'>): string {
  return jwt.sign({ ...p, typ: 'refresh' }, env.JWT_REFRESH_SECRET, { expiresIn: `${env.REFRESH_TOKEN_DAYS}d` });
}

export function verifyAccessToken(token: string): AccessPayload {
  const d = jwt.verify(token, env.JWT_SECRET);
  if (typeof d === 'string' || d.typ !== 'access' || !d.sub) throw new Error('Token inválido');
  return d as AccessPayload;
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const d = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (typeof d === 'string' || d.typ !== 'refresh' || !d.sub) throw new Error('Token inválido');
  return d as RefreshPayload;
}

export const REFRESH_COOKIE = 'mesa_rt';

// ───────────── Códigos de convite ─────────────
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I
export function randomCode(length = 6): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}
