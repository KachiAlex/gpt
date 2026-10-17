import { Router, Request, Response } from 'express';
import { query, rowToCamelCase } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth';

const router = Router();

/**
 * GET /api/audit-log  (admin only)
 * Query the audit trail. Filters: action, entityType, entityId, actorId,
 * since (ISO date). Pagination: page, limit (max 200).
 */
router.get('/', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { action, entityType, entityId, actorId, since } = req.query as Record<string, string | undefined>;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));

    const conditions: string[] = [];
    const params: any[] = [];
    const add = (cond: string, val: any) => { params.push(val); conditions.push(`${cond} $${params.length}`); };

    if (action) add('action =', action);
    if (entityType) add('entity_type =', entityType);
    if (entityId) add('entity_id =', entityId);
    if (actorId) add('actor_id =', actorId);
    if (since) add('created_at >=', new Date(since));

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const total = parseInt((await query(`SELECT COUNT(*) FROM audit_log ${where}`, params)).rows[0].count, 10);
    const result = await query(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]
    );

    return res.json({
      success: true,
      data: {
        entries: result.rows.map(rowToCamelCase),
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    console.error('Audit log query error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load audit log' });
  }
});

export default router;
