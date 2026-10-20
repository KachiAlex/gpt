/**
 * Authorization-boundary regression tests.
 *
 * Each of these pins a bug found in the platform audit so it can't silently
 * come back: query-param tokens, MFA challenge tokens used as sessions,
 * stale JWT roles, contractor cross-project writes, status bypass on the
 * generic submissions update, and contractor self-verification.
 */
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, requireRoles } from '../../../middleware/auth';
import { installAuthAwareQueryMock } from '../../helpers/mockAuthQuery';
import * as database from '../../../config/database';
import projectRoutes from '../../../routes/projects';
import submissionRoutes from '../../../routes/submissions';
import contractorRoutes from '../../../routes/contractors';
import { projectRepository } from '../../../repositories/projectRepository';
import { contractorRepository } from '../../../repositories/contractorRepository';
import { submissionRepository } from '../../../repositories/submissionRepository';
import '../../../repositories/notificationRepository';
import '../../../repositories/userRepository';

jest.mock('../../../config', () => ({
  config: {
    jwtSecret: 'test-secret-key',
    uploadPath: '/tmp/test-uploads',
    maxFileSize: 10 * 1024 * 1024,
  },
}));

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
  rowToCamelCase: (row: any) => row,
  objectToSnakeCase: (obj: any) => obj,
}));

jest.mock('../../../repositories/projectRepository', () => ({
  projectRepository: {
    listWithFilters: jest.fn(),
    findById: jest.fn(),
    getMilestones: jest.fn(),
    getRecentSubmissions: jest.fn(),
    getContractorSummary: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    recomputeProjectProgress: jest.fn(),
  },
}));

