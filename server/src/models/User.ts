import { query, withTransaction } from '../config/database';

export type UserRole = 'jogador' | 'mestre';

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export type PublicUser = Omit<UserRow, 'password_hash' | 'deleted_at'>;

export function toPublicUser(u: UserRow): PublicUser {
  const { password_hash: _hash, deleted_at: _deleted, ...rest } = u;
  return rest;
}

/** Todas as buscas padrão ignoram registros com soft delete (deleted_at IS NOT NULL). */
export const UserModel = {
  async findById(id: string): Promise<UserRow | null> {
    const { rows } = await query<UserRow>('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL', [id]);
    return rows[0] ?? null;
  },

  async findByLogin(login: string): Promise<UserRow | null> {
    const { rows } = await query<UserRow>(
      `SELECT * FROM users
        WHERE deleted_at IS NULL
          AND (LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1))
        LIMIT 1`,
      [login],
    );
    return rows[0] ?? null;
  },

  async existsActive(username: string, email: string): Promise<{ username: boolean; email: boolean }> {
    const { rows } = await query<{ username_taken: boolean; email_taken: boolean }>(
      `SELECT
         EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL) AS username_taken,
         EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($2) AND deleted_at IS NULL) AS email_taken`,
      [username, email],
    );
    return { username: rows[0].username_taken, email: rows[0].email_taken };
  },

  async create(data: {
    username: string;
    email: string;
    passwordHash: string;
    displayName?: string | null;
    role?: UserRole;
  }): Promise<UserRow> {
    const { rows } = await query<UserRow>(
      `INSERT INTO users (username, email, password_hash, display_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [data.username, data.email, data.passwordHash, data.displayName ?? null, data.role ?? 'jogador'],
    );
    return rows[0];
  },

  /** Soft delete: marca deleted_at e também "apaga" as fichas do usuário. */
  async softDelete(id: string): Promise<boolean> {
    return withTransaction(async (client) => {
      const res = await client.query(
        'UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
        [id],
      );
      if (!res.rowCount) return false;
      await client.query(
        'UPDATE characters SET deleted_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL',
        [id],
      );
      return true;
    });
  },
};
