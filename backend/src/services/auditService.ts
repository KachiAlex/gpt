import { PoolClient } from 'pg';
import { query } from '../config/database';
import { Request } from 'express';

export interface AuditEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  detail?: Record<string, unknown>;
  ip?: string | null;
}

// Derive actor + IP from a request in route handlers.
export const auditFromReq = (
  req: Request,
  action: string,
  entityType?: string,
  entityId?: string,
  detail?: Record<string, unknown>
): AuditEntry => ({
  actorId: req.user?.userId ?? null,
  actorEmail: req.user?.email ?? null,
  actorRole: req.user?.role ?? null,
  action,
  entityType: entityType ?? null,
  entityId: entityId ?? null,
  detail: detail ?? {},
  ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || null,
});

/**
 * Append an audit row. Never throws into the request path — audit failure
 * must not block the action it records (the write error is logged).
 * Pass `client` to join an open transaction when the audited write must
 * commit atomically with it.
 */
export const audit = async (entry: AuditEntry, client?: PoolClient): Promise<void> => {
  const sql = `INSERT INTO audit_log (actor_id, actor_email, actor_role, action, entity_type, entity_id, detail, ip)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
  const params = [
    entry.actorId ?? null,
    entry.actorEmail ?? null,
    entry.actorRole ?? null,
    entry.action,
    entry.entityType ?? null,
    entry.entityId ?? null,
    JSON.stringify(entry.detail ?? {}),
    entry.ip ?? null,
  ];
  try {
    if (client) await client.query(sql, params);
    else await query(sql, params);
  } catch (e) {
    console.error('Audit write failed:', e);
  }
};
