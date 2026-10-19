import { Router, Request, Response } from 'express';
import { query, rowToCamelCase, getClient } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth';
import { getStages } from '../services/workflowService';
import { audit, auditFromReq } from '../services/auditService';
import { getFeatures } from '../services/featureFlags';

const router = Router();

interface InstanceConfig {
  name: string;
  logoUrl: string | null;
  brandColor: string;
  sidebarColor: string | null;
  currency: string;
  areaLabel: string;
  areaLabelPlural: string;
  contactEmail: string | null;
  footerOrg: string;
  faviconUrl: string | null;
  accentColor: string | null;
  features: Record<string, boolean>;
}

// env vars provide the baseline; the DB row overrides them when set
const envDefaults = (): InstanceConfig => ({
  name: process.env.INSTANCE_NAME || 'Government Project Tracker',
  logoUrl: process.env.INSTANCE_LOGO_URL || null,
  brandColor: process.env.INSTANCE_BRAND_COLOR || '#0284c7',
  sidebarColor: process.env.INSTANCE_SIDEBAR_COLOR || null,
  currency: process.env.INSTANCE_CURRENCY || '₦',
  areaLabel: process.env.INSTANCE_AREA_LABEL || 'LGA',
  areaLabelPlural: process.env.INSTANCE_AREA_LABEL_PLURAL || 'LGAs',
  contactEmail: process.env.INSTANCE_CONTACT_EMAIL || null,
  footerOrg: process.env.INSTANCE_FOOTER_ORG || 'Kreatix Technologies',
  faviconUrl: process.env.INSTANCE_FAVICON_URL || null,
  accentColor: process.env.INSTANCE_ACCENT_COLOR || null,
  features: getFeatures(),
});

const getConfig = async (): Promise<InstanceConfig> => {
  const defaults = envDefaults();
  try {
    const result = await query('SELECT * FROM instance_settings WHERE id = 1');
    if (result.rows.length === 0) return defaults;
    const row = rowToCamelCase(result.rows[0]);
    // Treat untouched defaults as "inherit env", explicit values win
    return {
      name: row.name || defaults.name,
      logoUrl: row.logoUrl ?? defaults.logoUrl,
      brandColor: row.brandColor || defaults.brandColor,
      sidebarColor: row.sidebarColor ?? defaults.sidebarColor,
      currency: row.currency || defaults.currency,
      areaLabel: row.areaLabel || defaults.areaLabel,
      areaLabelPlural: row.areaLabelPlural || defaults.areaLabelPlural,
      contactEmail: row.contactEmail ?? defaults.contactEmail,
      footerOrg: row.footerOrg || defaults.footerOrg,
      faviconUrl: row.faviconUrl ?? defaults.faviconUrl,
      accentColor: row.accentColor ?? defaults.accentColor,
      features: defaults.features,
    };
  } catch {
    // Table may not exist yet on a pre-migration database
    return defaults;
  }
};

/**
 * GET /api/instance
 * Public white-label configuration for this deployment.
 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: { instance: await getConfig() } });
  } catch (error: any) {
    console.error('Get instance config error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load instance config' });
  }
});

const EDITABLE_FIELDS: Record<string, string> = {
  name: 'name',
  logoUrl: 'logo_url',
  brandColor: 'brand_color',
  sidebarColor: 'sidebar_color',
  currency: 'currency',
  areaLabel: 'area_label',
  areaLabelPlural: 'area_label_plural',
  contactEmail: 'contact_email',
  footerOrg: 'footer_org',
  faviconUrl: 'favicon_url',
  accentColor: 'accent_color',
};

// When REQUIRE_SECOND_APPROVAL=true, admin config changes create a pending
// request that a DIFFERENT admin must approve before it applies.
const SECOND_APPROVAL = process.env.REQUIRE_SECOND_APPROVAL === 'true';

const applyInstanceUpdate = async (body: Record<string, any>) => {
  const sets: string[] = [];
  const values: any[] = [];
  for (const [key, col] of Object.entries(EDITABLE_FIELDS)) {
    if (body[key] !== undefined) {
      values.push(body[key]);
      sets.push(`${col} = $${values.length}`);
    }
  }
  if (sets.length > 0) {
    await query('INSERT INTO instance_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
    await query(
      `UPDATE instance_settings SET ${sets.join(', ')}, updated_at = NOW() WHERE id = 1`,
      values
    );
  }
};

const createConfigRequest = async (req: Request, kind: 'instance' | 'workflow', payload: any) => {
  const result = await query(
    `INSERT INTO config_requests (kind, payload, requested_by) VALUES ($1, $2, $3) RETURNING id`,
    [kind, JSON.stringify(payload), req.user!.userId]
  );
  await audit(auditFromReq(req, 'config.request', 'config_request', result.rows[0].id, { kind }));
  return result.rows[0].id;
};

/**
 * PUT /api/instance
 * Update white-label settings (admin only)
 */
