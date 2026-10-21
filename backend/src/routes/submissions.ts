import { Router, Request, Response } from 'express';
import { authenticate, requireRoles } from '../middleware/auth';
import {
  ListSubmissionsParams,
  CreateSubmissionInput,
  UpdateSubmissionInput,
} from '../types/models';
import { NotificationType, SubmissionStatus, SubmissionType, Priority } from '../types/domain';
import { submissionRepository } from '../repositories/submissionRepository';
import { query } from '../config/database';
import { contractorRepository } from '../repositories/contractorRepository';
import { projectRepository } from '../repositories/projectRepository';
import { notificationRepository } from '../repositories/notificationRepository';
import { audit, auditFromReq } from '../services/auditService';

const router = Router();

const verifyToken = authenticate;
const requireMEOfficer = requireRoles('ME_OFFICER', 'GOVERNMENT_ADMIN');
const GOV_ROLES = new Set(['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']);

// Read scoping: contractors only ever see their own submissions; PUBLIC
// accounts get nothing internal (the public portal is their interface).
const scopeContractorId = async (req: Request): Promise<string | null> => {
  if (req.user!.role !== 'CONTRACTOR') return null;
  const contractor = await contractorRepository.findByUserId(req.user!.userId);
  return contractor ? contractor.id : 'no-match';
};

/**
 * GET /api/submissions
 * Get all submissions with filtering
 */
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 100);

    if (!GOV_ROLES.has(req.user!.role) && req.user!.role !== 'CONTRACTOR') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const ENUM_FILTERS: Record<string, readonly string[]> = {
      status: Object.values(SubmissionStatus),
      priority: Object.values(Priority),
    };
    for (const [key, valid] of Object.entries(ENUM_FILTERS)) {
      const v = req.query[key];
      if (v !== undefined && !(valid as string[]).includes(v as string)) {
        return res.status(400).json({ success: false, message: `Invalid ${key} filter — must be one of: ${valid.join(', ')}` });
      }
    }

    const filters: ListSubmissionsParams = {
      projectId: typeof req.query.projectId === 'string' ? req.query.projectId : undefined,
      contractorId: typeof req.query.contractorId === 'string' ? req.query.contractorId : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      priority: typeof req.query.priority === 'string' ? req.query.priority : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page,
      limit,
    };

    const scope = await scopeContractorId(req);
    if (scope) filters.contractorId = scope;

    const { submissions, total } = await submissionRepository.listWithFilters(filters);

    return res.json({
      success: true,
      data: {
        submissions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error: any) {
    console.error('Get submissions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get submissions',
    });
  }
});

/**
 * GET /api/submissions/stats
 * Submission statistics (registered before /:id so "stats" isn't treated as an ID)
 */
router.get('/stats', verifyToken, requireMEOfficer, async (_req: Request, res: Response) => {
  try {
    const stats = await submissionRepository.getOverviewStats();
    return res.json({
      success: true,
      data: { stats },
    });
  } catch (error: any) {
    console.error('Get submission stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get submission statistics',
    });
  }
});

/**
 * GET /api/submissions/:id
 * Get submission by ID
 */
router.get('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!GOV_ROLES.has(req.user!.role) && req.user!.role !== 'CONTRACTOR') {
      return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }

    const submission = await submissionRepository.findByIdWithDetails(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    const scope = await scopeContractorId(req);
    if (scope && submission.submission.contractorId !== scope) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this submission' });
    }

    return res.json({
      success: true,
      data: { submission },
    });
  } catch (error: any) {
    console.error('Get submission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get submission',
    });
  }
});

/**
 * POST /api/submissions
 * Create new submission (Contractor only)
 */
