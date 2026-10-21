import { query, rowToCamelCase } from '../config/database';

export interface DbInvite {
  id: string;
  token: string;
  email: string | null;
  role: string;
  note: string | null;
  invitedBy: string;
  expiresAt: Date;
  usedAt: Date | null;
  usedBy: string | null;
  revokedAt: Date | null;
  createdAt: Date;
  invitedByName?: string;
  usedByEmail?: string;
}

const inviteColumns = `
  id, token, email, role, note, invited_by,
  expires_at, used_at, used_by, revoked_at, created_at
`;

const mapInvite = (row: any): DbInvite => ({
  ...rowToCamelCase(row),
  expiresAt: new Date(row.expires_at),
  usedAt: row.used_at ? new Date(row.used_at) : null,
  revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
  createdAt: new Date(row.created_at),
});

export const inviteRepository = {
  async create(data: {
    token: string;
    email: string | null;
    role: string;
    note: string | null;
    invitedBy: string;
    expiresAt: Date;
  }): Promise<DbInvite> {
    const result = await query(
      `INSERT INTO user_invites (token, email, role, note, invited_by, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${inviteColumns}`,
      [data.token, data.email, data.role, data.note, data.invitedBy, data.expiresAt]
    );
    return mapInvite(result.rows[0]);
  },

  async findByToken(token: string): Promise<DbInvite | null> {
    const result = await query(
      `SELECT ${inviteColumns} FROM user_invites WHERE token = $1 LIMIT 1`,
      [token]
    );
    return result.rows[0] ? mapInvite(result.rows[0]) : null;
  },

  // Atomic consumption — only an unused, unrevoked, unexpired invite
  // consumes. Two concurrent acceptances can't both succeed. used_by is
  // stamped separately after the user row exists (FK target).
  async consume(token: string): Promise<DbInvite | null> {
    const result = await query(
      `UPDATE user_invites
       SET used_at = NOW()
       WHERE token = $1 AND used_at IS NULL AND revoked_at IS NULL
         AND expires_at > NOW()
       RETURNING ${inviteColumns}`,
      [token]
    );
    return result.rows[0] ? mapInvite(result.rows[0]) : null;
  },

  async stampUsedBy(id: string, userId: string): Promise<void> {
    await query('UPDATE user_invites SET used_by = $1 WHERE id = $2', [userId, id]);
  },

  async listRecent(limit = 50): Promise<DbInvite[]> {
    const result = await query(
      `SELECT i.id, i.token, i.email, i.role, i.note, i.invited_by,
              i.expires_at, i.used_at, i.used_by, i.revoked_at, i.created_at,
              u.first_name || ' ' || u.last_name AS invited_by_name,
              uu.email AS used_by_email
       FROM user_invites i
       JOIN users u ON u.id = i.invited_by
       LEFT JOIN users uu ON uu.id = i.used_by
       ORDER BY i.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows.map(mapInvite);
  },

  async revoke(id: string): Promise<boolean> {
    const result = await query(
      `UPDATE user_invites SET revoked_at = NOW()
       WHERE id = $1 AND used_at IS NULL AND revoked_at IS NULL`,
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },
};

export default inviteRepository;
