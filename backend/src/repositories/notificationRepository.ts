import { query, rowToCamelCase } from '../config/database';
import { CreateNotificationInput, DbNotification } from '../types/models';

const notificationColumns = `
  id, user_id, type, title, message, data, is_read, is_urgent, created_at
`;

const mapNotification = (row: any): DbNotification => {
  const data = rowToCamelCase(row);
  return {
    id: data.id,
    userId: data.userId,
    type: data.type,
    title: data.title,
    message: data.message,
    data: data.data ?? null,
    isRead: Boolean(data.isRead),
    isUrgent: Boolean(data.isUrgent),
    createdAt: new Date(data.createdAt),
  };
};

export const notificationRepository = {
  async listByUser(userId: string, limit = 50): Promise<DbNotification[]> {
    const result = await query(
      `SELECT ${notificationColumns}
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, Math.min(Math.max(limit, 1), 200)]
    );
    return result.rows.map(mapNotification);
  },

  async unreadCount(userId: string): Promise<number> {
    const result = await query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [userId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
  },

  async markRead(id: string, userId: string): Promise<void> {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  },

  async markAllRead(userId: string): Promise<void> {
    await query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1',
      [userId]
    );
  },

  async remove(id: string, userId: string): Promise<void> {
    await query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
  },

  async removeAll(userId: string): Promise<void> {
    await query('DELETE FROM notifications WHERE user_id = $1', [userId]);
  },

  async create(input: CreateNotificationInput): Promise<DbNotification> {
    const result = await query(
      `INSERT INTO notifications (user_id, type, title, message, data, is_urgent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${notificationColumns}`,
      [
        input.userId,
        input.type,
        input.title,
        input.message,
        input.data ? JSON.stringify(input.data) : null,
        input.isUrgent ?? false,
      ]
    );
    return mapNotification(result.rows[0]);
  },

  /**
   * Create the same notification for every user holding one of the given roles.
   * Returns the number of notifications created.
   */
  async createForRoles(
    roles: string[],
    input: Omit<CreateNotificationInput, 'userId'>
  ): Promise<number> {
    const users = await query(
      'SELECT id FROM users WHERE role = ANY($1) AND is_active = TRUE',
      [roles]
    );
    for (const row of users.rows) {
      await this.create({ ...input, userId: row.id });
    }
    return users.rows.length;
  },
};

export default notificationRepository;
