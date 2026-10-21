import { Router, Request, Response } from 'express';
import { authenticate, requireRoles } from '../middleware/auth';
import { projectRepository } from '../repositories/projectRepository';
import { contractorRepository } from '../repositories/contractorRepository';
import {
  CreateProjectInput,
  ListProjectsParams,
  UpdateProjectInput,
} from '../types/models';
import { ProjectCategory, ProjectStatus, Priority, MilestoneStatus } from '../types/domain';
import { query, rowToCamelCase } from '../config/database';
import { audit, auditFromReq } from '../services/auditService';

const router = Router();

const verifyToken = authenticate;
const requireAdmin = requireRoles('GOVERNMENT_ADMIN');
const GOV_ROLES = new Set(['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']);

// Read scoping: contractors only ever see projects assigned to their own
// company; PUBLIC accounts get nothing internal (the public portal is
// their interface).
const scopeContractorFilter = async (req: Request): Promise<string | null | false> => {
  if (req.user!.role !== 'CONTRACTOR') return null; // no forced scope
  const contractor = await contractorRepository.findByUserId(req.user!.userId);
  return contractor ? contractor.id : 'no-match'; // unknown profile → empty result set
};

/**
 * GET /api/projects
 * Get all projects with filtering
 */
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    if (!GOV_ROLES.has(req.user!.role) && req.user!.role !== 'CONTRACTOR') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 100);
    const lga = req.query.lga
      ? Array.isArray(req.query.lga)
        ? (req.query.lga as string[])
        : [req.query.lga as string]
      : undefined;

    const ENUM_FILTERS: Record<string, readonly string[]> = {
      status: Object.values(ProjectStatus),
      category: Object.values(ProjectCategory),
      priority: Object.values(Priority),
    };
    for (const [key, valid] of Object.entries(ENUM_FILTERS)) {
      const v = req.query[key];
      if (v !== undefined && !(valid as string[]).includes(v as string)) {
        return res.status(400).json({ success: false, message: `Invalid ${key} filter — must be one of: ${valid.join(', ')}` });
      }
    }

    const filters: ListProjectsParams = {
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      category: typeof req.query.category === 'string' ? req.query.category : undefined,
      priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
      contractorId: typeof req.query.contractorId === 'string' ? req.query.contractorId : undefined,
      lga,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page,
      limit,
    };

    // A contractor's requested filter can't widen the scope — always pin
    // the list to their own company.
    const scope = await scopeContractorFilter(req);
    if (scope) filters.contractorId = scope;

    const { projects, total } = await projectRepository.listWithFilters(filters);

    return res.json({
      success: true,
      data: {
        projects,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('Get projects error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get projects',
    });
  }
});

/**
 * GET /api/projects/stats
 * Alias to stats overview for frontend compatibility
 */
router.get('/stats', verifyToken, requireRoles('GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER'), async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM projects');
    const projects = result.rows.map(rowToCamelCase);

    const stats = {
      total: projects.length,
      byStatus: Object.values(ProjectStatus).reduce((acc: any, status) => {
        acc[status] = projects.filter((p: any) => p.status === status).length;
        return acc;
      }, {}),
      totalBudget: projects.reduce((sum: number, p: any) => sum + Number(p.budget || 0), 0),
      allocatedBudget: projects.reduce((sum: number, p: any) => sum + Number(p.allocatedBudget || p.budget || 0), 0),
      spentBudget: projects.reduce((sum: number, p: any) => sum + Number(p.spentBudget || 0), 0),
      averageProgress: projects.length > 0 ? projects.reduce((sum: number, p: any) => sum + Number(p.progress || 0), 0) / projects.length : 0,
    };

    return res.json({ success: true, data: { stats } });
  } catch (error: any) {
    console.error('Get project stats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get project statistics' });
  }
});

/**
 * GET /api/projects/stats
 * Get project statistics
 */
