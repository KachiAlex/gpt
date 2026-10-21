import { query, rowToCamelCase, objectToSnakeCase } from '../config/database';
import {
  CreateProjectInput,
  DbMilestone,
  DbProject,
  DbSubmissionSummary,
  ListProjectsParams,
  UpdateProjectInput,
} from '../types/models';

const projectColumns = `
  id, name, description, category, lga, priority, status, progress,
  budget, allocated_budget, spent_budget, funding_source, start_date,
  expected_end_date, actual_end_date, beneficiaries, contractor_id,
  project_manager_id, location, is_public, published_at, published_by,
  financial_status,
  quality_score, safety_compliance,
  weather_delay, safety_incidents, created_at, updated_at
`;

// projectColumns qualified with the `p` table alias — required wherever the
// query joins contractor_profiles (both tables have `id`, `created_at`, …)
const pColumns = projectColumns
  .split(',')
  .map((c) => `p.${c.trim()}`)
  .join(', ');

const milestoneColumns = `
  id, project_id, name, description, due_date, completed_date, status,
  progress, budget, order_index, created_at, updated_at
`;

const submissionColumns = `
  id, project_id, contractor_id, title, status, submitted_at
`;

// Postgres NUMERIC columns come back as strings ("1000000.00") — normalize
// every money/progress column so the API always returns real numbers.
const num = (v: any) => (v === null || v === undefined ? v : Number(v));

const mapProject = (row: any): DbProject => {
  const project = rowToCamelCase(row);
  return {
    ...project,
    // List queries LEFT JOIN contractor_profiles → company name surfaced as
    // `contractor` for table columns/search
    contractor: project.contractorName ?? undefined,
    lga: Array.isArray(project.lga) ? project.lga : [],
    budget: num(project.budget),
    allocatedBudget: num(project.allocatedBudget),
    spentBudget: num(project.spentBudget),
    progress: num(project.progress),
    // beneficiaries + safety_compliance are TEXT columns ("50,000 residents",
    // "Not Started") — num() would turn them into NaN
    qualityScore: num(project.qualityScore),
    weatherDelay: num(project.weatherDelay),
    startDate: project.startDate ? new Date(project.startDate) : null,
    expectedEndDate: project.expectedEndDate ? new Date(project.expectedEndDate) : null,
    actualEndDate: project.actualEndDate ? new Date(project.actualEndDate) : null,
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt),
  } as DbProject;
};

const mapMilestone = (row: any): DbMilestone => {
  const milestone = rowToCamelCase(row);
  return {
    ...milestone,
    progress: num(milestone.progress),
    budget: num(milestone.budget),
    dueDate: milestone.dueDate ? new Date(milestone.dueDate) : null,
    completedDate: milestone.completedDate ? new Date(milestone.completedDate) : null,
    createdAt: new Date(milestone.createdAt),
    updatedAt: new Date(milestone.updatedAt),
  } as DbMilestone;
};

const mapSubmission = (row: any): DbSubmissionSummary => {
  const submission = rowToCamelCase(row);
  return {
    ...submission,
    submittedAt: new Date(submission.submittedAt),
  } as DbSubmissionSummary;
};

const buildProjectWhereClause = (options: ListProjectsParams) => {
  const clauses: string[] = [];
  const params: any[] = [];

  if (options.status) {
    params.push(options.status);
    clauses.push(`p.status = $${params.length}`);
  }
  if (options.category) {
    params.push(options.category);
    clauses.push(`p.category = $${params.length}`);
  }
  if (options.priority) {
    params.push(options.priority);
    clauses.push(`p.priority = $${params.length}`);
  }
  if (options.contractorId) {
    params.push(options.contractorId);
    clauses.push(`p.contractor_id = $${params.length}`);
  }
  if (options.lga && options.lga.length > 0) {
    params.push(options.lga);
    clauses.push(`p.lga && $${params.length}::text[]`);
  }
  if (options.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    const idx = params.length;
    clauses.push(`(
      LOWER(p.name) LIKE $${idx} OR
      LOWER(p.description) LIKE $${idx} OR
      LOWER(COALESCE((SELECT cp.company_name FROM contractor_profiles cp WHERE cp.id = p.contractor_id), '')) LIKE $${idx}
    )`);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereClause, params };
};

