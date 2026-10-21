import { Router, Request, Response } from 'express';
import { authenticate, requireRoles } from '../middleware/auth';
import { reportRepository } from '../repositories/reportRepository';
import { query } from '../config/database';
import { ListReportsParams, CreateReportInput } from '../types/models';
import { ReportType } from '../types/domain';

const router = Router();

const generateRoles = requireRoles('GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER');

/**
 * Build the report data snapshot: aggregate stats for the given
 * date range and project scope.
 */
const buildReportData = async (options: {
  startDate?: string | null;
  endDate?: string | null;
  scope?: string;
  includeFinancials?: boolean;
  includeContractors?: boolean;
}) => {
  const clauses: string[] = [];
  const params: any[] = [];

  if (options.startDate) {
    params.push(options.startDate);
    clauses.push(`created_at >= $${params.length}::date`);
  }
  if (options.endDate) {
    params.push(options.endDate);
    clauses.push(`created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  if (options.scope === 'active') clauses.push(`status = 'IN_PROGRESS'`);
  if (options.scope === 'completed') clauses.push(`status = 'COMPLETED'`);
  if (options.scope === 'delayed') clauses.push(`status = 'DELAYED'`);

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';

  const projectsResult = await query(`SELECT * FROM projects ${whereClause}`, params);
  const projects = projectsResult.rows;

  const byStatus: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let totalBudget = 0;
  let spentBudget = 0;
  let progressSum = 0;

  for (const p of projects) {
    byStatus[p.status] = (byStatus[p.status] || 0) + 1;
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
    totalBudget += Number(p.allocated_budget ?? p.budget ?? 0);
    spentBudget += Number(p.spent_budget ?? 0);
    progressSum += Number(p.progress ?? 0);
  }

  const data: any = {
    generatedAt: new Date().toISOString(),
    scope: options.scope || 'all',
    dateRange: {
      start: options.startDate || null,
      end: options.endDate || null,
    },
    projectCount: projects.length,
    byStatus,
    byCategory,
    averageProgress: projects.length > 0 ? progressSum / projects.length : 0,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      status: p.status,
      progress: Number(p.progress ?? 0),
      lga: p.lga,
      budget: Number(p.budget ?? 0),
      spentBudget: Number(p.spent_budget ?? 0),
    })),
  };

  if (options.includeFinancials) {
    data.financials = { totalBudget, spentBudget, remainingBudget: totalBudget - spentBudget };
  }

  if (options.includeContractors) {
    const contractorsResult = await query(
      `SELECT id, company_name, rating, is_verified, is_certified FROM contractor_profiles`
    );
    data.contractors = contractorsResult.rows.map((c) => ({
      id: c.id,
      companyName: c.company_name,
      rating: Number(c.rating ?? 0),
      isVerified: c.is_verified,
      isCertified: c.is_certified,
    }));
  }

  return data;
};

/**
 * GET /api/reports
 * List generated reports
 */
router.get('/', authenticate, generateRoles, async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '50', 10), 1), 100);

    const filters: ListReportsParams = {
      type: typeof req.query.type === 'string' ? req.query.type.toUpperCase() : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page,
      limit,
    };

    const { reports, total } = await reportRepository.listWithFilters(filters);

    return res.json({
      success: true,
      data: {
        reports,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    console.error('Get reports error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get reports' });
  }
});

/**
 * POST /api/reports/generate
 * Generate a new report snapshot (Government + M&E roles)
 */
router.post('/generate', authenticate, generateRoles, async (req: Request, res: Response) => {
  try {
    const {
      title,
      type = 'CUSTOM',
      category,
      startDate,
      endDate,
      scope,
      includeFinancials,
      includeContractors,
      isPublic,
    } = req.body;

    const normalizedType = String(type).toUpperCase();
    if (!(Object.values(ReportType) as string[]).includes(normalizedType)) {
      return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    const data = await buildReportData({
      startDate: startDate || null,
      endDate: endDate || null,
      scope,
      includeFinancials: Boolean(includeFinancials),
      includeContractors: Boolean(includeContractors),
    });

    const reportInput: CreateReportInput = {
      title: title || `${normalizedType} Report - ${new Date().toLocaleDateString('en-NG')}`,
      type: normalizedType,
      category: category || null,
      generatedBy: req.user!.userId,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      data,
      isPublic: Boolean(isPublic),
    };

    const report = await reportRepository.create(reportInput);

    return res.status(201).json({
      success: true,
      message: 'Report generated successfully',
      data: { report },
    });
  } catch (error: any) {
    console.error('Generate report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
});

/**
 * GET /api/reports/:id
 * Get a single report (including its data snapshot)
 */
router.get('/:id', authenticate, generateRoles, async (req: Request, res: Response) => {
  try {
    const report = await reportRepository.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    return res.json({ success: true, data: { report } });
  } catch (error: any) {
    console.error('Get report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get report' });
  }
});

/**
 * GET /api/reports/:id/download
 * Download the report data as a JSON file (Authorization header only).
 */
router.get('/:id/download', authenticate, generateRoles, async (req: Request, res: Response) => {
  try {
    const report = await reportRepository.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    await reportRepository.incrementDownloads(report.id);

    const payload = {
      title: report.title,
      type: report.type,
      category: report.category,
      generatedBy: report.generatedByName,
      generatedAt: report.createdAt,
      startDate: report.startDate,
      endDate: report.endDate,
      ...((report.data as object) || {}),
    };

    const filename = `${report.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify(payload, null, 2));
  } catch (error: any) {
    console.error('Download report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to download report' });
  }
});

/**
 * DELETE /api/reports/:id
 * Delete a report (Admin only)
 */
router.delete('/:id', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (req: Request, res: Response) => {
  try {
    const report = await reportRepository.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    await reportRepository.delete(report.id);
    return res.json({ success: true, message: 'Report deleted' });
  } catch (error: any) {
    console.error('Delete report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete report' });
  }
});

export default router;