jest.mock('../../../repositories/contractorRepository', () => ({
  contractorRepository: {
    findById: jest.fn(),
    findByUserId: jest.fn(),
    getWithUser: jest.fn(),
    listWithFilters: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../../repositories/submissionRepository', () => ({
  submissionRepository: {
    findById: jest.fn(),
    listWithFilters: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    transition: jest.fn(),
  },
}));

jest.mock('../../../repositories/notificationRepository', () => ({
  notificationRepository: {
    create: jest.fn(),
    createForRole: jest.fn(),
    listByUser: jest.fn(),
  },
}));

jest.mock('../../../repositories/userRepository', () => ({
  userRepository: {
    findById: jest.fn(),
    findByEmail: jest.fn(),
  },
}));

const queryMock = database.query as jest.Mock;
const mockedProjectRepo = projectRepository as jest.Mocked<typeof projectRepository>;
const mockedContractorRepo = contractorRepository as jest.Mocked<typeof contractorRepository>;
const mockedSubmissionRepo = submissionRepository as jest.Mocked<typeof submissionRepository>;

const signToken = (payload: any) =>
  jwt.sign(payload, 'test-secret-key');

const asUser = (role: string, extra: any = {}) => ({
  userId: 'u1',
  email: 'u@test.gov',
  role,
  ...extra,
});

const activeUser = (role: string) => ({ is_active: true, role });

// ─── middleware ─────────────────────────────────────────────────────────────

const probe = express();
probe.use(express.json());
probe.get('/probe', authenticate, (_req, res) => res.json({ ok: true }));
probe.get('/probe-admin', authenticate, requireRoles('GOVERNMENT_ADMIN'), (_req, res) => res.json({ ok: true }));

describe('authenticate middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installAuthAwareQueryMock(queryMock);
  });

  it('rejects requests with no token', async () => {
    const res = await request(probe).get('/probe');
    expect(res.status).toBe(401);
  });

  it('rejects ?token= query params — tokens must not ride URLs into logs', async () => {
    const token = signToken(asUser('GOVERNMENT_ADMIN'));
    const res = await request(probe).get(`/probe?token=${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects MFA challenge tokens (purpose-scoped, not a session)', async () => {
    const token = signToken({ userId: 'u1', role: 'GOVERNMENT_ADMIN', purpose: 'mfa' });
    const res = await request(probe).get('/probe').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects deactivated accounts even with a valid token', async () => {
    installAuthAwareQueryMock(queryMock, { is_active: false, role: 'GOVERNMENT_ADMIN' });
    const token = signToken(asUser('GOVERNMENT_ADMIN'));
    const res = await request(probe).get('/probe').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects tokens for deleted/missing accounts', async () => {
    installAuthAwareQueryMock(queryMock, null);
    const token = signToken(asUser('GOVERNMENT_ADMIN'));
    const res = await request(probe).get('/probe').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('uses the live DB role, not the role claimed by the token', async () => {
    // Token claims admin, but the account was demoted to PUBLIC — must 403.
    installAuthAwareQueryMock(queryMock, { is_active: true, role: 'PUBLIC' });
    const token = signToken(asUser('GOVERNMENT_ADMIN'));
    const res = await request(probe).get('/probe-admin').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('passes through a valid session token', async () => {
    const token = signToken(asUser('GOVERNMENT_ADMIN'));
    const res = await request(probe).get('/probe').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ─── PUT /api/projects/:id ──────────────────────────────────────────────────

const projectsApp = express();
projectsApp.use(express.json());
projectsApp.use('/api/projects', projectRoutes);

describe('PUT /api/projects/:id — contractor boundary', () => {
  const project = {
    id: 'p1',
    name: 'Road',
    status: 'IN_PROGRESS',
    contractorId: 'c-assigned',
    projectManagerId: null,
    lga: ['Aba'],
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    installAuthAwareQueryMock(queryMock, activeUser('CONTRACTOR'));
    mockedProjectRepo.findById.mockResolvedValue(project);
    mockedProjectRepo.update.mockResolvedValue(project);
  });

  it('a contractor cannot update a project assigned to another contractor', async () => {
    mockedContractorRepo.findByUserId.mockResolvedValue({ id: 'c-other', userId: 'u1' } as any);
    const token = signToken(asUser('CONTRACTOR'));
    const res = await request(projectsApp)
      .put('/api/projects/p1')
      .set('Authorization', `Bearer ${token}`)
      .send({ weatherDelay: 3 });
    expect(res.status).toBe(403);
    expect(mockedProjectRepo.update).not.toHaveBeenCalled();
  });

  it('the assigned contractor can update only whitelisted fields', async () => {
    mockedContractorRepo.findByUserId.mockResolvedValue({ id: 'c-assigned', userId: 'u1' } as any);
    const token = signToken(asUser('CONTRACTOR'));
    const res = await request(projectsApp)
      .put('/api/projects/p1')
      .set('Authorization', `Bearer ${token}`)
      .send({ weatherDelay: 5, status: 'COMPLETED', budget: 999, contractorId: 'c-other' });
    expect(res.status).toBe(200);
    expect(mockedProjectRepo.update).toHaveBeenCalledWith('p1', { weatherDelay: 5 });
  });

  it('an unassigned non-contractor non-admin cannot update at all', async () => {
    installAuthAwareQueryMock(queryMock, activeUser('PUBLIC'));
    const token = signToken(asUser('PUBLIC'));
    const res = await request(projectsApp)
      .put('/api/projects/p1')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Hijack' });
    expect(res.status).toBe(403);
    expect(mockedProjectRepo.update).not.toHaveBeenCalled();
  });

  it('admin updates still pass the admin whitelist', async () => {
    installAuthAwareQueryMock(queryMock, activeUser('GOVERNMENT_ADMIN'));
    const token = signToken(asUser('GOVERNMENT_ADMIN'));
    const res = await request(projectsApp)
      .put('/api/projects/p1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'ON_HOLD', budget: 42, isPublic: true, financialStatus: 'RECONCILED' });
    expect(res.status).toBe(200);
    // isPublic/financialStatus are NOT in the whitelist — dedicated endpoints own them
    expect(mockedProjectRepo.update).toHaveBeenCalledWith('p1', { status: 'ON_HOLD', budget: 42 });
  });
});

// ─── PUT /api/submissions/:id ───────────────────────────────────────────────

const submissionsApp = express();
submissionsApp.use(express.json());
submissionsApp.use('/api/submissions', submissionRoutes);

describe('PUT /api/submissions/:id — no status bypass', () => {
  const submission = {
    id: 's1',
    projectId: 'p1',
    contractorId: 'c1',
    status: 'PENDING',
    title: 'Progress report',
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedSubmissionRepo.findById.mockResolvedValue(submission);
    mockedSubmissionRepo.update.mockResolvedValue(submission);
  });

  it('a contractor cannot self-approve via the generic update', async () => {
    installAuthAwareQueryMock(queryMock, activeUser('CONTRACTOR'));
    mockedContractorRepo.findByUserId.mockResolvedValue({ id: 'c1', userId: 'u1' } as any);
    const token = signToken(asUser('CONTRACTOR'));
    const res = await request(submissionsApp)
      .put('/api/submissions/s1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'APPROVED', title: 'Updated' });
    expect(res.status).toBe(200);
    // status is silently dropped — only whitelisted fields persist
    expect(mockedSubmissionRepo.update).toHaveBeenCalledWith('s1', { title: 'Updated' });
  });

  it('a contractor cannot touch another contractor\u2019s submission', async () => {
    installAuthAwareQueryMock(queryMock, activeUser('CONTRACTOR'));
    mockedContractorRepo.findByUserId.mockResolvedValue({ id: 'c-other', userId: 'u1' } as any);
    const token = signToken(asUser('CONTRACTOR'));
    const res = await request(submissionsApp)
      .put('/api/submissions/s1')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Hijack' });
    expect(res.status).toBe(403);
    expect(mockedSubmissionRepo.update).not.toHaveBeenCalled();
  });
});

// ─── contractors: self-verify + profile reads ───────────────────────────────

const contractorsApp = express();
contractorsApp.use(express.json());
contractorsApp.use('/api/contractors', contractorRoutes);

describe('Contractor trust fields + profile reads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('a contractor cannot self-verify/certify/rate via PUT', async () => {
    installAuthAwareQueryMock(queryMock, activeUser('CONTRACTOR'));
    mockedContractorRepo.findById.mockResolvedValue({ id: 'c1', userId: 'u1' } as any);
    mockedContractorRepo.update.mockResolvedValue({ id: 'c1' } as any);

    const token = signToken(asUser('CONTRACTOR'));
    const res = await request(contractorsApp)
      .put('/api/contractors/c1')
      .set('Authorization', `Bearer ${token}`)
      .send({ isVerified: true, isCertified: true, rating: 5, companyName: 'New Name' });
    expect(res.status).toBe(200);
    expect(mockedContractorRepo.update).toHaveBeenCalledWith('c1', { companyName: 'New Name' });
  });

  it('a contractor cannot read a peer\u2019s profile (project lists + budgets)', async () => {
    installAuthAwareQueryMock(queryMock, activeUser('CONTRACTOR'));
    mockedContractorRepo.getWithUser.mockResolvedValue({ id: 'c2', userId: 'someone-else' } as any);

    const token = signToken(asUser('CONTRACTOR'));
    const res = await request(contractorsApp)
      .get('/api/contractors/c2')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('the contractor registry list is not open to contractors', async () => {
    installAuthAwareQueryMock(queryMock, activeUser('CONTRACTOR'));
    const token = signToken(asUser('CONTRACTOR'));
    const res = await request(contractorsApp)
      .get('/api/contractors')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