router.put('/', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (req: Request, res: Response) => {
  try {
    if (SECOND_APPROVAL) {
      const requestId = await createConfigRequest(req, 'instance', req.body);
      return res.status(202).json({
        success: true,
        message: 'Change submitted — requires approval from a second administrator',
        data: { pending: true, requestId },
      });
    }
    await applyInstanceUpdate(req.body);
    await audit(auditFromReq(req, 'instance.update', 'instance', '1', { fields: Object.keys(req.body || {}) }));
    return res.json({ success: true, data: { instance: await getConfig() } });
  } catch (error: any) {
    console.error('Update instance config error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update instance config' });
  }
});

/**
 * GET /api/instance/workflow
 * Public — the configured submission review chain for this deployment.
 */
router.get('/workflow', async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, data: { stages: await getStages() } });
  } catch (error: any) {
    // Pre-migration databases: fall back to the built-in chain
    return res.json({
      success: true,
      data: {
        stages: [
          { key: 'DRAFT', label: 'Draft', orderIndex: 0, allowedRoles: ['CONTRACTOR'], mapsToStatus: 'PENDING', isTerminal: false, isSystem: true },
          { key: 'SUBMITTED', label: 'Submitted', orderIndex: 1, allowedRoles: ['CONTRACTOR'], mapsToStatus: 'PENDING', isTerminal: false, isSystem: true },
          { key: 'UNDER_REVIEW', label: 'Under review', orderIndex: 2, allowedRoles: ['ME_OFFICER', 'GOVERNMENT_ADMIN'], mapsToStatus: 'UNDER_REVIEW', isTerminal: false, isSystem: false },
          { key: 'APPROVED', label: 'Approved', orderIndex: 3, allowedRoles: ['ME_OFFICER', 'GOVERNMENT_ADMIN'], mapsToStatus: 'APPROVED', isTerminal: true, isSystem: true },
          { key: 'REJECTED', label: 'Rejected', orderIndex: 4, allowedRoles: ['ME_OFFICER', 'GOVERNMENT_ADMIN'], mapsToStatus: 'REJECTED', isTerminal: true, isSystem: true },
        ],
      },
    });
  }
});

/**
 * PUT /api/instance/workflow  (admin only)
 * Replace the forward review chain. Body: { stages: [{ key?, label, allowedRoles }] }
 * System stages (SUBMITTED entry point, APPROVED/REJECTED terminals) are kept;
 * custom mid-stages are inserted between SUBMITTED and APPROVED.
 */
const validateStagePayload = (incoming: any): string | null => {
  if (!Array.isArray(incoming)) return 'stages array is required';
  for (const s of incoming) {
    if (!s?.label || typeof s.label !== 'string') return 'Each stage needs a label';
    if (!Array.isArray(s.allowedRoles)) return 'Each stage needs allowedRoles[]';
  }
  return null;
};

