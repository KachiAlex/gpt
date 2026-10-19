import { getClient, objectToSnakeCase, query, rowToCamelCase } from '../config/database';
import { transitionSubmission } from '../services/workflowService';
import {
  CreateSubmissionInput,
  DbApproval,
  DbDocument,
  DbSubmission,
  ListSubmissionsParams,
  ReviewSubmissionInput,
  SubmissionListItem,
  UpdateSubmissionInput,
} from '../types/models';
import { SubmissionStatus } from '../types/domain';

const submissionColumns = `
  s.id, s.project_id, s.milestone_id, s.contractor_id, s.submitted_by,
  s.type, s.title, s.description, s.progress, s.estimated_value,
  s.priority, s.status, s.stage, s.quality_score, s.safety_compliance,
  s.weather_impact, s.media_count, s.due_date, s.submitted_at,
  s.reviewed_at, s.reviewed_by, s.review_comments, s.created_at, s.updated_at
`;

const documentColumns = `
  id, project_id, submission_id, file_name, original_name, file_path,
  file_size, mime_type, category, uploaded_by, is_public, created_at
`;

const approvalColumns = `
  id, submission_id, reviewer_id, action, comments, created_at
`;

export interface SubmissionDetails {
  submission: DbSubmission;
  project: SubmissionListItem['project'];
  contractor: SubmissionListItem['contractor'];
  submitter: SubmissionListItem['submitter'];
  milestone: {
    id: string;
    projectId: string;
    name: string;
    description: string | null;
    dueDate: Date | null;
    completedDate: Date | null;
    status: string;
    progress: number;
    budget: number | null;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  documents: DbDocument[];
  approvals: DbApproval[];
}

const mapSubmission = (row: any): DbSubmission => {
  const data = rowToCamelCase(row);
  return {
    id: data.id,
    projectId: data.projectId,
    milestoneId: data.milestoneId ?? null,
    contractorId: data.contractorId,
    submittedBy: data.submittedBy,
    type: data.type,
    title: data.title,
    description: data.description,
    progress: data.progress !== undefined && data.progress !== null ? Number(data.progress) : null,
    estimatedValue:
      data.estimatedValue !== undefined && data.estimatedValue !== null ? Number(data.estimatedValue) : null,
    priority: data.priority,
    status: data.status,
    stage: data.stage ?? null,
    qualityScore:
      data.qualityScore !== undefined && data.qualityScore !== null ? Number(data.qualityScore) : null,
    safetyCompliance: data.safetyCompliance ?? null,
    weatherImpact: data.weatherImpact ?? null,
    mediaCount: Number(data.mediaCount ?? 0),
    dueDate: data.dueDate ? new Date(data.dueDate) : null,
    submittedAt: new Date(data.submittedAt),
    reviewedAt: data.reviewedAt ? new Date(data.reviewedAt) : null,
    reviewedBy: data.reviewedBy ?? null,
    reviewComments: data.reviewComments ?? null,
    createdAt: new Date(data.createdAt),
    updatedAt: new Date(data.updatedAt),
  };
};

const mapDocument = (row: any): DbDocument => {
  const data = rowToCamelCase(row);
  return {
    ...data,
    projectId: data.projectId ?? null,
    submissionId: data.submissionId ?? null,
    createdAt: new Date(data.createdAt),
  };
};

const mapApproval = (row: any): DbApproval => {
  const data = rowToCamelCase(row);
  return {
    ...data,
    comments: data.comments ?? null,
    createdAt: new Date(data.createdAt),
  };
};

const buildWhereClause = (options: ListSubmissionsParams) => {
  const clauses: string[] = [];
  const params: any[] = [];

  if (options.projectId) {
    params.push(options.projectId);
    clauses.push(`s.project_id = $${params.length}`);
  }
  if (options.contractorId) {
    params.push(options.contractorId);
    clauses.push(`s.contractor_id = $${params.length}`);
  }
  if (options.status) {
    params.push(options.status);
    clauses.push(`s.status = $${params.length}`);
  }
  if (options.type) {
    params.push(options.type);
    clauses.push(`s.type = $${params.length}`);
  }
  if (options.priority) {
    params.push(options.priority);
    clauses.push(`s.priority = $${params.length}`);
  }
  if (options.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    const idx = params.length;
    clauses.push(`(LOWER(s.title) LIKE $${idx} OR LOWER(s.description) LIKE $${idx})`);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereClause, params };
};

const mapSubmissionListItem = (row: any): SubmissionListItem => {
  const submission = mapSubmission(row);
  const camel = rowToCamelCase(row);

  const project = camel.projectIdRef
    ? {
        id: camel.projectIdRef,
        name: camel.projectName ?? null,
        lga: Array.isArray(camel.projectLga) ? camel.projectLga : [],
      }
    : null;

  const contractor = camel.contractorIdRef
    ? {
        id: camel.contractorIdRef,
        companyName: camel.contractorCompanyName ?? null,
      }
    : null;

  const submitter = camel.submitterIdRef
    ? {
        id: camel.submitterIdRef,
        firstName: camel.submitterFirstName ?? null,
        lastName: camel.submitterLastName ?? null,
        email: camel.submitterEmail ?? null,
      }
    : null;

  return {
    ...submission,
    project,
    contractor,
    submitter,
  };
};

export const submissionRepository = {
  async listWithFilters(options: ListSubmissionsParams): Promise<{ submissions: SubmissionListItem[]; total: number }> {
    const { whereClause, params } = buildWhereClause(options);

    const countResult = await query(`SELECT COUNT(*) FROM submissions s ${whereClause}`, params);
    const total = parseInt(countResult.rows[0]?.count || '0', 10);

    const limit = options.limit;
    const offset = (options.page - 1) * options.limit;
    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;

    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT ${submissionColumns},
              p.id AS project_id_ref, p.name AS project_name, p.lga AS project_lga,
              cp.id AS contractor_id_ref, cp.company_name AS contractor_company_name,
              u.id AS submitter_id_ref, u.first_name AS submitter_first_name,
              u.last_name AS submitter_last_name, u.email AS submitter_email
       FROM submissions s
       LEFT JOIN projects p ON s.project_id = p.id
       LEFT JOIN contractor_profiles cp ON s.contractor_id = cp.id
       LEFT JOIN users u ON s.submitted_by = u.id
       ${whereClause}
       ORDER BY s.submitted_at DESC
       LIMIT $${limitIndex}
       OFFSET $${offsetIndex}`,
      dataParams
    );

    return {
      submissions: result.rows.map(mapSubmissionListItem),
      total,
    };
  },

  async listRecentWithRelations(limit: number): Promise<SubmissionListItem[]> {
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const result = await query(
      `SELECT ${submissionColumns},
              p.id AS project_id_ref, p.name AS project_name, p.lga AS project_lga,
              cp.id AS contractor_id_ref, cp.company_name AS contractor_company_name,
              u.id AS submitter_id_ref, u.first_name AS submitter_first_name,
              u.last_name AS submitter_last_name, u.email AS submitter_email
       FROM submissions s
       LEFT JOIN projects p ON s.project_id = p.id
       LEFT JOIN contractor_profiles cp ON s.contractor_id = cp.id
       LEFT JOIN users u ON s.submitted_by = u.id
       ORDER BY s.submitted_at DESC
       LIMIT $1`,
      [normalizedLimit]
    );

    return result.rows.map(mapSubmissionListItem);
  },

  async findById(id: string): Promise<DbSubmission | null> {
    const result = await query(`SELECT ${submissionColumns} FROM submissions s WHERE s.id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapSubmission(result.rows[0]);
  },

  async findByIdWithDetails(id: string): Promise<SubmissionDetails | null> {
    const result = await query(
      `SELECT ${submissionColumns},
              p.id AS project_id_ref, p.name AS project_name, p.lga AS project_lga,
              cp.id AS contractor_id_ref, cp.company_name AS contractor_company_name,
              u.id AS submitter_id_ref, u.first_name AS submitter_first_name,
              u.last_name AS submitter_last_name, u.email AS submitter_email,
              m.id AS milestone_id_ref, m.name AS milestone_name, m.description AS milestone_description,
              m.due_date AS milestone_due_date, m.completed_date AS milestone_completed_date,
              m.status AS milestone_status, m.progress AS milestone_progress, m.budget AS milestone_budget,
              m.order_index AS milestone_order_index, m.created_at AS milestone_created_at,
              m.updated_at AS milestone_updated_at
       FROM submissions s
       LEFT JOIN projects p ON s.project_id = p.id
       LEFT JOIN contractor_profiles cp ON s.contractor_id = cp.id
       LEFT JOIN users u ON s.submitted_by = u.id
       LEFT JOIN milestones m ON s.milestone_id = m.id
       WHERE s.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const submission = mapSubmission(row);
    const camel = rowToCamelCase(row);

    const milestone = camel.milestoneIdRef
      ? {
          id: camel.milestoneIdRef,
          projectId: submission.projectId,
          name: camel.milestoneName,
          description: camel.milestoneDescription ?? null,
          dueDate: camel.milestoneDueDate ? new Date(camel.milestoneDueDate) : null,
          completedDate: camel.milestoneCompletedDate ? new Date(camel.milestoneCompletedDate) : null,
          status: camel.milestoneStatus,
          progress: camel.milestoneProgress ?? 0,
          budget: camel.milestoneBudget ?? null,
          orderIndex: camel.milestoneOrderIndex ?? 0,
          createdAt: camel.milestoneCreatedAt ? new Date(camel.milestoneCreatedAt) : new Date(),
          updatedAt: camel.milestoneUpdatedAt ? new Date(camel.milestoneUpdatedAt) : new Date(),
        }
      : null;

    const documentsResult = await query(
      `SELECT ${documentColumns}
       FROM documents
       WHERE submission_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    const approvalsResult = await query(
      `SELECT ${approvalColumns}
       FROM approvals
       WHERE submission_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    return {
      submission,
      project: camel.projectIdRef
        ? {
            id: camel.projectIdRef,
            name: camel.projectName ?? null,
            lga: Array.isArray(camel.projectLga) ? camel.projectLga : [],
          }
        : null,
      contractor: camel.contractorIdRef
        ? {
            id: camel.contractorIdRef,
            companyName: camel.contractorCompanyName ?? null,
          }
        : null,
      submitter: camel.submitterIdRef
        ? {
            id: camel.submitterIdRef,
            firstName: camel.submitterFirstName ?? null,
            lastName: camel.submitterLastName ?? null,
            email: camel.submitterEmail ?? null,
          }
        : null,
      milestone,
      documents: documentsResult.rows.map(mapDocument),
      approvals: approvalsResult.rows.map(mapApproval),
    };
  },

  async create(data: CreateSubmissionInput): Promise<DbSubmission> {
    const result = await query(
      `INSERT INTO submissions (
        project_id, milestone_id, contractor_id, submitted_by, type, title,
        description, progress, estimated_value, priority, status,
        quality_score, safety_compliance, weather_impact, media_count, due_date
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'${SubmissionStatus.PENDING}',$11,$12,$13,0,$14
      ) RETURNING *`,
      [
        data.projectId,
        data.milestoneId ?? null,
        data.contractorId,
        data.submittedBy,
        data.type,
        data.title,
        data.description,
        data.progress ?? null,
        data.estimatedValue ?? null,
        data.priority,
        data.qualityScore ?? null,
        data.safetyCompliance ?? null,
        data.weatherImpact ?? null,
        data.dueDate ?? null,
      ]
    );

    return mapSubmission(result.rows[0]);
  },

  async update(id: string, updates: UpdateSubmissionInput): Promise<DbSubmission | null> {
    const snake = objectToSnakeCase(updates);
    const entries = Object.entries(snake).filter(([, value]) => value !== undefined);

    if (entries.length === 0) {
      return this.findById(id);
    }

    const fields: string[] = [];
    const values: any[] = [];

    entries.forEach(([key, value]) => {
      fields.push(`${key} = $${fields.length + 1}`);
      values.push(value);
    });

    values.push(id);

    const result = await query(
      `UPDATE submissions s
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING ${submissionColumns}`,
      values
    );

    if (result.rows.length === 0) return null;
    return mapSubmission(result.rows[0]);
  },

  /**
   * Review a submission. When `cascade` is provided, an APPROVED review
   * also completes the linked milestone and recomputes the project's
   * verified progress — all inside the same transaction.
   */
  async review(
    id: string,
    reviewerId: string,
    input: ReviewSubmissionInput,
    cascade?: { projectId: string; milestoneId?: string | null }
  ): Promise<DbSubmission | null> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const status = input.action as SubmissionStatus;
      // Keep stage in sync for terminal outcomes: move to the workflow stage
      // whose maps_to_status matches (e.g. APPROVED terminal). Non-terminal
      // flags (FLAGGED / REQUIRES_CLARIFICATION) keep the current stage.
      const updateResult = await client.query(
        `UPDATE submissions s
         SET status = $1,
             stage = COALESCE(
               (SELECT key FROM workflow_stages WHERE maps_to_status = $1 LIMIT 1),
               s.stage
             ),
             reviewed_at = NOW(),
             reviewed_by = $2,
             review_comments = $3,
             quality_score = COALESCE($4, quality_score),
             safety_compliance = COALESCE($5, safety_compliance),
             updated_at = NOW()
         WHERE id = $6
         RETURNING ${submissionColumns}`,
        [status, reviewerId, input.comments ?? null, input.qualityScore ?? null, input.safetyCompliance ?? null, id]
      );

      if (updateResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      // approval_action is a separate enum — map submission statuses onto it
      // (REQUIRES_CLARIFICATION -> REQUEST_CLARIFICATION).
      const approvalAction = status === ('REQUIRES_CLARIFICATION' as SubmissionStatus)
        ? 'REQUEST_CLARIFICATION'
        : status;
      await client.query(
        `INSERT INTO approvals (submission_id, reviewer_id, action, comments)
         VALUES ($1, $2, $3, $4)`,
        [id, reviewerId, approvalAction, input.comments ?? null]
      );

      if (cascade && status === SubmissionStatus.APPROVED && cascade.milestoneId) {
        await client.query(
          `UPDATE milestones
           SET status = 'COMPLETED', completed_date = NOW(), progress = 100, updated_at = NOW()
           WHERE id = $1 AND project_id = $2`,
          [cascade.milestoneId, cascade.projectId]
        );
      }

      if (cascade) {
        await client.query(
          `WITH ms AS (
             SELECT COALESCE(AVG(progress), 0) AS avg_progress,
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED') AS done
             FROM milestones
             WHERE project_id = $1 AND status <> 'CANCELLED'
           )
           UPDATE projects p
           SET progress = ROUND(ms.avg_progress)::int,
               status = CASE
                 WHEN ms.total > 0 AND ms.done = ms.total THEN 'COMPLETED'
                 WHEN p.status = 'COMPLETED' AND ms.total > 0 THEN 'IN_PROGRESS'
                 ELSE p.status
               END,
               actual_end_date = CASE
                 WHEN ms.total > 0 AND ms.done = ms.total THEN COALESCE(p.actual_end_date, NOW())
                 ELSE p.actual_end_date
               END,
               updated_at = NOW()
           FROM ms
           WHERE p.id = $1 AND ms.total > 0`,
          [cascade.projectId]
        );
      }

      await client.query('COMMIT');
      return mapSubmission(updateResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Move a submission through the configured workflow. Validates the
   * transition (role + adjacency) via workflowService, records history,
   * syncs the coarse status, and runs the milestone/project cascade when
   * the target stage maps to APPROVED — all atomically.
   */
  async transition(
    id: string,
    actorId: string,
    actorRole: string,
    toStage: string,
    comment?: string
  ): Promise<DbSubmission | null> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const lockResult = await client.query(
        `SELECT id, stage, status, project_id, milestone_id, contractor_id, submitted_by, title
         FROM submissions WHERE id = $1 FOR UPDATE`,
        [id]
      );
      if (lockResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }
      const sub = rowToCamelCase(lockResult.rows[0]);

      // A stage that allows CONTRACTOR applies only to the owning contractor
      if (actorRole === 'CONTRACTOR') {
        const contractorResult = await client.query(
          'SELECT id FROM contractor_profiles WHERE user_id = $1',
          [actorId]
        );
        if (contractorResult.rows[0]?.id !== sub.contractorId) {
          await client.query('ROLLBACK');
          const error: any = new Error('Not authorized to transition this submission');
          error.status = 403;
          error.name = 'WorkflowError';
          throw error;
        }
      }

      const { stage } = await transitionSubmission(client, sub as any, toStage, actorId, actorRole, comment);
      const outcome = stage.mapsToStatus;

      // Terminal outcomes carry the review metadata + approvals audit row
      if (outcome === 'APPROVED' || outcome === 'REJECTED') {
        await client.query(
          `UPDATE submissions SET reviewed_at = NOW(), reviewed_by = $2, review_comments = $3 WHERE id = $1`,
          [id, actorId, comment ?? null]
        );
        await client.query(
          `INSERT INTO approvals (submission_id, reviewer_id, action, comments) VALUES ($1, $2, $3, $4)`,
          [id, actorId, outcome, comment ?? null]
        );
      }

      if (outcome === 'APPROVED' && sub.milestoneId) {
        await client.query(
          `UPDATE milestones
           SET status = 'COMPLETED', completed_date = NOW(), progress = 100, updated_at = NOW()
           WHERE id = $1 AND project_id = $2`,
          [sub.milestoneId, sub.projectId]
        );
      }

      if (outcome === 'APPROVED' || outcome === 'REJECTED') {
        await client.query(
          `WITH ms AS (
             SELECT COALESCE(AVG(progress), 0) AS avg_progress,
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE status = 'COMPLETED') AS done
             FROM milestones
             WHERE project_id = $1 AND status <> 'CANCELLED'
           )
           UPDATE projects p
           SET progress = ROUND(ms.avg_progress)::int,
               status = CASE
                 WHEN ms.total > 0 AND ms.done = ms.total THEN 'COMPLETED'
                 WHEN p.status = 'COMPLETED' AND ms.total > 0 THEN 'IN_PROGRESS'
                 ELSE p.status
               END,
               actual_end_date = CASE
                 WHEN ms.total > 0 AND ms.done = ms.total THEN COALESCE(p.actual_end_date, NOW())
                 ELSE p.actual_end_date
               END,
               updated_at = NOW()
           FROM ms
           WHERE p.id = $1 AND ms.total > 0`,
          [sub.projectId]
        );
      }

      const refreshed = await client.query(`SELECT ${submissionColumns} FROM submissions s WHERE s.id = $1`, [id]);

      await client.query('COMMIT');
      return mapSubmission(refreshed.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  async delete(id: string): Promise<void> {
    await query('DELETE FROM submissions WHERE id = $1', [id]);
  },

  async getOverviewStats() {
    const totalResult = await query('SELECT COUNT(*) FROM submissions');
    const total = parseInt(totalResult.rows[0]?.count || '0', 10);

    const statusResult = await query('SELECT status, COUNT(*) FROM submissions GROUP BY status');
    const typeResult = await query('SELECT type, COUNT(*) FROM submissions GROUP BY type');
    const qualityResult = await query('SELECT AVG(quality_score) as avg_quality FROM submissions WHERE quality_score IS NOT NULL');

    const byStatus: Record<string, number> = {};
    statusResult.rows.forEach((row: { status: string; count: string }) => {
      byStatus[row.status] = parseInt(row.count, 10);
    });

    const byType: Record<string, number> = {};
    typeResult.rows.forEach((row: { type: string; count: string }) => {
      byType[row.type] = parseInt(row.count, 10);
    });

    return {
      total,
      byStatus,
      byType,
      averageQualityScore: qualityResult.rows[0]?.avg_quality ? Number(qualityResult.rows[0].avg_quality) : 0,
    };
  },
};

export default submissionRepository;
