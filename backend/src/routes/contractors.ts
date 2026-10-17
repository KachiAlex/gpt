import { Router, Request, Response } from 'express';
import { authenticate, requireRoles } from '../middleware/auth';
import { contractorRepository } from '../repositories/contractorRepository';
import { userRepository } from '../repositories/userRepository';
import {
  ContractorStats,
  CreateContractorInput,
  ListContractorsParams,
  UpdateContractorInput,
} from '../types/models';
import { query, rowToCamelCase } from '../config/database';

const router = Router();

const verifyToken = authenticate;
const requireAdmin = requireRoles('GOVERNMENT_ADMIN');

const parseBooleanQuery = (value: any): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return undefined;
};

const normalizeSpecialization = (value: any): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0);
  }
  if (typeof value === 'string') {
    return [value.trim()].filter((item) => item.length > 0);
  }
  return [];
};

const mapProjectRow = (row: any) => rowToCamelCase(row);
const mapSubmissionRow = (row: any) => rowToCamelCase(row);

/**
 * GET /api/contractors
 * Get contractors with filtering + pagination
 */
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 100);

    const filters: ListContractorsParams = {
      verified: parseBooleanQuery(req.query.verified),
      certified: parseBooleanQuery(req.query.certified),
      specialization: typeof req.query.specialization === 'string' ? req.query.specialization : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page,
      limit,
    };

    const { contractors, total } = await contractorRepository.listWithFilters(filters);

    return res.json({
      success: true,
      data: {
        contractors,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('Get contractors error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get contractors',
    });
  }
});

/**
 * GET /api/contractors/:id
 * Get contractor by ID
 */
router.get('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const contractor = await contractorRepository.getWithUser(id);
    if (!contractor) {
      return res.status(404).json({
        success: false,
        message: 'Contractor not found',
      });
    }

    const projectsResult = await query(
      `SELECT id, name, status, budget, spent_budget, progress, updated_at
       FROM projects
       WHERE contractor_id = $1
       ORDER BY created_at DESC`,
      [id]
    );
    const projects = projectsResult.rows.map(mapProjectRow);

    const submissionsResult = await query(
      `SELECT id, project_id, title, status, submitted_at
       FROM submissions
       WHERE contractor_id = $1
       ORDER BY submitted_at DESC
       LIMIT 10`,
      [id]
    );
    const recentSubmissions = submissionsResult.rows.map(mapSubmissionRow);

    return res.json({
      success: true,
      data: {
        contractor: {
          ...contractor,
          projects,
          recentSubmissions,
        },
      },
    });
  } catch (error: any) {
    console.error('Get contractor error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get contractor',
    });
  }
});

/**
 * POST /api/contractors
 * Create new contractor (Admin only)
 */
router.post('/', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      userId,
      companyName,
      registrationNo,
      contactPerson,
      companyEmail,
      companyPhone,
      companyAddress,
      yearsExperience,
      specialization,
    } = req.body;

    if (!userId || !companyName || !registrationNo || !contactPerson || !companyEmail || !companyPhone || !companyAddress) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: userId, companyName, registrationNo, contactPerson, companyEmail, companyPhone, companyAddress',
      });
    }

    const user = await userRepository.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.role !== 'CONTRACTOR') {
      return res.status(400).json({
        success: false,
        message: 'User must have contractor role',
      });
    }

    const existingForUser = await contractorRepository.findByUserId(userId);
    if (existingForUser) {
      return res.status(409).json({
        success: false,
        message: 'Contractor profile already exists for this user',
      });
    }

    const existingReg = await contractorRepository.findByRegistrationNo(registrationNo);
    if (existingReg) {
      return res.status(409).json({
        success: false,
        message: 'Registration number already exists',
      });
    }

    const contractorData: CreateContractorInput = {
      userId,
      companyName,
      registrationNo,
      contactPerson,
      companyEmail,
      companyPhone,
      companyAddress,
      yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : undefined,
      specialization: normalizeSpecialization(specialization),
    };

    const contractor = await contractorRepository.create(contractorData);

    return res.status(201).json({
      success: true,
      message: 'Contractor profile created successfully',
      data: { contractor },
    });
  } catch (error: any) {
    console.error('Create contractor error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create contractor profile',
    });
  }
});

