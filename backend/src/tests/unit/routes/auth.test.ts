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

jest.mock('../../../repositories/inviteRepository', () => ({
	__esModule: true,
	default: {
		findByToken: jest.fn(),
		consume: jest.fn(),
		stampUsedBy: jest.fn(),
	},
	inviteRepository: {
		findByToken: jest.fn(),
		consume: jest.fn(),
		stampUsedBy: jest.fn(),
	},
}));

jest.mock('../../../repositories/contractorRepository', () => ({
	__esModule: true,
	default: {
		findByRegistrationNo: jest.fn(),
		create: jest.fn(),
	},
}));

const mockedRepo = userRepository as jest.Mocked<typeof userRepository>;
const mockedInviteRepo = (jest.requireMock('../../../repositories/inviteRepository') as any).default;

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

  describe('GET /api/auth/invite/:token', () => {
    it('returns role and email for a valid invite', async () => {
      mockedInviteRepo.findByToken.mockResolvedValue({
        id: 'inv-1',
        role: 'ME_OFFICER',
        email: 'me@example.com',
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        revokedAt: null,
      });

      const response = await request(app).get('/api/auth/invite/some-token');

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe('ME_OFFICER');
      expect(response.body.data.email).toBe('me@example.com');
      expect(response.body.data.token).toBeUndefined();
    });

    it('404s on expired invite', async () => {
      mockedInviteRepo.findByToken.mockResolvedValue({
        id: 'inv-2',
        role: 'ME_OFFICER',
        email: null,
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        revokedAt: null,
      });

      const response = await request(app).get('/api/auth/invite/expired-token');
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/auth/register-invite', () => {
    const validInvite = {
      id: 'inv-3',
      role: 'ME_OFFICER',
      email: null,
      expiresAt: new Date(Date.now() + 86400000),
      usedAt: null,
      revokedAt: null,
    };

    it('creates the user with the invite role and consumes the invite', async () => {
      mockedInviteRepo.findByToken.mockResolvedValue(validInvite);
      mockedRepo.findByEmail.mockResolvedValue(null as any);
      mockedInviteRepo.consume.mockResolvedValue(validInvite);
      mockedRepo.create.mockResolvedValue({
        id: 'u-new', email: 'new@x.com', firstName: 'N', lastName: '', role: 'ME_OFFICER', isActive: true,
      } as any);

      const response = await request(app)
        .post('/api/auth/register-invite')
        .send({ token: 'tok', email: 'new@x.com', password: 'password123', firstName: 'N' });

      expect(response.status).toBe(201);
      expect(mockedRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'ME_OFFICER' })
      );
      expect(mockedInviteRepo.stampUsedBy).toHaveBeenCalledWith('inv-3', 'u-new');
    });

    it('rejects a different email than the invite was pinned to', async () => {
      mockedInviteRepo.findByToken.mockResolvedValue({ ...validInvite, email: 'pinned@x.com' });

      const response = await request(app)
        .post('/api/auth/register-invite')
        .send({ token: 'tok', email: 'other@x.com', password: 'password123', firstName: 'N' });

      expect(response.status).toBe(400);
      expect(mockedRepo.create).not.toHaveBeenCalled();
    });

    it('404s when the invite race is lost (already consumed)', async () => {
      mockedInviteRepo.findByToken.mockResolvedValue(validInvite);
      mockedRepo.findByEmail.mockResolvedValue(null as any);
      mockedInviteRepo.consume.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/register-invite')
        .send({ token: 'tok', email: 'new@x.com', password: 'password123', firstName: 'N' });

      expect(response.status).toBe(404);
      expect(mockedRepo.create).not.toHaveBeenCalled();
    });

    it('requires company fields for contractor invites', async () => {
      mockedInviteRepo.findByToken.mockResolvedValue({ ...validInvite, role: 'CONTRACTOR' });
      mockedRepo.findByEmail.mockResolvedValue(null as any);

      const response = await request(app)
        .post('/api/auth/register-invite')
        .send({ token: 'tok', email: 'c@x.com', password: 'password123', firstName: 'N' });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('companyName');
      expect(mockedRepo.create).not.toHaveBeenCalled();
    });
  });
});