// Shared milestone→project rollup. Auto-complete fires only from live states
// (manual DELAYED/ON_HOLD/CANCELLED survive); demotion requires actual
// regression (ms.done < ms.total) so editing a finished milestone doesn't
// bounce the project back to IN_PROGRESS. Parameter $1 = project id.
export const PROJECT_PROGRESS_RECOMPUTE_SQL = `
  WITH ms AS (
    SELECT COALESCE(AVG(progress), 0) AS avg_progress,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'COMPLETED') AS done
    FROM milestones
    WHERE project_id = $1 AND status <> 'CANCELLED'
  )
  UPDATE projects p
  SET progress = ROUND(ms.avg_progress)::int,
      status = CASE
        WHEN ms.total > 0 AND ms.done = ms.total
             AND p.status IN ('NOT_STARTED', 'IN_PROGRESS', 'NEAR_COMPLETION') THEN 'COMPLETED'
        WHEN p.status = 'COMPLETED' AND ms.total > 0 AND ms.done < ms.total THEN 'IN_PROGRESS'
        ELSE p.status
      END,
      actual_end_date = CASE
        WHEN ms.total > 0 AND ms.done = ms.total
             AND p.status IN ('NOT_STARTED', 'IN_PROGRESS', 'NEAR_COMPLETION') THEN COALESCE(p.actual_end_date, NOW())
        ELSE p.actual_end_date
      END,
      updated_at = NOW()
  FROM ms
  WHERE p.id = $1 AND ms.total > 0
`;

