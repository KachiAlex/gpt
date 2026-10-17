import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { ProjectStatus, ProjectCategory, SubmissionStatus } from '../types/domain';
import { projectRepository } from '../repositories/projectRepository';
import { submissionRepository } from '../repositories/submissionRepository';
import { contractorRepository } from '../repositories/contractorRepository';
import { DbProject } from '../types/models';
import { query } from '../config/database';

const router = Router();

interface DashboardProject {
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
}

const mapDbProjectRow = (row: any): DashboardProject => ({
  id: row.id,
  name: row.name,
  description: row.description ?? null,
  category: row.category,
  lga: Array.isArray(row.lga) ? row.lga : row.lga ? [row.lga] : [],
  priority: row.priority,
  status: row.status,
  progress: Number(row.progress ?? 0),
  budget: Number(row.budget ?? 0),
  allocatedBudget: Number(row.allocated_budget ?? row.budget ?? 0),
  spentBudget: Number(row.spent_budget ?? 0),
  fundingSource: row.funding_source ?? null,
  startDate: row.start_date ? new Date(row.start_date) : null,
  expectedEndDate: row.expected_end_date ? new Date(row.expected_end_date) : null,
  actualEndDate: row.actual_end_date ? new Date(row.actual_end_date) : null,
  beneficiaries: row.beneficiaries ?? null,
  contractorId: row.contractor_id ?? null,
  projectManagerId: row.project_manager_id ?? null,
  location: row.location ?? null,
  isPublic: Boolean(row.is_public),
  qualityScore: Number(row.quality_score ?? 0),
  safetyCompliance: row.safety_compliance ?? null,
  weatherDelay: Number(row.weather_delay ?? 0),
  safetyIncidents: Number(row.safety_incidents ?? 0),
});

const fetchAllProjects = async (): Promise<DashboardProject[]> => {
  const projectsResult = await query('SELECT * FROM projects');
  return projectsResult.rows.map(mapDbProjectRow);
};

const verifyToken = authenticate;

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
router.get('/stats', verifyToken, async (_req, res) => {
  try {
    const projects = await fetchAllProjects();

    const submissionsResult = await query('SELECT status FROM submissions');
    const submissions = submissionsResult.rows as { status: SubmissionStatus }[];

    const contractorsResult = await query('SELECT is_verified, is_certified FROM contractor_profiles');
    const contractors = contractorsResult.rows as { is_verified: boolean; is_certified: boolean }[];

    // Calculate statistics
    const stats = {
      total: projects.length,
      byStatus: {
        NOT_STARTED: projects.filter(p => p.status === ProjectStatus.NOT_STARTED).length,
        IN_PROGRESS: projects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length,
        NEAR_COMPLETION: projects.filter(p => p.status === ProjectStatus.NEAR_COMPLETION).length,
        COMPLETED: projects.filter(p => p.status === ProjectStatus.COMPLETED).length,
        DELAYED: projects.filter(p => p.status === ProjectStatus.DELAYED).length,
        ON_HOLD: projects.filter(p => p.status === ProjectStatus.ON_HOLD).length,
        CANCELLED: projects.filter(p => p.status === ProjectStatus.CANCELLED).length,
      },
      totalBudget: projects.reduce((sum, p) => sum + (p.allocatedBudget || p.budget), 0),
      averageProgress: projects.length > 0 ? projects.reduce((sum, p) => sum + p.progress, 0) / projects.length : 0,
      // Additional stats for other dashboard components
      projects: {
        total: projects.length,
        active: projects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length,
        completed: projects.filter(p => p.status === ProjectStatus.COMPLETED).length,
        delayed: projects.filter(p => p.status === ProjectStatus.DELAYED).length,
        notStarted: projects.filter(p => p.status === ProjectStatus.NOT_STARTED).length
      },
      submissions: {
        total: submissions.length,
        pending: submissions.filter(s => s.status === SubmissionStatus.PENDING).length,
        underReview: submissions.filter(s => s.status === SubmissionStatus.UNDER_REVIEW).length,
        approved: submissions.filter(s => s.status === SubmissionStatus.APPROVED).length,
        rejected: submissions.filter(s => s.status === SubmissionStatus.REJECTED).length
      },
      contractors: {
        total: contractors.length,
        verified: contractors.filter(c => c.is_verified).length,
        certified: contractors.filter(c => c.is_certified).length
      },
      budget: {
        totalAllocated: projects.reduce((sum, p) => sum + (p.allocatedBudget || p.budget), 0),
        totalSpent: projects.reduce((sum, p) => sum + p.spentBudget, 0),
        remaining: projects.reduce((sum, p) => sum + (p.allocatedBudget || p.budget) - p.spentBudget, 0)
      }
    };

    return res.json({
      success: true,
      data: { stats }
    });

  } catch (error: any) {
    console.error('Get dashboard stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get dashboard statistics'
    });
  }
});

