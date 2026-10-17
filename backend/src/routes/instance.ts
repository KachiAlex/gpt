import { Router, Request, Response } from 'express';
import { query, rowToCamelCase, getClient } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth';
import { getStages } from '../services/workflowService';
import { audit, auditFromReq } from '../services/auditService';

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
};

/**
 * PUT /api/instance
 * Update white-label settings (admin only)
 */
router.put('/', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (req: Request, res: Response) => {
  try {
    const sets: string[] = [];
    const values: any[] = [];
    for (const [key, col] of Object.entries(EDITABLE_FIELDS)) {
      if (req.body[key] !== undefined) {
        values.push(req.body[key]);
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
router.put('/workflow', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (req: Request, res: Response) => {
  const incoming = Array.isArray(req.body?.stages) ? req.body.stages : null;
  if (!incoming) {
    return res.status(400).json({ success: false, message: 'stages array is required' });
  }
  for (const s of incoming) {
    if (!s?.label || typeof s.label !== 'string') {
      return res.status(400).json({ success: false, message: 'Each stage needs a label' });
    }
    if (!Array.isArray(s.allowedRoles)) {
      return res.status(400).json({ success: false, message: 'Each stage needs allowedRoles[]' });
    }
  }

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
        await client.query(
          `UPDATE workflow_stages SET label = $2::text, allowed_roles = $3::text[], order_index = $4::int WHERE key = $1::text`,
          [key, s.label, s.allowedRoles, order]
        );
      } else {
        await client.query(
          `INSERT INTO workflow_stages (key, label, order_index, allowed_roles, maps_to_status, is_terminal, is_system)
           VALUES ($1::text, $2::text, $3::int, $4::text[], 'UNDER_REVIEW', FALSE, FALSE)`,
          [key, s.label, order, s.allowedRoles]
        );
      }
      order += 1;
    }

    // Delete custom stages that were removed (never system ones)
    for (const r of existing.rows as any[]) {
      if (!r.is_system && !seen.has(r.key)) {
        await client.query(`UPDATE submissions SET stage = 'UNDER_REVIEW' WHERE stage = $1`, [r.key]);
        await client.query(`DELETE FROM workflow_stages WHERE key = $1`, [r.key]);
      }
    }

    // Terminals always sit after the forward chain
    await client.query(`UPDATE workflow_stages SET order_index = $1 WHERE key = 'APPROVED'`, [order]);
    await client.query(`UPDATE workflow_stages SET order_index = $1 WHERE key = 'REJECTED'`, [order + 1]);

    await audit(
      auditFromReq(req, 'instance.workflow', 'instance', '1', { stageCount: seen.size, stages: [...seen] }),
      client
    );
    await client.query('COMMIT');
    return res.json({ success: true, data: { stages: await getStages() } });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Update workflow error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update workflow' });
  } finally {
    client.release();
  }
});

export default router;
