import { PoolClient } from 'pg';
import { query, rowToCamelCase } from '../config/database';

export interface WorkflowStage {
  key: string;
  label: string;
  orderIndex: number;
  allowedRoles: string[];
  mapsToStatus: string | null;
  isTerminal: boolean;
  isSystem: boolean;
}

const mapStage = (row: any): WorkflowStage => rowToCamelCase(row) as WorkflowStage;

export const getStages = async (client?: PoolClient): Promise<WorkflowStage[]> => {
  const runner = client ? client.query.bind(client) : query;
  const result = await runner('SELECT * FROM workflow_stages ORDER BY order_index');
  return result.rows.map(mapStage);
};

export const getStage = async (key: string, client?: PoolClient): Promise<WorkflowStage | null> => {
  const runner = client ? client.query.bind(client) : query;
  const result = await runner('SELECT * FROM workflow_stages WHERE key = $1', [key]);
  return result.rows[0] ? mapStage(result.rows[0]) : null;
};

export class WorkflowError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Move a submission to a new stage. Runs inside the caller's transaction —
 * pass an open PoolClient. Validates:
 *  - target stage exists
 *  - actor's role is in the target stage's allowed_roles
 *  - forward moves go to the next stage in order; REJECTED is reachable from
 *    any non-terminal stage by anyone allowed to act on the next stage
 */
export const transitionSubmission = async (
  client: PoolClient,
  submission: { id: string; stage: string; status: string; projectId: string; contractorId: string | null; title: string },
  toStage: string,
  actorId: string,
  actorRole: string,
  comment?: string
): Promise<{ stage: WorkflowStage }> => {
  const target = await getStage(toStage, client);
  if (!target) throw new WorkflowError(`Unknown stage '${toStage}'`, 404);

  const current = await getStage(submission.stage, client);
  if (current?.isTerminal) {
    throw new WorkflowError(`Submission is already at terminal stage '${current.label}'`, 409);
  }

  if (!target.allowedRoles.includes(actorRole)) {
    throw new WorkflowError(`Role ${actorRole} may not move submissions into '${target.label}'`, 403);
  }

  const isReject = target.mapsToStatus === 'REJECTED';
  if (!isReject) {
    // forward-only: target must be the immediate next stage
    const stages = await getStages(client);
    const forwardChain = stages.filter((s) => s.mapsToStatus !== 'REJECTED');
    const idx = forwardChain.findIndex((s) => s.key === submission.stage);
    const next = forwardChain[idx + 1];
    if (!next || next.key !== target.key) {
      throw new WorkflowError(
        next ? `Submissions at '${current?.label ?? submission.stage}' can only advance to '${next.label}'` : 'No further stages',
        409
      );
    }
  }

  await client.query(
    `INSERT INTO submission_stage_history (submission_id, from_stage, to_stage, action, actor_id, comment)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [submission.id, submission.stage, toStage, isReject ? 'reject' : 'advance', actorId, comment ?? null]
  );

  await client.query(
    `UPDATE submissions SET stage = $2, status = COALESCE($3::submission_status, status), updated_at = NOW() WHERE id = $1`,
    [submission.id, toStage, target.mapsToStatus]
  );

  return { stage: target };
};