router.get('/stats/overview', verifyToken, requireRoles('GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER'), async (_req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM projects');
    const projects = result.rows.map(rowToCamelCase);

    const stats = {
      total: projects.length,
      byStatus: Object.values(ProjectStatus).reduce((acc: any, status) => {
        acc[status] = projects.filter((p: any) => p.status === status).length;
        return acc;
      }, {}),
      byCategory: Object.values(ProjectCategory).reduce((acc: any, category) => {
        acc[category] = projects.filter((p: any) => p.category === category).length;
        return acc;
      }, {}),
      totalBudget: projects.reduce((sum: number, p: any) => sum + Number(p.budget || 0), 0),
      allocatedBudget: projects.reduce((sum: number, p: any) => sum + Number(p.allocatedBudget || p.budget || 0), 0),
      spentBudget: projects.reduce((sum: number, p: any) => sum + Number(p.spentBudget || 0), 0),
      averageProgress: projects.length > 0
        ? projects.reduce((sum: number, p: any) => sum + Number(p.progress || 0), 0) / projects.length
        : 0,
    };

    return res.json({ success: true, data: { stats } });
  } catch (error: any) {
    console.error('Get project stats error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get project statistics' });
  }
});

/**
 * GET /api/projects/:id
 * Get project by ID
 */
router.get('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!GOV_ROLES.has(req.user!.role) && req.user!.role !== 'CONTRACTOR') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const project = await projectRepository.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const scope = await scopeContractorFilter(req);
    if (scope && project.contractorId !== scope) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this project' });
    }

    const contractor = project.contractorId
      ? await contractorRepository.findById(project.contractorId)
      : null;
    const milestones = await projectRepository.getMilestones(id);
    const recentSubmissions = await projectRepository.getRecentSubmissions(id);

    return res.json({
      success: true,
      data: {
        project: {
          ...project,
          contractor,
          milestones,
          recentSubmissions,
        },
      },
    });
  } catch (error: any) {
    console.error('Get project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get project',
    });
  }
});

/**
 * POST /api/projects
 * Create new project (Admin only)
 */
