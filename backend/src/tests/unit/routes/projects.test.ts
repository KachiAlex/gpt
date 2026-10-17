import request from 'supertest';
import express from 'express';
import projectRoutes from '../../../routes/projects';
import jwt from 'jsonwebtoken';
import { projectRepository } from '../../../repositories/projectRepository';
import { contractorRepository } from '../../../repositories/contractorRepository';
import * as database from '../../../config/database';

jest.mock('../../../config', () => ({
  config: {
    jwtSecret: 'test-secret-key'
  }
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
  }
}));

jest.mock('../../../repositories/contractorRepository', () => ({
  contractorRepository: {
    findById: jest.fn(),
  }
}));

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
  rowToCamelCase: (row: any) => row,
}));

const mockedProjectRepo = projectRepository as jest.Mocked<typeof projectRepository>;
const mockedContractorRepo = contractorRepository as jest.Mocked<typeof contractorRepository>;
const queryMock = database.query as jest.Mock;

const app = express();
app.use(express.json());
app.use('/api/projects', projectRoutes);

const signToken = (payload: any) => jwt.sign(payload, 'test-secret-key');

describe('Projects Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects', () => {
    it('returns projects list', async () => {
      const mockProjects = [{ id: 'p1', name: 'Test', description: 'Desc', lga: ['Aba'], budget: 1, progress: 0, status: 'IN_PROGRESS' } as any];
      mockedProjectRepo.listWithFilters.mockResolvedValue({ projects: mockProjects as any, total: mockProjects.length });

      const token = signToken({ userId: 'u1', role: 'GOVERNMENT_ADMIN' });
      const res = await request(app).get('/api/projects').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.projects)).toBe(true);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('returns project by id', async () => {
      const project = { id: 'p1', name: 'P', description: 'D', lga: ['A'], budget: 1, progress: 0, status: 'IN_PROGRESS', contractorId: 'c1' } as any;
      mockedProjectRepo.findById.mockResolvedValue(project);
      mockedProjectRepo.getMilestones.mockResolvedValue([] as any);
      mockedProjectRepo.getRecentSubmissions.mockResolvedValue([] as any);
      mockedContractorRepo.findById.mockResolvedValue({ id: 'c1', companyName: 'Co', rating: 4 } as any);

      const token = signToken({ userId: 'u1', role: 'GOVERNMENT_ADMIN' });
      const res = await request(app).get('/api/projects/p1').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.project.id).toBe('p1');
    });
  });

  describe('POST /api/projects', () => {
    it('creates project as admin', async () => {
      mockedProjectRepo.create.mockResolvedValue({ id: 'p1', name: 'N' } as any);

      const token = signToken({ userId: 'u1', role: 'GOVERNMENT_ADMIN' });
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'N', description: 'D', category: 'HEALTHCARE', lga: ['A'], budget: 1, fundingSource: 'X', startDate: '2024-01-01', expectedEndDate: '2024-12-31'
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/projects/stats', () => {
    it('returns project stats', async () => {
      const projects = [{ status: 'IN_PROGRESS', budget: 1, allocatedBudget: 1, spentBudget: 0, progress: 50 }];
      queryMock.mockResolvedValue({ rows: projects });
      const token = signToken({ userId: 'u1', role: 'GOVERNMENT_ADMIN' });
      const res = await request(app).get('/api/projects/stats').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stats.total).toBeDefined();
    });
  });
});