/**
 * GET /api/dashboard/project-status-chart
 * Get project status chart data
 */
router.get('/project-status-chart', verifyToken, async (req, res) => {
  try {
    const { type = 'bar' } = req.query;

    const projects = await fetchAllProjects();

    const statusData = {
      [ProjectStatus.NOT_STARTED]: projects.filter(p => p.status === ProjectStatus.NOT_STARTED).length,
      [ProjectStatus.IN_PROGRESS]: projects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length,
      [ProjectStatus.NEAR_COMPLETION]: projects.filter(p => p.status === ProjectStatus.NEAR_COMPLETION).length,
      [ProjectStatus.COMPLETED]: projects.filter(p => p.status === ProjectStatus.COMPLETED).length,
      [ProjectStatus.DELAYED]: projects.filter(p => p.status === ProjectStatus.DELAYED).length,
      [ProjectStatus.ON_HOLD]: projects.filter(p => p.status === ProjectStatus.ON_HOLD).length,
      [ProjectStatus.CANCELLED]: projects.filter(p => p.status === ProjectStatus.CANCELLED).length,
    };

    const categoryData = {
      [ProjectCategory.TRANSPORTATION]: projects.filter(p => p.category === ProjectCategory.TRANSPORTATION).length,
      [ProjectCategory.HEALTHCARE]: projects.filter(p => p.category === ProjectCategory.HEALTHCARE).length,
      [ProjectCategory.EDUCATION]: projects.filter(p => p.category === ProjectCategory.EDUCATION).length,
      [ProjectCategory.WATER_SANITATION]: projects.filter(p => p.category === ProjectCategory.WATER_SANITATION).length,
      [ProjectCategory.HOUSING]: projects.filter(p => p.category === ProjectCategory.HOUSING).length,
      [ProjectCategory.AGRICULTURE]: projects.filter(p => p.category === ProjectCategory.AGRICULTURE).length,
      [ProjectCategory.ENERGY]: projects.filter(p => p.category === ProjectCategory.ENERGY).length,
      [ProjectCategory.ICT]: projects.filter(p => p.category === ProjectCategory.ICT).length,
      [ProjectCategory.TOURISM]: projects.filter(p => p.category === ProjectCategory.TOURISM).length,
      [ProjectCategory.ENVIRONMENT]: projects.filter(p => p.category === ProjectCategory.ENVIRONMENT).length,
    };

    return res.json({
      success: true,
      data: {
        type,
        statusData,
        categoryData
      }
    });

  } catch (error: any) {
    console.error('Get project status chart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get project status chart data'
    });
  }
});

/**
 * GET /api/dashboard/budget-analysis
 * Get budget analysis data
 */
router.get('/budget-analysis', verifyToken, async (_req, res) => {
  try {
    const projects = await fetchAllProjects();

    const budgetAnalysis = {
      totalBudget: projects.reduce((sum, p) => sum + p.budget, 0),
      allocatedBudget: projects.reduce((sum, p) => sum + (p.allocatedBudget || p.budget), 0),
      spentBudget: projects.reduce((sum, p) => sum + p.spentBudget, 0),
      remainingBudget: projects.reduce((sum, p) => sum + (p.allocatedBudget || p.budget) - p.spentBudget, 0),
      byCategory: Object.values(ProjectCategory).map(category => {
        const categoryProjects = projects.filter(p => p.category === category);
        return {
          category,
          totalBudget: categoryProjects.reduce((sum, p) => sum + p.budget, 0),
          spentBudget: categoryProjects.reduce((sum, p) => sum + p.spentBudget, 0),
          projectCount: categoryProjects.length
        };
      }),
      byStatus: Object.values(ProjectStatus).map(status => {
        const statusProjects = projects.filter(p => p.status === status);
        return {
          status,
          totalBudget: statusProjects.reduce((sum, p) => sum + p.budget, 0),
          spentBudget: statusProjects.reduce((sum, p) => sum + p.spentBudget, 0),
          projectCount: statusProjects.length
        };
      })
    };

    return res.json({
      success: true,
      data: { budgetAnalysis }
    });

  } catch (error: any) {
    console.error('Get budget analysis error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get budget analysis data'
    });
  }
});

/**
 * GET /api/dashboard/lga-performance
 * Get LGA performance data
 */