export const projectRepository = {
  async listWithFilters(options: ListProjectsParams): Promise<{ projects: DbProject[]; total: number }> {
    const { whereClause, params } = buildProjectWhereClause(options);

    const totalResult = await query(`SELECT COUNT(*) FROM projects p ${whereClause}`, params);
    const total = parseInt(totalResult.rows[0]?.count || '0', 10);

    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;
    const limit = options.limit;
    const offset = (options.page - 1) * options.limit;

    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT ${pColumns}, cp.company_name AS contractor_name
       FROM projects p
       LEFT JOIN contractor_profiles cp ON cp.id = p.contractor_id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT $${limitIndex}
       OFFSET $${offsetIndex}`,
      dataParams
    );

    return {
      projects: result.rows.map(mapProject),
      total,
    };
  },

  async listRecentUpdates(limit: number): Promise<DbProject[]> {
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
    const result = await query(
      `SELECT ${projectColumns}
       FROM projects p
       ORDER BY p.updated_at DESC
       LIMIT $1`,
      [normalizedLimit]
    );

    return result.rows.map(mapProject);
  },

  async findById(id: string): Promise<DbProject | null> {
    const result = await query(`SELECT ${projectColumns} FROM projects WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapProject(result.rows[0]);
  },

  async getContractorSummary(contractorId: string | null) {
    if (!contractorId) return null;
    const result = await query(
      `SELECT id, company_name, rating
       FROM contractor_profiles
       WHERE id = $1`,
      [contractorId]
    );
    if (result.rows.length === 0) return null;
    const row = rowToCamelCase(result.rows[0]);
    return {
      id: row.id,
      companyName: row.companyName,
      rating: row.rating,
    };
  },

  async getMilestones(projectId: string): Promise<DbMilestone[]> {
    const result = await query(
      `SELECT ${milestoneColumns}
       FROM milestones
       WHERE project_id = $1
       ORDER BY order_index ASC`,
      [projectId]
    );
    return result.rows.map(mapMilestone);
  },

  async findMilestoneById(id: string): Promise<DbMilestone | null> {
    const result = await query(
      `SELECT ${milestoneColumns} FROM milestones WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return mapMilestone(result.rows[0]);
  },

  async createMilestone(
    projectId: string,
    data: { name: string; description?: string; dueDate?: Date | null; budget?: number | null; orderIndex?: number }
  ): Promise<DbMilestone> {
    let orderIndex = data.orderIndex;
    if (orderIndex === undefined || orderIndex === null) {
      const max = await query(
        'SELECT COALESCE(MAX(order_index), 0) + 1 AS next FROM milestones WHERE project_id = $1',
        [projectId]
      );
      orderIndex = parseInt(max.rows[0].next, 10);
    }
    const result = await query(
      `INSERT INTO milestones (project_id, name, description, due_date, status, progress, budget, order_index)
       VALUES ($1,$2,$3,$4,'PENDING',0,$5,$6)
       RETURNING ${milestoneColumns}`,
      [projectId, data.name, data.description ?? null, data.dueDate ?? null, data.budget ?? null, orderIndex]
    );
    return mapMilestone(result.rows[0]);
  },

  async updateMilestone(
    id: string,
    updates: { name?: string; description?: string | null; dueDate?: Date | null; completedDate?: Date | null; status?: string; progress?: number; budget?: number | null; orderIndex?: number }
  ): Promise<DbMilestone | null> {
    const snake = objectToSnakeCase(updates as Record<string, unknown>);
    const entries = Object.entries(snake).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return this.findMilestoneById(id);

    const fields: string[] = [];
    const values: any[] = [];
    entries.forEach(([key, value]) => {
      fields.push(`${key} = $${values.length + 1}`);
      values.push(value);
    });
    values.push(id);

    const result = await query(
      `UPDATE milestones SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING ${milestoneColumns}`,
      values
    );
    if (result.rows.length === 0) return null;
    return mapMilestone(result.rows[0]);
  },

  async deleteMilestone(id: string): Promise<void> {
    await query('DELETE FROM milestones WHERE id = $1', [id]);
  },

  /**
   * Recompute a project's verified progress from its milestones
   * (mean progress of non-cancelled milestones). When every milestone is
   * completed the project is marked COMPLETED; otherwise an existing
   * COMPLETED project drops back to IN_PROGRESS.
   */
  async recomputeProjectProgress(projectId: string): Promise<void> {
    await query(PROJECT_PROGRESS_RECOMPUTE_SQL, [projectId]);
  },

  async getRecentSubmissions(projectId: string, limit = 5): Promise<DbSubmissionSummary[]> {
    const result = await query(
      `SELECT ${submissionColumns}
       FROM submissions
       WHERE project_id = $1
       ORDER BY submitted_at DESC
       LIMIT $2`,
      [projectId, limit]
    );
    return result.rows.map(mapSubmission);
  },

  async create(data: CreateProjectInput): Promise<DbProject> {
    const result = await query(
      `INSERT INTO projects (
        name, description, category, lga, priority, status, progress,
        budget, allocated_budget, spent_budget, funding_source, start_date,
        expected_end_date, actual_end_date, beneficiaries, contractor_id,
        project_manager_id, location, is_public, quality_score, safety_compliance,
        weather_delay, safety_incidents
      ) VALUES (
        $1,$2,$3,$4,$5,'NOT_STARTED',0,$6,$7,0,$8,$9,
        $10,$11,$12,$13,$14,$15,$16,0,'Not Started',0,0
      ) RETURNING ${projectColumns}`,
      [
        data.name,
        data.description ?? null,
        data.category,
        data.lga,
        data.priority,
        data.budget,
        data.allocatedBudget ?? data.budget,
        data.fundingSource,
        data.startDate ?? null,
        data.expectedEndDate ?? null,
        data.actualEndDate ?? null,
        data.beneficiaries ?? null,
        data.contractorId ?? null,
        data.projectManagerId ?? null,
        data.location ?? null,
        data.isPublic ?? false,
      ]
    );

    return mapProject(result.rows[0]);
  },

  async update(id: string, updates: UpdateProjectInput): Promise<DbProject | null> {
    const snakeUpdates = objectToSnakeCase(updates);
    const entries = Object.entries(snakeUpdates).filter(([, value]) => value !== undefined);

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
      `UPDATE projects SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING ${projectColumns}`,
      values
    );

    if (result.rows.length === 0) return null;
    return mapProject(result.rows[0]);
  },

  async delete(id: string): Promise<void> {
    await query('DELETE FROM projects WHERE id = $1', [id]);
  },
};

export default projectRepository;
