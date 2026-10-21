import request from 'supertest';
import express from 'express';
import authRoutes from '../../../routes/auth';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import userRepository from '../../../repositories/userRepository';
import * as database from '../../../config/database';
import { installAuthAwareQueryMock } from '../../helpers/mockAuthQuery';

jest.mock('../../../config/database', () => ({
  query: jest.fn(),
  rowToCamelCase: (row: any) => row,
}));

const queryMock = database.query as jest.Mock;

jest.mock('../../../repositories/userRepository', () => ({
	__esModule: true,
	default: {
		findByEmail: jest.fn(),
		findById: jest.fn(),
		updateLastLogin: jest.fn(),
		findContractorProfileId: jest.fn(),
		create: jest.fn(),
		update: jest.fn(),
		updatePassword: jest.fn(),
	}
}));

const mockedRepo = userRepository as jest.Mocked<typeof userRepository>;

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        password: await bcrypt.hash('password123', 10),
        firstName: 'John',
        lastName: 'Doe',
        role: 'CONTRACTOR',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockedRepo.findByEmail.mockResolvedValue(mockUser as any);
      mockedRepo.findContractorProfileId.mockResolvedValue(null as any);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
      expect(response.body.data.token).toBeDefined();
    });

    it('should return 401 for invalid credentials', async () => {
      mockedRepo.findByEmail.mockResolvedValue(null as any);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
          // missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email and password are required');
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should return user profile with valid token', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'CONTRACTOR',
        isActive: true
      };

      const token = jwt.sign(
        { userId: 'user-123', email: 'test@example.com', role: 'CONTRACTOR' },
        'test-secret-key'
      );

      // authenticate's account re-check reads via query(), not the repository
      installAuthAwareQueryMock(queryMock, { is_active: true, role: 'CONTRACTOR' });
      mockedRepo.findById.mockResolvedValue(mockUser as any);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('test@example.com');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should return 401 for missing token', async () => {
      const response = await request(app)
        .get('/api/auth/profile');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user successfully', async () => {
      mockedRepo.findByEmail.mockResolvedValue(null as any);
      mockedRepo.create.mockResolvedValue({
        id: 'new-user',
        email: 'newuser@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        role: 'CONTRACTOR',
        isActive: true,
      } as any);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'CONTRACTOR'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('newuser@example.com');
    });

    it('should return 409 for existing email', async () => {
      mockedRepo.findByEmail.mockResolvedValue({ email: 'existing@example.com' } as any);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'existing@example.com',
          password: 'password123',
          firstName: 'Jane',
          lastName: 'Smith',
          role: 'CONTRACTOR'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('User with this email already exists');
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123'
          // missing firstName, role (lastName is optional)
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Email, password, firstName, and role are required');
    });

    it('should register with a single-word name (lastName optional)', async () => {
      mockedRepo.findByEmail.mockResolvedValue(null as any);
      mockedRepo.create.mockResolvedValue({
        id: 'new-user-2',
        email: 'oneword@example.com',
        firstName: 'Madonna',
        lastName: '',
        role: 'PUBLIC',
        isActive: true,
      } as any);

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'oneword@example.com',
          password: 'password123',
          firstName: 'Madonna',
          lastName: '',
          role: 'PUBLIC'
        });

      expect(response.status).toBe(201);
      expect(mockedRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ lastName: '' })
      );
    });
  });
});