router.post('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      milestoneId,
      type,
      title,
      description,
      progress,
      estimatedValue,
      priority = 'MEDIUM',
      qualityScore,
      safetyCompliance,
      weatherImpact,
      dueDate,
    } = req.body;

    if (!projectId || !type || !title || !description) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: projectId, type, title, description',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (req.user.role !== 'CONTRACTOR') {
      return res.status(403).json({
        success: false,
        message: 'Only contractors can create submissions',
      });
    }

    const contractor = await contractorRepository.findByUserId(req.user.userId);
    if (!contractor) {
      return res.status(404).json({
        success: false,
        message: 'Contractor profile not found',
      });
    }

    const project = await projectRepository.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    if (project.contractorId !== contractor.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to submit for this project',
      });
    }

    if (!(Object.values(SubmissionType) as string[]).includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type — must be one of: ${Object.values(SubmissionType).join(', ')}`,
      });
    }
    if (!(Object.values(Priority) as string[]).includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority — must be one of: ${Object.values(Priority).join(', ')}`,
      });
    }

    // A submission may only reference a milestone that belongs to its project
    if (milestoneId) {
      const ms = await query('SELECT 1 FROM milestones WHERE id = $1 AND project_id = $2', [milestoneId, projectId]);
      if (ms.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'milestoneId does not belong to this project' });
      }
    }

    const submissionData: CreateSubmissionInput = {
      projectId,
      milestoneId: milestoneId || null,
      contractorId: contractor.id,
      submittedBy: req.user.userId,
      type,
      title,
      description,
      progress: progress !== undefined ? Number(progress) : null,
      estimatedValue: estimatedValue !== undefined ? Number(estimatedValue) : null,
      priority,
      qualityScore: qualityScore !== undefined ? Number(qualityScore) : null,
      safetyCompliance: safetyCompliance || null,
      weatherImpact: weatherImpact || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    };

    const submission = await submissionRepository.create(submissionData);

    // Notify M&E officers and admins; emit real-time event
    try {
      const io = req.app.get('io');
      await notificationRepository.createForRoles(['ME_OFFICER', 'GOVERNMENT_ADMIN'], {
        type: NotificationType.SUBMISSION,
        title: 'New submission received',
        message: `${contractor.companyName} submitted "${submission.title}" for ${project.name}`,
        data: { submissionId: submission.id, projectId: project.id },
      });
      io?.to('role-gov').emit('new-submission', {
        submissionId: submission.id,
        projectId: project.id,
        projectName: project.name,
        contractorName: contractor.companyName,
      });
    } catch (notifyError) {
      console.error('Submission notification error:', notifyError);
    }

    await audit(auditFromReq(req, 'submission.create', 'submission', submission.id, { title: submission.title, projectId: submission.projectId, type: submission.type }));

    return res.status(201).json({
      success: true,
      message: 'Submission created successfully',
      data: { submission },
    });
  } catch (error: any) {
    console.error('Create submission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create submission',
    });
  }
});

/**
 * PUT /api/submissions/:id
 * Update submission
 */
