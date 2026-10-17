import request from 'supertest';
import app from '../../server';
import bcrypt from 'bcryptjs';
import userRepository from '../../repositories/userRepository';
import { projectRepository } from '../../repositories/projectRepository';
import { contractorRepository } from '../../repositories/contractorRepository';
import * as database from '../../config/database';

jest.mock('../../repositories/userRepository', () => ({
  __esModule: true,
  default: {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    updateLastLogin: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updatePassword: jest.fn(),
  }
}));

jest.mock('../../repositories/projectRepository', () => ({
  projectRepository: {
    listWithFilters: jest.fn(),
    findById: jest.fn(),
    getMilestones: jest.fn(),
    getRecentSubmissions: jest.fn(),
    getContractorSummary: jest.fn(),
    create: jest.fn(),
  }
}));

jest.mock('../../repositories/contractorRepository', () => ({
  contractorRepository: {
    findById: jest.fn(),
  }
}));

jest.mock('../../config/database', () => ({
  query: jest.fn(),
  rowToCamelCase: (row: any) => row,
}));

const mockedUserRepo = userRepository as jest.Mocked<typeof userRepository>;
const mockedProjectRepo = projectRepository as jest.Mocked<typeof projectRepository>;
const mockedContractorRepo = contractorRepository as jest.Mocked<typeof contractorRepository>;
const queryMock = database.query as jest.Mock;

describe('API Integration Tests', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Create a test user
    userId = 'test-user-123';
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const mockUser = {
      id: userId,
      email: 'test@example.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      role: 'GOVERNMENT_ADMIN',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockedUserRepo.findByEmail.mockResolvedValue(mockUser as any);
    mockedUserRepo.findById.mockResolvedValue(mockUser as any);
    mockedUserRepo.updateLastLogin.mockResolvedValue(undefined as any);

    // Login to get token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.data.token;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Flow', () => {
    it('should complete full authentication flow', async () => {
      // Test login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.data.token).toBeDefined();

      const token = loginResponse.body.data.token;

      // Test profile access
      const profileResponse = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.data.user.email).toBe('test@example.com');
    });
  });

  describe('Projects API', () => {
    beforeEach(() => {
      const project = {
        id: 'project-123',
        name: 'Test Project',
        description: 'Test Description',
        category: 'TRANSPORTATION',
        lga: ['Aba North'],
        status: 'IN_PROGRESS',
        progress: 50,
        budget: 1000000,
        isPublic: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        contractorId: 'contractor-1',
      } as any;

      mockedProjectRepo.listWithFilters.mockResolvedValue({ projects: [project], total: 1 } as any);
      mockedProjectRepo.findById.mockResolvedValue(project);
      mockedProjectRepo.getMilestones.mockResolvedValue([] as any);
      mockedProjectRepo.getRecentSubmissions.mockResolvedValue([] as any);
      mockedProjectRepo.create.mockResolvedValue(project);
      mockedContractorRepo.findById.mockResolvedValue({ id: 'contractor-1', companyName: 'Contractor', rating: 4 } as any);
    });

    it('should get projects list', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.projects).toBeDefined();
    });

    it('should get project by ID', async () => {
      const response = await request(app)
        .get('/api/projects/project-123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.project).toBeDefined();
    });

    it('should create new project (admin only)', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Test Project',
          description: 'New Test Description',
          category: 'HEALTHCARE',
          lga: 'Umuahia North',
          budget: 2000000,
          fundingSource: 'State Budget',
          startDate: '2024-01-01',
          expectedEndDate: '2024-12-31'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.project).toBeDefined();
    });
  });

  describe('Public API', () => {
    beforeEach(() => {
      const publicProject = {
        id: 'public-project-123',
        name: 'Public Test Project',
        description: 'Public Test Description',
        category: 'EDUCATION',
        lga: ['Aba South'],
        status: 'IN_PROGRESS',
        progress: 75,
        budget: 1500000,
        isPublic: true,
        contractorId: 'contractor-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      mockedProjectRepo.findById.mockResolvedValue(publicProject);
      mockedProjectRepo.getMilestones.mockResolvedValue([] as any);
      mockedProjectRepo.getContractorSummary.mockResolvedValue({
        id: 'contractor-1',
        companyName: 'Public Contractor',
        rating: 4,
      } as any);

      queryMock.mockResolvedValueOnce({ rows: [{
        id: 'public-project-123',
        name: 'Public Test Project',
        description: 'Public Test Description',
        category: 'EDUCATION',
        lga: ['Aba South'],
        status: 'IN_PROGRESS',
        progress: 75,
        budget: 1500000,
        is_public: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }], rowCount: 1 });
      queryMock.mockResolvedValue({ rows: [], rowCount: 0 });
    });

    it('should get public projects without authentication', async () => {
      const response = await request(app)
        .get('/api/public/projects');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.projects).toBeDefined();
    });

    it('should get public project details', async () => {
      const response = await request(app)
        .get('/api/public/projects/public-project-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.project).toBeDefined();
    });

    it('should get public statistics', async () => {
      const response = await request(app)
        .get('/api/public/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should handle 401 for protected routes without token', async () => {
      const response = await request(app)
        .get('/api/projects');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
