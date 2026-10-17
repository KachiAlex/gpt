import { query, rowToCamelCase } from '../config/database';
import {
  CreateReportInput,
  DbReport,
  ListReportsParams,
} from '../types/models';

const reportColumns = `
  r.id, r.title, r.type, r.category, r.generated_by, r.start_date, r.end_date,
  r.data, r.file_path, r.file_size, r.is_public, r.downloads, r.created_at,
  u.first_name AS generator_first_name, u.last_name AS generator_last_name,
  u.email AS generator_email
`;

const mapReport = (row: any): DbReport => {
  const data = rowToCamelCase(row);
  const first = row.generator_first_name || '';
  const last = row.generator_last_name || '';
  return {
    id: data.id,
    title: data.title,
    type: data.type,
    category: data.category ?? null,
    generatedBy: data.generatedBy,
    generatedByName: `${first} ${last}`.trim() || row.generator_email || null,
    startDate: data.startDate ? new Date(data.startDate) : null,
    endDate: data.endDate ? new Date(data.endDate) : null,
    data: data.data ?? null,
    filePath: data.filePath ?? null,
    fileSize: data.fileSize !== null && data.fileSize !== undefined ? Number(data.fileSize) : null,
    isPublic: Boolean(data.isPublic),
    downloads: Number(data.downloads ?? 0),
    createdAt: new Date(data.createdAt),
  };
};

const buildWhereClause = (options: Partial<ListReportsParams>) => {
  const clauses: string[] = [];
  const params: any[] = [];

  if (options.type) {
    params.push(options.type);
    clauses.push(`r.type = $${params.length}`);
  }
  if (options.category) {
    params.push(options.category);
    clauses.push(`r.category = $${params.length}`);
  }
  if (options.generatedBy) {
    params.push(options.generatedBy);
    clauses.push(`r.generated_by = $${params.length}`);
  }
  if (options.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    clauses.push(`LOWER(r.title) LIKE $${params.length}`);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereClause, params };
};

export const reportRepository = {
  async listWithFilters(options: ListReportsParams): Promise<{ reports: DbReport[]; total: number }> {
    const { whereClause, params } = buildWhereClause(options);

    const totalResult = await query(`SELECT COUNT(*) FROM reports r ${whereClause}`, params);
    const total = parseInt(totalResult.rows[0]?.count || '0', 10);

    const limitIndex = params.length + 1;
    const offsetIndex = params.length + 2;
    const offset = (options.page - 1) * options.limit;

    const result = await query(
      `SELECT ${reportColumns}
       FROM reports r
       LEFT JOIN users u ON u.id = r.generated_by
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${limitIndex}
       OFFSET $${offsetIndex}`,
      [...params, options.limit, offset]
    );

    return { reports: result.rows.map(mapReport), total };
  },

  async findById(id: string): Promise<DbReport | null> {
    const result = await query(
      `SELECT ${reportColumns}
       FROM reports r
       LEFT JOIN users u ON u.id = r.generated_by
       WHERE r.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return mapReport(result.rows[0]);
  },

  async create(input: CreateReportInput): Promise<DbReport> {
    const payload = input.data ?? null;
    const fileSize = payload ? Buffer.byteLength(JSON.stringify(payload)) : null;
    const result = await query(
      `INSERT INTO reports (
        title, type, category, generated_by, start_date, end_date, data, file_size, is_public
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        input.title,
        input.type,
        input.category ?? null,
        input.generatedBy,
        input.startDate ?? null,
        input.endDate ?? null,
        payload ? JSON.stringify(payload) : null,
        fileSize,
        input.isPublic ?? false,
      ]
    );
    const created = await this.findById(result.rows[0].id);
    if (!created) throw new Error('Failed to create report');
    return created;
  },

  async incrementDownloads(id: string): Promise<void> {
    await query('UPDATE reports SET downloads = downloads + 1 WHERE id = $1', [id]);
  },

  async delete(id: string): Promise<void> {
    await query('DELETE FROM reports WHERE id = $1', [id]);
  },
};

export default reportRepository;
