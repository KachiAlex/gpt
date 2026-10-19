import { Router, Request, Response } from 'express';
import { ProjectStatus, ProjectCategory } from '../types/domain';
import { query, rowToCamelCase } from '../config/database';
import { projectRepository } from '../repositories/projectRepository';

const router = Router();

interface BasePublicProject {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  lga: string[];
  priority: string;
  status: string;
  progress: number;
  budget: number;
  allocatedBudget: number;
  spentBudget: number;
  fundingSource?: string | null;
  startDate?: Date | null;
  expectedEndDate?: Date | null;
  actualEndDate?: Date | null;
  beneficiaries?: string | null;
  contractorId?: string | null;
  projectManagerId?: string | null;
  location?: any;
  isPublic: boolean;
  qualityScore: number;
  safetyCompliance?: string | null;
  weatherDelay: number;
  safetyIncidents: number;
  createdAt: Date;
  updatedAt: Date;
}

interface PublicProject extends BasePublicProject {
  contractor: {
    id: string;
    companyName: string | null;
    rating: number | null;
  } | null;
}

interface PublicProjectFilters {
  category?: string;
  status?: string;
  lga?: string;
  search?: string;
}

const selectPublicProjectFields = `
  p.*,
  cp.id AS contractor_id_ref,
  cp.company_name AS contractor_name,
  cp.rating AS contractor_rating
`;

const toOptionalString = (value: any): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const mapProjectRow = (row: any): BasePublicProject => {
  const project = rowToCamelCase(row);
  return {
    id: project.id,
    name: project.name,
    description: project.description ?? null,
    category: project.category,
    lga: Array.isArray(project.lga) ? project.lga : project.lga ? [project.lga] : [],
    priority: project.priority,
    status: project.status,
    progress: Number(project.progress ?? 0),
    budget: Number(project.budget ?? 0),
    allocatedBudget: Number(project.allocatedBudget ?? project.budget ?? 0),
    spentBudget: Number(project.spentBudget ?? 0),
    fundingSource: project.fundingSource ?? null,
    startDate: project.startDate ? new Date(project.startDate) : null,
    expectedEndDate: project.expectedEndDate ? new Date(project.expectedEndDate) : null,
    actualEndDate: project.actualEndDate ? new Date(project.actualEndDate) : null,
    beneficiaries: project.beneficiaries ?? null,
    contractorId: project.contractorId ?? null,
    projectManagerId: project.projectManagerId ?? null,
    location: project.location ?? null,
    isPublic: Boolean(project.isPublic),
    qualityScore: Number(project.qualityScore ?? 0),
    safetyCompliance: project.safetyCompliance ?? null,
    weatherDelay: Number(project.weatherDelay ?? 0),
    safetyIncidents: Number(project.safetyIncidents ?? 0),
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt),
  };
};

const mapPublicProject = (row: any): PublicProject => {
  const project = mapProjectRow(row);
  const contractor = row.contractor_id_ref
    ? {
        id: row.contractor_id_ref,
        companyName: row.contractor_name ?? null,
        rating: row.contractor_rating !== undefined && row.contractor_rating !== null
          ? Number(row.contractor_rating)
          : null,
      }
    : null;

  return {
    ...project,
    contractor,
  };
};

