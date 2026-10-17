import { getClient, objectToSnakeCase, query, rowToCamelCase } from '../config/database';
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
  s.priority, s.status, s.quality_score, s.safety_compliance,
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
      ) RETURNING ${submissionColumns}`,
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
      `UPDATE submissions
       SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${values.length}
       RETURNING ${submissionColumns}`,
      values
    );

    if (result.rows.length === 0) return null;
    return mapSubmission(result.rows[0]);
  },

  async review(id: string, reviewerId: string, input: ReviewSubmissionInput): Promise<DbSubmission | null> {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const status = input.action as SubmissionStatus;
      const updateResult = await client.query(
        `UPDATE submissions
         SET status = $1,
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

      await client.query(
        `INSERT INTO approvals (submission_id, reviewer_id, action, comments)
         VALUES ($1, $2, $3, $4)`,
        [id, reviewerId, input.action, input.comments ?? null]
      );

      await client.query('COMMIT');
      return mapSubmission(updateResult.rows[0]);
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
