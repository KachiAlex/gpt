import { query, rowToCamelCase } from '../config/database';
import {
  CreateDocumentInput,
  DbDocument,
  ListDocumentsParams,
} from '../types/models';

const documentColumns = `
  id, project_id, submission_id, file_name, original_name, file_path,
  file_size, mime_type, category, uploaded_by, is_public, created_at
`;

const mapDocument = (row: any): DbDocument => {
  const data = rowToCamelCase(row);
  return {
    id: data.id,
    projectId: data.projectId ?? null,
    submissionId: data.submissionId ?? null,
    fileName: data.fileName,
    originalName: data.originalName,
    filePath: data.filePath,
    fileSize: Number(data.fileSize ?? 0),
    mimeType: data.mimeType,
    category: data.category,
    uploadedBy: data.uploadedBy,
    isPublic: Boolean(data.isPublic),
    createdAt: new Date(data.createdAt),
  };
};

const buildWhereClause = (options: Partial<ListDocumentsParams>) => {
  const clauses: string[] = [];
  const params: any[] = [];

  if (options.projectId) {
    params.push(options.projectId);
    clauses.push(`project_id = $${params.length}`);
  }
  if (options.submissionId) {
    params.push(options.submissionId);
    clauses.push(`submission_id = $${params.length}`);
  }
  if (options.category) {
    params.push(options.category);
    clauses.push(`category = $${params.length}`);
  }
  if (options.uploadedBy) {
    params.push(options.uploadedBy);
    clauses.push(`uploaded_by = $${params.length}`);
  }
  if (options.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    const idx = params.length;
    clauses.push(`(LOWER(original_name) LIKE $${idx} OR LOWER(file_name) LIKE $${idx})`);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereClause, params };
};

export const documentRepository = {
  async listWithFilters(options: ListDocumentsParams): Promise<{ documents: DbDocument[]; total: number }> {
    const { whereClause, params } = buildWhereClause(options);

    const totalResult = await query(`SELECT COUNT(*) FROM documents ${whereClause}`, params);
    const total = parseInt(totalResult.rows[0]?.count || '0', 10);

    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;
    const limit = options.limit;
    const offset = (options.page - 1) * options.limit;

    const dataParams = [...params, limit, offset];
    const result = await query(
      `SELECT ${documentColumns}
       FROM documents
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${limitIndex}
       OFFSET $${offsetIndex}`,
      dataParams
    );

    return {
      documents: result.rows.map(mapDocument),
      total,
    };
  },

  async listByProject(projectId: string, category?: string | null): Promise<DbDocument[]> {
    const params: any[] = [projectId];
    let where = 'project_id = $1';
    if (category) {
      params.push(category);
      where += ` AND category = $2`;
    }
    const result = await query(
      `SELECT ${documentColumns}
       FROM documents
       WHERE ${where}
       ORDER BY created_at DESC`,
      params
    );
    return result.rows.map(mapDocument);
  },

  async listBySubmission(submissionId: string): Promise<DbDocument[]> {
    const result = await query(
      `SELECT ${documentColumns}
       FROM documents
       WHERE submission_id = $1
       ORDER BY created_at DESC`,
      [submissionId]
    );
    return result.rows.map(mapDocument);
  },

  async findById(id: string): Promise<DbDocument | null> {
    const result = await query(`SELECT ${documentColumns} FROM documents WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapDocument(result.rows[0]);
  },

  async create(data: CreateDocumentInput): Promise<DbDocument> {
    const result = await query(
      `INSERT INTO documents (
        project_id, submission_id, file_name, original_name, file_path,
        file_size, mime_type, category, uploaded_by, is_public
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
      ) RETURNING ${documentColumns}`,
      [
        data.projectId ?? null,
        data.submissionId ?? null,
        data.fileName,
        data.originalName,
        data.filePath,
        data.fileSize,
        data.mimeType,
        data.category,
        data.uploadedBy,
        data.isPublic ?? false,
      ]
    );

    return mapDocument(result.rows[0]);
  },

  async delete(id: string): Promise<void> {
    await query('DELETE FROM documents WHERE id = $1', [id]);
  },
};

export default documentRepository;