/**
 * PUT /api/contractors/:id
 * Update contractor profile
 */
router.put('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const contractor = await contractorRepository.findById(id);

    if (!contractor) {
      return res.status(404).json({
        success: false,
        message: 'Contractor not found'
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    const isAdmin = req.user.role === 'GOVERNMENT_ADMIN';
    const isContractorOwner = contractor.userId === req.user.userId;

    if (!isAdmin && !isContractorOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this contractor profile'
      });
    }

    const updateData: Record<string, any> = { ...req.body };

    // Remove fields that shouldn't be updated
    delete updateData.id;
    delete updateData.userId;
    delete updateData.createdAt;

    // Build update object
    const updates: UpdateContractorInput = {};
    for (const [key, value] of Object.entries(updateData)) {
      if (value === undefined || value === null) continue;
      if (key === 'specialization') {
        updates.specialization = normalizeSpecialization(value);
      } else if (key in contractor) {
        (updates as any)[key] = value;
      }
    }

    const updatedContractor = await contractorRepository.update(id, updates);

    return res.json({
      success: true,
      message: 'Contractor profile updated successfully',
      data: { contractor: updatedContractor },
    });

  } catch (error: any) {
    console.error('Update contractor error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update contractor profile'
    });
  }
});

/**
 * GET /api/contractors/:id/stats
 * Get contractor statistics
 */
router.get('/:id/stats', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const contractor = await contractorRepository.findById(id);
    if (!contractor) {
      return res.status(404).json({
        success: false,
        message: 'Contractor not found',
      });
    }

    const stats: ContractorStats = await contractorRepository.getStats(id);

    return res.json({
      success: true,
      data: { stats },
    });
  } catch (error: any) {
    console.error('Get contractor stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get contractor statistics',
    });
  }
});

/**
 * GET /api/contractors/:id/performance
 * Contractor performance summary (rating + project/submission stats)
 */
router.get('/:id/performance', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const contractor = await contractorRepository.findById(id);
    if (!contractor) {
      return res.status(404).json({
        success: false,
        message: 'Contractor not found',
      });
    }

    const stats = await contractorRepository.getStats(id);

    const approvalRate = stats.totalSubmissions > 0
      ? Math.round((stats.approvedSubmissions / stats.totalSubmissions) * 100)
      : 0;
    const completionRate = stats.totalProjects > 0
      ? Math.round((stats.completedProjects / stats.totalProjects) * 100)
      : 0;

    return res.json({
      success: true,
      data: {
        performance: {
          ...stats,
          rating: Number(contractor.rating ?? 0),
          isVerified: contractor.isVerified,
          isCertified: contractor.isCertified,
          approvalRate,
          completionRate,
        },
      },
    });
  } catch (error: any) {
    console.error('Get contractor performance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get contractor performance',
    });
  }
});

/**
 * POST /api/contractors/assign-project
 * Assign project to contractor (Admin only)
 */
router.post('/assign-project', verifyToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { contractorId, projectId } = req.body;

    if (!contractorId || !projectId) {
      return res.status(400).json({
        success: false,
        message: 'Contractor ID and Project ID are required',
      });
    }

    const contractor = await contractorRepository.findById(contractorId);
    if (!contractor) {
      return res.status(404).json({
        success: false,
        message: 'Contractor not found',
      });
    }

    const projectResult = await query('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    await query('UPDATE projects SET contractor_id = $1, updated_at = NOW() WHERE id = $2', [contractorId, projectId]);

    return res.json({
      success: true,
      message: 'Project assigned to contractor successfully',
    });
  } catch (error: any) {
    console.error('Assign project error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign project to contractor',
    });
  }
});

export default router;