const applyWorkflowUpdate = async (incoming: any[], auditEntry: ReturnType<typeof auditFromReq>) => {
  const slug = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM workflow_stages');
    const byKey = new Map(existing.rows.map((r: any) => [r.key, r]));

    // Payload order defines the chain between SUBMITTED and APPROVED
    let order = 2;
    const seen = new Set<string>();
    for (const s of incoming) {
      const key = s.key && byKey.has(s.key) ? s.key : slug(s.key || s.label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (byKey.has(key)) {
        const existing = byKey.get(key) as any;
        if (existing?.is_system) {
          // System stages keep their configured role gate — an admin can
          // rename/reorder them but not widen who can act on them.
          await client.query(
            `UPDATE workflow_stages SET label = $2::text, order_index = $3::int WHERE key = $1::text`,
            [key, s.label, order]
          );
        } else {
          await client.query(
            `UPDATE workflow_stages SET label = $2::text, allowed_roles = $3::text[], order_index = $4::int WHERE key = $1::text`,
            [key, s.label, s.allowedRoles, order]
          );
        }
      } else {
        await client.query(
          `INSERT INTO workflow_stages (key, label, order_index, allowed_roles, maps_to_status, is_terminal, is_system)
           VALUES ($1::text, $2::text, $3::int, $4::text[], 'UNDER_REVIEW', FALSE, FALSE)`,
          [key, s.label, order, s.allowedRoles]
        );
      }
      order += 1;
    }

    // Delete custom stages that were removed (never system ones).
    // Submissions sitting on a deleted stage move to the first remaining
    // mid-stage, or back to SUBMITTED (a system stage that always exists) —
    // never a hard-coded stage that may itself have been removed.
    const fallbackStage = [...seen][0] ?? 'SUBMITTED';
    for (const r of existing.rows as any[]) {
      if (!r.is_system && !seen.has(r.key)) {
        await client.query(`UPDATE submissions SET stage = $2 WHERE stage = $1`, [r.key, fallbackStage]);
        await client.query(`DELETE FROM workflow_stages WHERE key = $1`, [r.key]);
      }
    }

    // Terminals always sit after the forward chain
    await client.query(`UPDATE workflow_stages SET order_index = $1 WHERE key = 'APPROVED'`, [order]);
    await client.query(`UPDATE workflow_stages SET order_index = $1 WHERE key = 'REJECTED'`, [order + 1]);

    await audit(
      { ...auditEntry, detail: { ...auditEntry.detail, stageCount: seen.size, stages: [...seen] } },
      client
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * PUT /api/instance/workflow  (admin only)
 * Replace the forward review chain. Body: { stages: [{ key?, label, allowedRoles }] }
 * System stages (SUBMITTED entry point, APPROVED/REJECTED terminals) are kept;
 * custom mid-stages are inserted between SUBMITTED and APPROVED.
 */
router.put('/workflow', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (req: Request, res: Response) => {
  const incoming = req.body?.stages;
  const invalid = validateStagePayload(incoming);
  if (invalid) {
    return res.status(400).json({ success: false, message: invalid });
  }

  try {
    if (SECOND_APPROVAL) {
      const requestId = await createConfigRequest(req, 'workflow', { stages: incoming });
      return res.status(202).json({
        success: true,
        message: 'Change submitted — requires approval from a second administrator',
        data: { pending: true, requestId },
      });
    }
    await applyWorkflowUpdate(incoming, auditFromReq(req, 'instance.workflow', 'instance', '1', {}));
    return res.json({ success: true, data: { stages: await getStages() } });
  } catch (error: any) {
    console.error('Update workflow error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update workflow' });
  }
});

/**
 * GET /api/instance/requests — pending config-change queue (admin only).
 * POST /api/instance/requests/:id/approve|reject — decided by a DIFFERENT admin.
 */
router.get('/requests', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (_req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT cr.id, cr.kind, cr.payload, cr.status, cr.created_at, cr.decided_at,
              req.email AS requested_by_email, dec.email AS decided_by_email
       FROM config_requests cr
       JOIN users req ON req.id = cr.requested_by
       LEFT JOIN users dec ON dec.id = cr.decided_by
       ORDER BY cr.status = 'PENDING' DESC, cr.created_at DESC
       LIMIT 100`
    );
    return res.json({ success: true, data: { requests: result.rows.map(rowToCamelCase) } });
  } catch (error: any) {
    console.error('List config requests error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list requests' });
  }
});

const decideRequest = (approve: boolean) =>
  async (req: Request, res: Response) => {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      const found = await client.query(
        `SELECT * FROM config_requests WHERE id = $1 FOR UPDATE`, [req.params.id]
      );
      const request = found.rows[0];
      if (!request) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, message: 'Request not found' });
      }
      if (request.status !== 'PENDING') {
        await client.query('ROLLBACK');
        return res.status(409).json({ success: false, message: `Request already ${request.status.toLowerCase()}` });
      }
      if (request.requested_by === req.user!.userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ success: false, message: 'A second administrator must decide this request' });
      }

      await client.query(
        `UPDATE config_requests SET status = $2, decided_by = $3, decided_at = NOW() WHERE id = $1`,
        [req.params.id, approve ? 'APPROVED' : 'REJECTED', req.user!.userId]
      );
      await audit(auditFromReq(req, approve ? 'config.approve' : 'config.reject', 'config_request', req.params.id, { kind: request.kind }), client);
      await client.query('COMMIT');

      // Apply outside the request-status transaction so a failed apply
      // doesn't silently re-open the request
      if (approve) {
        if (request.kind === 'instance') {
          await applyInstanceUpdate(request.payload);
        } else {
          await applyWorkflowUpdate(
            request.payload.stages,
            auditFromReq(req, 'instance.workflow', 'instance', '1', { approvedRequest: req.params.id })
          );
        }
      }
      return res.json({ success: true, message: approve ? 'Change approved and applied' : 'Request rejected' });
    } catch (error: any) {
      await client.query('ROLLBACK').catch(() => undefined);
      console.error('Decide config request error:', error);
      return res.status(500).json({ success: false, message: 'Failed to decide request' });
    } finally {
      client.release();
    }
  };

router.post('/requests/:id/approve', authenticate, requireRoles('GOVERNMENT_ADMIN'), decideRequest(true));
router.post('/requests/:id/reject', authenticate, requireRoles('GOVERNMENT_ADMIN'), decideRequest(false));

export default router;
