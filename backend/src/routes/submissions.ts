import { Router, Request, Response } from 'express';
import { authenticate, requireRoles } from '../middleware/auth';
import {
  ListSubmissionsParams,
  CreateSubmissionInput,
  UpdateSubmissionInput,
} from '../types/models';
import { NotificationType, SubmissionStatus } from '../types/domain';
import { submissionRepository } from '../repositories/submissionRepository';
import { contractorRepository } from '../repositories/contractorRepository';
import { projectRepository } from '../repositories/projectRepository';
import { notificationRepository } from '../repositories/notificationRepository';
import { audit, auditFromReq } from '../services/auditService';

const router = Router();

const verifyToken = authenticate;
const requireMEOfficer = requireRoles('ME_OFFICER', 'GOVERNMENT_ADMIN');

/**
 * GET /api/submissions
 * Get all submissions with filtering
 */
router.get('/', verifyToken, async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '20', 10), 1), 100);

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
router.get('/stats', verifyToken, async (_req: Request, res: Response) => {
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
    const submission = await submissionRepository.findByIdWithDetails(id);

    if (!submission) {
      return res.status(404).json({
        success: false,
        message: 'Submission not found',
      });
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
      io?.emit('new-submission', {
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

    if (isContractorOwner && submission.status !== SubmissionStatus.PENDING) {
      return res.status(403).json({
        success: false,
        message: 'Can only update pending submissions',
      });
    }

    const allowedFields: (keyof UpdateSubmissionInput)[] = [
      'type',
      'title',
      'description',
      'progress',
      'estimatedValue',
      'priority',
      'status',
      'qualityScore',
      'safetyCompliance',
      'weatherImpact',
      'dueDate',
      'mediaCount',
      'milestoneId',
    ];

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
    const { action, comments, qualityScore, safetyCompliance } = req.body;

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

    const allowedActions = [
      SubmissionStatus.APPROVED,
      SubmissionStatus.REJECTED,
      SubmissionStatus.FLAGGED,
      SubmissionStatus.REQUIRES_CLARIFICATION,
      SubmissionStatus.PENDING,
    ];

    if (!allowedActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid review action',
      });
    }

    const updatedSubmission = await submissionRepository.review(
      id,
      req.user.userId,
      {
        action,
        comments,
        qualityScore: qualityScore !== undefined ? Number(qualityScore) : null,
        safetyCompliance: safetyCompliance || null,
      },
      { projectId: submission.projectId, milestoneId: submission.milestoneId }
    );

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
    return res.status(500).json({
      success: false,
      message: 'Failed to review submission',
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
router.get('/stats/overview', verifyToken, async (_req: Request, res: Response) => {
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
