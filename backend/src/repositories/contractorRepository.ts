import { query, rowToCamelCase, objectToSnakeCase } from '../config/database';
import {
  ContractorStats,
  ContractorWithUser,
  CreateContractorInput,
  DbContractorProfile,
  ListContractorsParams,
  UpdateContractorInput,
} from '../types/models';

const contractorColumns = `
  id, user_id, company_name, registration_no, contact_person,
  company_email, company_phone, company_address, rating, is_verified,
  is_certified, years_experience, specialization, created_at, updated_at
`;

const mapContractor = (row: any): DbContractorProfile => {
  const contractor = rowToCamelCase(row);
  return {
    ...contractor,
    specialization: contractor.specialization || [],
    yearsExperience: contractor.yearsExperience ?? null,
    createdAt: new Date(contractor.createdAt),
    updatedAt: new Date(contractor.updatedAt),
  };
};

const mapContractorWithUser = (row: any): ContractorWithUser => {
  const contractor = mapContractor(row);
  const user = row.user_id_ref
    ? {
        id: row.user_id_ref,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        isActive: row.is_active,
      }
    : null;

  return {
    ...contractor,
    user,
  };
};

const buildFilterClause = (options: ListContractorsParams) => {
  const clauses: string[] = [];
  const params: any[] = [];

  if (options.verified !== undefined) {
    params.push(options.verified);
    clauses.push(`cp.is_verified = $${params.length}`);
  }
  if (options.certified !== undefined) {
    params.push(options.certified);
    clauses.push(`cp.is_certified = $${params.length}`);
  }
  if (options.specialization) {
    params.push([options.specialization]);
    clauses.push(`cp.specialization @> $${params.length}`);
  }
  if (options.search) {
    params.push(`%${options.search.toLowerCase()}%`);
    const idx = params.length;
    clauses.push(`(
      LOWER(cp.company_name) LIKE $${idx}
      OR LOWER(cp.contact_person) LIKE $${idx}
      OR LOWER(cp.company_email) LIKE $${idx}
    )`);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return { whereClause, params };
};

export const contractorRepository = {
  async listWithFilters(options: ListContractorsParams): Promise<{ contractors: ContractorWithUser[]; total: number; }> {
    const { whereClause, params } = buildFilterClause(options);

    const totalResult = await query(
      `SELECT COUNT(*) FROM contractor_profiles cp ${whereClause}`,
      params
    );

    const limit = options.limit;
    const offset = (options.page - 1) * options.limit;

    const dataParams = [...params, limit, offset];
    const contractorsResult = await query(
      `SELECT cp.${contractorColumns.replace(/\s+/g, ' ')},
        u.id as user_id_ref,
        u.first_name, u.last_name, u.email, u.phone, u.is_active
       FROM contractor_profiles cp
       LEFT JOIN users u ON cp.user_id = u.id
       ${whereClause}
       ORDER BY cp.created_at DESC
       LIMIT $${dataParams.length - 1}
       OFFSET $${dataParams.length}`,
      dataParams
    );

    return {
      contractors: contractorsResult.rows.map(mapContractorWithUser),
      total: parseInt(totalResult.rows[0].count, 10),
    };
  },

  async findById(id: string): Promise<DbContractorProfile | null> {
    const result = await query(`SELECT ${contractorColumns} FROM contractor_profiles WHERE id = $1`, [id]);
    if (result.rows.length === 0) return null;
    return mapContractor(result.rows[0]);
  },

  async findByUserId(userId: string): Promise<DbContractorProfile | null> {
    const result = await query(`SELECT ${contractorColumns} FROM contractor_profiles WHERE user_id = $1`, [userId]);
    if (result.rows.length === 0) return null;
    return mapContractor(result.rows[0]);
  },

  async findByRegistrationNo(registrationNo: string): Promise<DbContractorProfile | null> {
    const result = await query(
      `SELECT ${contractorColumns} FROM contractor_profiles WHERE registration_no = $1`,
      [registrationNo]
    );
    if (result.rows.length === 0) return null;
    return mapContractor(result.rows[0]);
  },

  async create(data: CreateContractorInput): Promise<DbContractorProfile> {
    const result = await query(
      `INSERT INTO contractor_profiles (
        user_id, company_name, registration_no, contact_person, company_email,
        company_phone, company_address, rating, is_verified, is_certified,
        years_experience, specialization
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,0,false,false,$8,$9
      ) RETURNING ${contractorColumns}`,
      [
        data.userId,
        data.companyName,
        data.registrationNo,
        data.contactPerson,
        data.companyEmail,
        data.companyPhone,
        data.companyAddress,
        data.yearsExperience ?? null,
        data.specialization,
      ]
    );

    return mapContractor(result.rows[0]);
  },

  async update(id: string, updates: UpdateContractorInput): Promise<DbContractorProfile | null> {
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
      `UPDATE contractor_profiles SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING ${contractorColumns}`,
      values
    );

    if (result.rows.length === 0) return null;
    return mapContractor(result.rows[0]);
  },

  async delete(id: string): Promise<void> {
    await query('DELETE FROM contractor_profiles WHERE id = $1', [id]);
  },

  async getWithUser(id: string): Promise<ContractorWithUser | null> {
    const result = await query(
      `SELECT cp.${contractorColumns.replace(/\s+/g, ' ')},
        u.id as user_id_ref,
        u.first_name, u.last_name, u.email, u.phone, u.is_active
       FROM contractor_profiles cp
       LEFT JOIN users u ON cp.user_id = u.id
       WHERE cp.id = $1`,
      [id]
    );

    if (result.rows.length === 0) return null;

    return mapContractorWithUser(result.rows[0]);
  },

  async getStats(id: string): Promise<ContractorStats> {
    const projectsResult = await query(
      `SELECT status, budget, spent_budget::numeric, progress
       FROM projects
       WHERE contractor_id = $1`,
      [id]
    );

    const submissionsResult = await query(
      `SELECT status
       FROM submissions
       WHERE contractor_id = $1`,
      [id]
    );

    const projects = projectsResult.rows.map(rowToCamelCase) as any[];
    const submissions = submissionsResult.rows.map(rowToCamelCase) as any[];

    const totalProjects = projects.length;
    const completedProjects = projects.filter((p) => p.status === 'COMPLETED').length;
    const activeProjects = projects.filter((p) => p.status === 'IN_PROGRESS').length;
    const totalSubmissions = submissions.length;
    const approvedSubmissions = submissions.filter((s) => s.status === 'APPROVED').length;
    const pendingSubmissions = submissions.filter((s) => s.status === 'PENDING').length;
    const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0);
    const spentBudget = projects.reduce((sum, p) => sum + Number(p.spentBudget || 0), 0);
    const averageProjectProgress = totalProjects > 0
      ? projects.reduce((sum, p) => sum + Number(p.progress || 0), 0) / totalProjects
      : 0;

    return {
      totalProjects,
      completedProjects,
      activeProjects,
      totalSubmissions,
      approvedSubmissions,
      pendingSubmissions,
      totalBudget,
      spentBudget,
      averageProjectProgress,
    };
  },
};

export default contractorRepository;