router.put('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const submission = await submissionRepository.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const isAdmin = req.user.role === 'GOVERNMENT_ADMIN';
    const isMEOfficer = req.user.role === 'ME_OFFICER';
    const contractor = await contractorRepository.findByUserId(req.user.userId);
    const isContractorOwner = contractor?.id === submission.contractorId;

    if (!isAdmin && !isMEOfficer && !isContractorOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this submission',
      });
    }

    // Terminal submissions are immutable for everyone — an approved record
    // must not be silently rewritten after the fact.
    if (submission.status === SubmissionStatus.APPROVED || submission.status === SubmissionStatus.REJECTED) {
      return res.status(409).json({
        success: false,
        message: 'Submission is in a terminal state and cannot be edited',
      });
    }
    if (isContractorOwner && submission.status !== SubmissionStatus.PENDING) {
      return res.status(403).json({
        success: false,
        message: 'Can only update pending submissions',
      });
    }

    // A milestone link must belong to the submission's own project —
    // otherwise the approve-time cascade silently writes to the wrong one.
    if (req.body.milestoneId !== undefined && req.body.milestoneId !== null) {
      const milestoneCheck = await query(
        'SELECT 1 FROM milestones WHERE id = $1 AND project_id = $2',
        [req.body.milestoneId, submission.projectId]
      );
      if (milestoneCheck.rows.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'milestoneId does not belong to this submission\'s project',
        });
      }
    }

    // Status/stage changes must go through /transition or /review — the generic
    // update path has no workflow, approval, or audit handling.
    const CONTRACTOR_FIELDS: (keyof UpdateSubmissionInput)[] = [
      'type', 'title', 'description', 'progress', 'estimatedValue',
      'priority', 'weatherImpact', 'dueDate',
    ];
    const REVIEWER_FIELDS: (keyof UpdateSubmissionInput)[] = [
      ...CONTRACTOR_FIELDS,
      'qualityScore', 'safetyCompliance', 'mediaCount', 'milestoneId',
    ];
    const allowedFields = isContractorOwner ? CONTRACTOR_FIELDS : REVIEWER_FIELDS;

    const updates: UpdateSubmissionInput = {};
    allowedFields.forEach((field) => {
      const value = (req.body as UpdateSubmissionInput)[field];
      if (value !== undefined) {
        if (['progress', 'estimatedValue', 'qualityScore', 'mediaCount'].includes(field)) {
          (updates as any)[field] = value !== null ? Number(value) : null;
        } else if (field === 'dueDate' && value) {
          updates.dueDate = new Date(value as any);
        } else {
          (updates as any)[field] = value;
        }
      }
    });

    const updatedSubmission = await submissionRepository.update(id, updates);

    return res.json({
      success: true,
      message: 'Submission updated successfully',
      data: { submission: updatedSubmission },
    });
  } catch (error: any) {
    console.error('Update submission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update submission',
    });
  }
});

/**
 * PUT /api/submissions/:id/review
 * Review submission (M&E Officer only)
 */
router.put('/:id/review', verifyToken, requireMEOfficer, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, comments } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Action is required',
      });
    }

    const submission = await submissionRepository.findById(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (submission.status === SubmissionStatus.APPROVED || submission.status === SubmissionStatus.REJECTED) {
      return res.status(409).json({
        success: false,
        message: 'Submission is already in a terminal state',
      });
    }

    const allowedActions = [
      SubmissionStatus.APPROVED,
      SubmissionStatus.REJECTED,
      SubmissionStatus.FLAGGED,
      SubmissionStatus.REQUIRES_CLARIFICATION,
    ];

    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review action',
      });
    }

    // Route through the workflow engine: resolve the stage mapping to this
    // action so role gates, adjacency, and stage history all apply —
    // the direct review() write bypassed the configured chain entirely.
    const stageResult = await query(
      'SELECT key FROM workflow_stages WHERE maps_to_status = $1 ORDER BY order_index LIMIT 1',
      [action]
    );
    const targetStage = stageResult.rows[0]?.key as string | undefined;
    if (!targetStage) {
      return res.status(400).json({
        success: false,
        message: `No workflow stage maps to ${action} — configure one or use /transition`,
      });
    }

    const updatedSubmission = await submissionRepository.transition(
      id, req.user.userId, req.user.role, targetStage, comments
    );
    if (!updatedSubmission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    // Notify the submitting contractor user
    try {
      const io = req.app.get('io');
      const approved = action === SubmissionStatus.APPROVED;
      await notificationRepository.create({
        userId: submission.submittedBy,
        type: approved ? NotificationType.APPROVAL : NotificationType.REJECTION,
        title: approved ? 'Submission approved' : `Submission ${action.toLowerCase().replace('_', ' ')}`,
        message: `Your submission "${submission.title}" was ${action.toLowerCase().replace('_', ' ')}${comments ? `: ${comments}` : ''}`,
        data: { submissionId: submission.id, projectId: submission.projectId, status: action },
        isUrgent: !approved,
      });
      io?.to(`user-${submission.submittedBy}`).emit('submission-reviewed', {
        submissionId: submission.id,
        status: action,
      });
    } catch (notifyError) {
      console.error('Review notification error:', notifyError);
    }

    await audit(auditFromReq(req, 'submission.review', 'submission', id, { action, comments: comments ? true : false }));

    return res.json({
      success: true,
      message: 'Submission reviewed successfully',
      data: { submission: updatedSubmission },
    });
  } catch (error: any) {
    console.error('Review submission error:', error);
    const status = error.status || 500;
    return res.status(status).json({
      success: false,
      message: status < 500 ? error.message : 'Failed to review submission',
    });
  }
});