router.get('/lga-performance', verifyToken, async (_req, res) => {
  try {
    const projects = await fetchAllProjects();

    // Group projects by LGA (handle both string and array LGAs)
    const lgaData = projects.reduce((acc, project) => {
      const lgas = Array.isArray(project.lga) ? project.lga : [project.lga];
      
      lgas.forEach(lga => {
        if (!acc[lga]) {
          acc[lga] = {
            lga,
            totalProjects: 0,
            completedProjects: 0,
            activeProjects: 0,
            totalBudget: 0,
            spentBudget: 0,
            averageProgress: 0
          };
        }
        
        acc[lga].totalProjects++;
        acc[lga].totalBudget += project.budget;
        acc[lga].spentBudget += project.spentBudget;
        
        if (project.status === ProjectStatus.COMPLETED) {
          acc[lga].completedProjects++;
        } else if (project.status === ProjectStatus.IN_PROGRESS) {
          acc[lga].activeProjects++;
        }
      });
      
      return acc;
    }, {} as any);

    // Calculate average progress for each LGA
    Object.keys(lgaData).forEach(lga => {
      const lgaProjects = projects.filter(p => {
        if (Array.isArray(p.lga)) {
          return p.lga.includes(lga);
        }
        return p.lga === lga;
      });
      lgaData[lga].averageProgress = lgaProjects.length > 0 
        ? lgaProjects.reduce((sum, p) => sum + p.progress, 0) / lgaProjects.length 
        : 0;
    });

    const lgaPerformance = Object.values(lgaData).sort((a: any, b: any) => b.completedProjects - a.completedProjects);

    return res.json({
      success: true,
      data: { lgaPerformance }
    });

  } catch (error: any) {
    console.error('Get LGA performance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get LGA performance data'
    });
  }
});

/**
 * GET /api/dashboard/recent-activity
 * Get recent activity feed
 */
router.get('/recent-activity', verifyToken, async (req: Request, res: Response) => {
  try {
    const { limit = 20 } = req.query;
    const limitNum = parseInt(limit as string);

    const normalizedLimit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, 100) : 20;

    const [recentSubmissions, recentProjects] = await Promise.all([
      submissionRepository.listRecentWithRelations(normalizedLimit),
      projectRepository.listRecentUpdates(normalizedLimit),
    ]);

    type Activity = {
      id: string;
      type: 'submission' | 'project';
      title: string;
      description: string;
      project: { id: string; name: string } | null;
      timestamp: Date | string;
      status: string;
    };

    // Add submission activities
    const contractorIds = Array.from(
      new Set(
        recentSubmissions
          .map((submission) => submission.contractor?.id)
          .filter((id): id is string => Boolean(id))
      )
    );

    type ContractorSummary = { id: string; companyName: string | null };
    const contractorSummaries: ContractorSummary[] = (
      await Promise.all(
        contractorIds.map(async (id) => {
          const contractor = await contractorRepository.findById(id);
          if (!contractor) return null;
          return { id: contractor.id, companyName: contractor.companyName ?? null } as ContractorSummary;
        })
      )
    ).filter((c): c is ContractorSummary => Boolean(c));

    const contractorMap = contractorSummaries.reduce<Record<string, ContractorSummary>>(
      (acc, contractor) => {
        acc[contractor.id] = contractor;
        return acc;
      },
      {}
    );

    const submissionsActivities: Activity[] = recentSubmissions.map((submission) => {
      const contractor = submission.contractor?.id ? contractorMap[submission.contractor.id] : null;
      return {
        id: `submission-${submission.id}`,
        type: 'submission',
        title: `New ${submission.type.toLowerCase()} submission`,
        description: `${contractor?.companyName || 'Contractor'} submitted: ${submission.title}`,
        project: submission.project ? { id: submission.project.id, name: submission.project.name || '' } : null,
        timestamp: submission.submittedAt,
        status: submission.status,
      };
    });

    // Add project activities
    const projectActivities: Activity[] = recentProjects.map((project: DbProject) => ({
      id: `project-${project.id}`,
      type: 'project',
      title: 'Project updated',
      description: `${project.name} - Status: ${project.status}`,
      project: { id: project.id, name: project.name },
      timestamp: project.updatedAt,
      status: project.status,
    }));

    // Sort by timestamp and limit
    const activities: Activity[] = [...submissionsActivities, ...projectActivities];
    const toMs = (value: Date | string): number =>
      value instanceof Date ? value.getTime() : new Date(value).getTime();
    activities.sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp));
    const recentActivities = activities.slice(0, normalizedLimit);

    return res.json({
      success: true,
      data: { activities: recentActivities }
    });

  } catch (error: any) {
    console.error('Get recent activity error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recent activity'
    });
  }
});

export default router;