router.post('/', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const payload: CreateProjectInput = {
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      lga: Array.isArray(req.body.lga) ? req.body.lga : [req.body.lga],
      priority: req.body.priority || 'MEDIUM',
      budget: parseFloat(req.body.budget),
      allocatedBudget: req.body.allocatedBudget ? parseFloat(req.body.allocatedBudget) : undefined,
      fundingSource: req.body.fundingSource,
      startDate: req.body.startDate ? new Date(req.body.startDate) : null,
      expectedEndDate: req.body.expectedEndDate ? new Date(req.body.expectedEndDate) : null,
      beneficiaries: req.body.beneficiaries,
      contractorId: req.body.contractorId || null,
      projectManagerId: req.body.projectManagerId || null,
      location: req.body.location || null,
      isPublic: false, // publication is always an explicit follow-up action
    };

    if (!payload.name || !payload.category || !payload.lga || !payload.budget || !payload.fundingSource || !payload.startDate || !payload.expectedEndDate) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: name, category, lga, budget, fundingSource, startDate, expectedEndDate',
      });
    }

    if (!Object.values(ProjectCategory).includes(payload.category as ProjectCategory)) {
      return res.status(400).json({
        success: false,
        message: `Invalid category — must be one of: ${Object.values(ProjectCategory).join(', ')}`,
      });
    }
    if (!Object.values(Priority).includes(payload.priority as Priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority — must be one of: ${Object.values(Priority).join(', ')}`,
      });
    }
    if (!Number.isFinite(payload.budget)) {
      return res.status(400).json({ success: false, message: 'budget must be a number' });
    }

    const project = await projectRepository.create(payload);
    await audit(auditFromReq(req, 'project.create', 'project', project.id, { name: project.name, budget: project.budget }));

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: { project },
    });
  } catch (error: any) {
    console.error('Create project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create project',
    });
  }
});

/**
 * PUT /api/projects/:id
 * Update project
 */
router.put('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const project = await projectRepository.findById(id);

    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const isAdmin = req.user.role === 'GOVERNMENT_ADMIN';
    const isProjectManager = project.projectManagerId === req.user.userId;
    // A contractor may only touch a project actually assigned to their company
    const contractor = req.user.role === 'CONTRACTOR'
      ? await contractorRepository.findByUserId(req.user.userId)
      : null;
    const isAssignedContractor = !!contractor && contractor.id === project.contractorId;

    if (!isAdmin && !isProjectManager && !isAssignedContractor) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this project' });
    }

    // Per-role field whitelists — publication, financial state, and progress
    // are only changeable via their dedicated endpoints/cascade.
    const ADMIN_FIELDS = new Set([
      'name', 'description', 'category', 'lga', 'priority', 'status',
      'budget', 'allocatedBudget', 'spentBudget', 'fundingSource',
      'startDate', 'expectedEndDate', 'actualEndDate', 'beneficiaries',
      'contractorId', 'projectManagerId', 'location',
      'weatherDelay', 'safetyIncidents', 'qualityScore', 'safetyCompliance',
    ]);
    const PM_FIELDS = new Set([
      'name', 'description', 'category', 'lga', 'priority', 'status',
      'startDate', 'expectedEndDate', 'actualEndDate', 'beneficiaries',
      'location', 'weatherDelay', 'safetyIncidents', 'qualityScore', 'safetyCompliance',
    ]);
    const CONTRACTOR_FIELDS = new Set(['weatherDelay', 'safetyIncidents']);
    const allowed = isAdmin ? ADMIN_FIELDS : isProjectManager ? PM_FIELDS : CONTRACTOR_FIELDS;

    const ENUM_FIELDS: Record<string, readonly string[]> = {
      status: Object.values(ProjectStatus),
      category: Object.values(ProjectCategory),
      priority: Object.values(Priority),
    };
    const updates: UpdateProjectInput = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (value === undefined) continue;
      if (!allowed.has(key)) continue;
      if (key in ENUM_FIELDS && !(ENUM_FIELDS[key] as string[]).includes(value as string)) {
        return res.status(400).json({ success: false, message: `Invalid ${key} — must be one of: ${ENUM_FIELDS[key].join(', ')}` });
      }
      if (key === 'lga') {
        updates.lga = Array.isArray(value) ? value : [value];
      } else if (key === 'startDate' || key === 'expectedEndDate' || key === 'actualEndDate') {
        (updates as any)[key] = value ? new Date(value as string) : null;
      } else {
        (updates as any)[key] = value;
      }
    }

    const updatedProject = await projectRepository.update(id, updates);
    await audit(auditFromReq(req, 'project.update', 'project', id, { fields: Object.keys(updates) }));

    return res.json({
      success: true,
      message: 'Project updated successfully',
      data: { project: updatedProject },
    });
  } catch (error: any) {
    console.error('Update project error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update project' });
  }
});

const canManageProject = (req: Request, project: { projectManagerId?: string | null }): boolean => {
  if (!req.user) return false;
  return req.user.role === 'GOVERNMENT_ADMIN' || project.projectManagerId === req.user.userId;
};

/**
 * POST /api/projects/:id/publish — expose the project on the public portal.
 * POST /api/projects/:id/unpublish — withdraw it.
 * Government roles only; publication is an explicit permissioned action.
 */
const setPublication = (publish: boolean) =>
  async (req: Request, res: Response) => {
    try {
      const project = await projectRepository.findById(req.params.id);
      if (!project) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      const result = await query(
        publish
          ? `UPDATE projects SET is_public = TRUE, published_at = NOW(), published_by = $2, updated_at = NOW()
             WHERE id = $1 RETURNING *`
          : `UPDATE projects SET is_public = FALSE, updated_at = NOW()
             WHERE id = $1 RETURNING *`,
        publish ? [req.params.id, req.user!.userId] : [req.params.id]
      );
      await audit(auditFromReq(req, publish ? 'project.publish' : 'project.unpublish', 'project', req.params.id, { name: project.name }));
      return res.json({
        success: true,
        message: publish ? 'Project published to the public portal' : 'Project removed from the public portal',
        data: { project: rowToCamelCase(result.rows[0]) },
      });
    } catch (error: any) {
      console.error('Set publication error:', error);
      return res.status(500).json({ success: false, message: 'Failed to update publication' });
    }
  };

router.post('/:id/publish', verifyToken, requireRoles('GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER'), setPublication(true));
router.post('/:id/unpublish', verifyToken, requireRoles('GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER'), setPublication(false));

/**
 * POST /api/projects/:id/financial-status
 * Move the project along the financial reconciliation axis —
 * independent of physical progress and publication.
 * Body: { status: 'UNRECONCILED' | 'RECONCILED' | 'AUDITED' }
 */
const FINANCIAL_STATUSES = ['UNRECONCILED', 'RECONCILED', 'AUDITED'] as const;

router.post('/:id/financial-status', verifyToken, requireRoles('GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!FINANCIAL_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: `status must be one of: ${FINANCIAL_STATUSES.join(', ')}` });
    }
    const project = await projectRepository.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    const result = await query(
      'UPDATE projects SET financial_status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id, status]
    );
    await audit(auditFromReq(req, 'project.financial_status', 'project', req.params.id, { name: project.name, from: project.financialStatus, to: status }));
    return res.json({
      success: true,
      message: `Financial status set to ${status.toLowerCase()}`,
      data: { project: rowToCamelCase(result.rows[0]) },
    });
  } catch (error: any) {
    console.error('Set financial status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update financial status' });
  }
});

/**
 * POST /api/projects/:id/milestones
 * Add a milestone (Admin or assigned project manager)
 */
router.post('/:id/milestones', verifyToken, async (req: Request, res: Response) => {
  try {
    const project = await projectRepository.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (!canManageProject(req, project)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this project' });
    }

    const { name, description, dueDate, budget, orderIndex } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, message: 'Milestone name is required' });
    }

    const milestone = await projectRepository.createMilestone(project.id, {
      name,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
      budget: budget !== undefined && budget !== null ? Number(budget) : null,
      orderIndex: orderIndex !== undefined ? Number(orderIndex) : undefined,
    });
    await projectRepository.recomputeProjectProgress(project.id);
    await audit(auditFromReq(req, 'milestone.create', 'project', project.id, { milestoneId: milestone.id, name: milestone.name }));

    return res.status(201).json({ success: true, data: { milestone } });
  } catch (error: any) {
    console.error('Create milestone error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create milestone' });
  }
});

/**
 * PUT /api/projects/:id/milestones/:milestoneId
 * Update a milestone (Admin or assigned project manager)
 */
router.put('/:id/milestones/:milestoneId', verifyToken, async (req: Request, res: Response) => {
  try {
    const project = await projectRepository.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (!canManageProject(req, project)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this project' });
    }

    const milestone = await projectRepository.findMilestoneById(req.params.milestoneId);
    if (!milestone || milestone.projectId !== project.id) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (value === undefined) continue;
      if (key === 'dueDate' || key === 'completedDate') {
        updates[key] = value ? new Date(value as string) : null;
      } else if (key === 'progress' || key === 'budget' || key === 'orderIndex') {
        const n = Number(value);
        updates[key] = Number.isNaN(n) ? undefined : n;
      } else if (key === 'status') {
        if (!(Object.values(MilestoneStatus) as string[]).includes(value as string)) {
          return res.status(400).json({ success: false, message: `Invalid status — must be one of: ${Object.values(MilestoneStatus).join(', ')}` });
        }
        updates[key] = value;
      } else if (['name', 'description'].includes(key)) {
        updates[key] = value;
      }
    }

    const updated = await projectRepository.updateMilestone(milestone.id, updates as any);
    await projectRepository.recomputeProjectProgress(project.id);
    await audit(auditFromReq(req, 'milestone.update', 'project', project.id, { milestoneId: milestone.id, fields: Object.keys(updates) }));

    return res.json({ success: true, data: { milestone: updated } });
  } catch (error: any) {
    console.error('Update milestone error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update milestone' });
  }
});

/**
 * DELETE /api/projects/:id/milestones/:milestoneId
 * Delete a milestone (Admin or assigned project manager)
 */
router.delete('/:id/milestones/:milestoneId', verifyToken, async (req: Request, res: Response) => {
  try {
    const project = await projectRepository.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    if (!canManageProject(req, project)) {
      return res.status(403).json({ success: false, message: 'Not authorized to manage this project' });
    }

    const milestone = await projectRepository.findMilestoneById(req.params.milestoneId);
    if (!milestone || milestone.projectId !== project.id) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }

    await projectRepository.deleteMilestone(milestone.id);
    await projectRepository.recomputeProjectProgress(project.id);
    await audit(auditFromReq(req, 'milestone.delete', 'project', project.id, { milestoneId: milestone.id, name: milestone.name }));

    return res.json({ success: true, message: 'Milestone deleted' });
  } catch (error: any) {
    console.error('Delete milestone error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete milestone' });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete project (Admin only)
 */
router.delete('/:id', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const project = await projectRepository.findById(id);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    await projectRepository.delete(id);
    await audit(auditFromReq(req, 'project.delete', 'project', id, { name: project.name }));

    return res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Delete project error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete project' });
  }
});

export default router;