/**
 * POST /api/submissions/:id/transition
 * Move a submission to the next workflow stage (or REJECTED).
 * Body: { toStage: string, comment?: string }
 * Role and adjacency are validated against the configured stage chain.
 */
router.post('/:id/transition', verifyToken, async (req: Request, res: Response) => {
  try {
    const { toStage, comment } = req.body;
    if (!toStage || typeof toStage !== 'string') {
      return res.status(400).json({ success: false, message: 'toStage is required' });
    }
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const updated = await submissionRepository.transition(
      req.params.id, req.user.userId, req.user.role, toStage, comment
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    try {
      const io = req.app.get('io');
      const approved = updated.status === SubmissionStatus.APPROVED;
      await notificationRepository.create({
        userId: updated.submittedBy,
        type: approved ? NotificationType.APPROVAL : NotificationType.REJECTION,
        title: approved ? 'Submission approved' : `Submission ${updated.stage.toLowerCase().replace('_', ' ')}`,
        message: `Your submission "${updated.title}" moved to ${updated.stage.toLowerCase().replace('_', ' ')}${comment ? `: ${comment}` : ''}`,
        data: { submissionId: updated.id, projectId: updated.projectId, stage: updated.stage, status: updated.status },
        isUrgent: updated.status === 'REJECTED',
      });
      io?.to(`user-${updated.submittedBy}`).emit('submission-reviewed', {
        submissionId: updated.id,
        stage: updated.stage,
        status: updated.status,
      });
    } catch (notifyError) {
      console.error('Transition notification error:', notifyError);
    }

    await audit(auditFromReq(req, 'submission.transition', 'submission', updated.id, { toStage, status: updated.status, comment: comment ? true : false }));

    return res.json({ success: true, message: `Submission moved to ${updated.stage}`, data: { submission: updated } });
  } catch (error: any) {
    if (error.name === 'WorkflowError' || error.status) {
      return res.status(error.status || 400).json({ success: false, message: error.message });
    }
    console.error('Transition submission error:', error);
    return res.status(500).json({ success: false, message: 'Failed to transition submission' });
  }
});

/**
 * DELETE /api/submissions/:id
 * Delete submission
 */
router.delete('/:id', verifyToken, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const submission = await submissionRepository.findById(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const isAdmin = req.user.role === 'GOVERNMENT_ADMIN';
    const contractor = await contractorRepository.findByUserId(req.user.userId);
    const isContractorOwner = contractor?.id === submission.contractorId;

    if (!isAdmin && !isContractorOwner) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this submission',
      });
    }

    // A contractor may only delete their own PENDING submission — removing
    // a reviewed one would orphan the approval trail and milestone cascade.
    if (!isAdmin && submission.status !== SubmissionStatus.PENDING) {
      return res.status(403).json({
        success: false,
        message: 'Only pending submissions can be deleted',
      });
    }

    await submissionRepository.delete(id);

    return res.json({
      success: true,
      message: 'Submission deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete submission error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete submission',
    });
  }
});

/**
 * GET /api/submissions/stats/overview
 * Get submission statistics
 */
router.get('/stats/overview', verifyToken, requireMEOfficer, async (_req: Request, res: Response) => {
  try {
    const stats = await submissionRepository.getOverviewStats();
    return res.json({
      success: true,
      data: { stats },
    });
  } catch (error: any) {
    console.error('Get submission stats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get submission statistics',
    });
  }
});

export default router;