const buildPublicWhereClause = (filters: PublicProjectFilters) => {
  const conditions = ['p.is_public = TRUE'];
  const params: any[] = [];

  if (filters.status) {
    params.push(filters.status);
    conditions.push(`p.status = $${params.length}`);
  }

  if (filters.category) {
    params.push(filters.category);
    conditions.push(`p.category = $${params.length}`);
  }

  if (filters.lga) {
    params.push(filters.lga.toLowerCase());
    conditions.push(
      `EXISTS (SELECT 1 FROM unnest(p.lga) AS l WHERE LOWER(l) = $${params.length})`
    );
  }

  if (filters.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`;
    params.push(searchTerm);
    const idx = params.length;
    conditions.push(
      `(
        LOWER(p.name) LIKE $${idx}
        OR LOWER(COALESCE(p.description, '')) LIKE $${idx}
        OR EXISTS (SELECT 1 FROM unnest(p.lga) AS l WHERE LOWER(l) LIKE $${idx})
      )`
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { whereClause, params };
};

const fetchPublicProjects = async (
  filters: PublicProjectFilters,
  limit: number,
  offset: number
): Promise<{ projects: PublicProject[]; total: number }> => {
  const { whereClause, params } = buildPublicWhereClause(filters);

  const totalResult = await query(`SELECT COUNT(*) FROM projects p ${whereClause}`, params);
  const total = parseInt(totalResult.rows[0]?.count || '0', 10);

  const limitIdx = params.length + 1;
  const offsetIdx = params.length + 2;

  const result = await query(
    `SELECT ${selectPublicProjectFields}
     FROM projects p
     LEFT JOIN contractor_profiles cp ON p.contractor_id = cp.id
     ${whereClause}
     ORDER BY p.created_at DESC
     LIMIT $${limitIdx}
     OFFSET $${offsetIdx}`,
    [...params, limit, offset]
  );

  const projects = result.rows.map((row) => mapPublicProject(row));

  return { projects, total };
};

const fetchAllPublicProjects = async (): Promise<BasePublicProject[]> => {
  const result = await query('SELECT * FROM projects WHERE is_public = TRUE');
  return result.rows.map((row) => mapProjectRow(row));
};

/**
 * GET /api/public/projects
 * Get public projects (no authentication required)
 */
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 50);

    const filters: PublicProjectFilters = {
      category: toOptionalString(req.query.category),
      status: toOptionalString(req.query.status),
      lga: toOptionalString(req.query.lga),
      search: toOptionalString(req.query.search),
    };

    const offset = (page - 1) * limit;
    const { projects, total } = await fetchPublicProjects(filters, limit, offset);

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
    console.error('Get public projects error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get public projects'
    });
  }
});

/**
 * GET /api/public/projects/search
 * Search public projects (registered before /projects/:id so
 * "search" is not treated as a project ID)
 */
router.get('/projects/search', async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 50);

    const filters: PublicProjectFilters = {
      category: toOptionalString(req.query.category),
      status: toOptionalString(req.query.status),
      lga: toOptionalString(req.query.lga),
      search: q.trim(),
    };

    const { projects, total } = await fetchPublicProjects(filters, limit, 0);

    return res.json({
      success: true,
      data: {
        projects,
        query: q,
        total,
      },
    });
  } catch (error: any) {
    console.error('Search public projects error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search projects'
    });
  }
});

/**
 * GET /api/public/projects/:id
 * Get public project details
 */
router.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const project = await projectRepository.findById(id);

    if (!project || !project.isPublic) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const contractor = await projectRepository.getContractorSummary(project.contractorId || null);
    const milestones = await projectRepository.getMilestones(id);

    const publicMilestones = milestones.map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      description: milestone.description,
      dueDate: milestone.dueDate,
      completedDate: milestone.completedDate,
      status: milestone.status,
      progress: milestone.progress,
      budget: milestone.budget,
      order: (milestone as any).orderIndex ?? undefined,
    }));

    // Whitelist the public projection — never spread the full DbProject
    // (financialStatus, publishedBy, etc. are internal fields).
    const publicProject: BasePublicProject = {
      id: project.id,
      name: project.name,
      description: project.description ?? null,
      category: project.category,
      lga: Array.isArray(project.lga) ? project.lga : [],
      priority: project.priority,
      status: project.status,
      progress: Number(project.progress ?? 0),
      budget: Number(project.budget ?? 0),
      allocatedBudget: Number(project.allocatedBudget ?? project.budget ?? 0),
      spentBudget: Number(project.spentBudget ?? 0),
      fundingSource: project.fundingSource ?? null,
      startDate: project.startDate ?? null,
      expectedEndDate: project.expectedEndDate ?? null,
      actualEndDate: project.actualEndDate ?? null,
      beneficiaries: project.beneficiaries ?? null,
      contractorId: project.contractorId ?? null,
      projectManagerId: project.projectManagerId ?? null,
      location: project.location ?? null,
      isPublic: true,
      qualityScore: Number(project.qualityScore ?? 0),
      safetyCompliance: project.safetyCompliance ?? null,
      weatherDelay: Number(project.weatherDelay ?? 0),
      safetyIncidents: Number(project.safetyIncidents ?? 0),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };

    return res.json({
      success: true,
      data: {
        project: {
          ...publicProject,
          contractor,
          milestones: publicMilestones,
        },
      },
    });

  } catch (error: any) {
    console.error('Get public project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get project details'
    });
  }
});

/**
 * GET /api/public/stats
 * Get public statistics
 */
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const projects = await fetchAllPublicProjects();

    const stats = {
      totalProjects: projects.length,
      completedProjects: projects.filter((p) => p.status === ProjectStatus.COMPLETED).length,
      activeProjects: projects.filter((p) => p.status === ProjectStatus.IN_PROGRESS).length,
      totalBudget: projects.reduce((sum, p) => sum + Number(p.budget || 0), 0),
      averageProgress:
        projects.length > 0
          ? projects.reduce((sum, p) => sum + Number(p.progress || 0), 0) / projects.length
          : 0,
      byCategory: Object.values(ProjectCategory).reduce((acc, category) => {
        acc[category] = projects.filter((p) => p.category === category).length;
        return acc;
      }, {} as Record<string, number>),
    };

    return res.json({
      success: true,
      data: { stats },
    });

  } catch (error: any) {
    console.error('Get public stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get public statistics'
    });
  }
});

/**
 * GET /api/public/projects-by-category
 * Get projects grouped by category
 */
router.get('/projects-by-category', async (_req: Request, res: Response) => {
  try {
    const projects = await fetchAllPublicProjects();

    const projectsByCategory = Object.values(ProjectCategory)
      .map((category) => {
        const categoryProjects = projects.filter((p) => p.category === category);
        if (categoryProjects.length === 0) return null;

        return {
          category,
          count: categoryProjects.length,
          totalBudget: categoryProjects.reduce((sum, p) => sum + Number(p.budget || 0), 0),
          averageProgress:
            categoryProjects.length > 0
              ? categoryProjects.reduce((sum, p) => sum + Number(p.progress || 0), 0) /
                categoryProjects.length
              : 0,
          projects: categoryProjects.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            lga: p.lga,
            status: p.status,
            progress: p.progress,
            budget: p.budget,
            startDate: p.startDate,
            expectedEndDate: p.expectedEndDate,
          })),
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return res.json({
      success: true,
      data: { projectsByCategory },
    });

  } catch (error: any) {
    console.error('Get projects by category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get projects by category'
    });
  }
});

/**
 * GET /api/public/projects-by-lga
 * Get projects grouped by LGA
 */
router.get('/projects-by-lga', async (_req: Request, res: Response) => {
  try {
    const projects = await fetchAllPublicProjects();

    const grouped = projects.reduce<Record<string, any>>((acc, project) => {
      const lgas = Array.isArray(project.lga) ? project.lga : project.lga ? [project.lga] : [];

      lgas.forEach((lgaValue) => {
        const key = lgaValue || 'Unknown';
        if (!acc[key]) {
          acc[key] = {
            lga: key,
            count: 0,
            totalBudget: 0,
            completedCount: 0,
            activeCount: 0,
            projects: [],
          };
        }

        acc[key].count += 1;
        acc[key].totalBudget += Number(project.budget || 0);

        if (project.status === ProjectStatus.COMPLETED) {
          acc[key].completedCount += 1;
        } else if (project.status === ProjectStatus.IN_PROGRESS) {
          acc[key].activeCount += 1;
        }

        acc[key].projects.push({
          id: project.id,
          name: project.name,
          description: project.description,
          status: project.status,
          progress: project.progress,
          budget: project.budget,
          startDate: project.startDate,
          expectedEndDate: project.expectedEndDate,
        });
      });

      return acc;
    }, {});

    const projectsByLGA = Object.values(grouped)
      .map((entry: any) => ({
        ...entry,
        averageProgress:
          entry.projects.length > 0
            ? entry.projects.reduce((sum: number, p: any) => sum + Number(p.progress || 0), 0) /
              entry.projects.length
            : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return res.json({
      success: true,
      data: { projectsByLGA },
    });

  } catch (error: any) {
    console.error('Get projects by LGA error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get projects by LGA'
    });
  }
});

export default router;
