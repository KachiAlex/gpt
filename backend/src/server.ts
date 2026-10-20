import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';

import { config } from './config';
import pool from './config/database';

const app = express();
const httpServer = createServer(app);

// Trust the nginx loopback hop so req.ip reflects the real client —
// without this every request rates as 127.0.0.1 and all users share one
// rate-limit bucket.
app.set('trust proxy', 'loopback');

// CORS origin matcher: supports exact origins and "*.domain.com" wildcard
// suffixes (e.g. "*.vercel.app" covers all Vercel preview/prod URLs).
const isAllowedOrigin = (origin: string, allowed: string[]): boolean =>
  allowed.some(
    (o) =>
      o === '*' ||
      o === origin ||
      (o.startsWith('*.') && (origin === o.slice(2) || origin.endsWith(o.slice(1))))
  );

const corsOriginChecker = (allowed: string[]) =>
  (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
    // Non-browser requests (curl, server-to-server) carry no Origin header
    if (!origin || isAllowedOrigin(origin, allowed)) return cb(null, true);
    return cb(null, false);
  };

// Socket.IO setup
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOriginChecker(config.socketCorsOrigin),
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Make io accessible in routes
app.set('io', io);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: corsOriginChecker(config.corsOrigin),
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxRequests,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});
app.use('/api/', limiter);

// Credential endpoints get a much tighter bucket — the global limiter is far
// too permissive for online password guessing and reset-token probing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts, please try again in a few minutes.',
  },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/mfa', authLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Logging middleware
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Public uploads (profile images etc.) - private files go through
// the authenticated /api/files/download/:id endpoint instead.
app.use('/uploads/public', express.static(path.resolve(config.uploadPath, 'public')));

// Health check endpoint
app.get('/health', async (_req: express.Request, res: express.Response) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      success: true,
      message: 'GPT API is running',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
      database: 'PostgreSQL',
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Database connection failed',
      timestamp: new Date().toISOString(),
      environment: config.nodeEnv,
    });
  }
});

// Import API routes
import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import contractorRoutes from './routes/contractors';
import submissionRoutes from './routes/submissions';
import dashboardRoutes from './routes/dashboard';
import publicRoutes from './routes/public';
import fileRoutes from './routes/files';
import userRoutes from './routes/users';
import reportRoutes from './routes/reports';
import instanceRoutes from './routes/instance';
import auditRoutes from './routes/audit';
import { requireFeature } from './services/featureFlags';
import seedRoutes from './routes/seed';

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/public', requireFeature('publicPortal'), publicRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', requireFeature('reports'), reportRoutes);
app.use('/api/instance', instanceRoutes);
app.use('/api/audit-log', auditRoutes);
// Seed endpoint: disabled in production unless explicitly re-enabled
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SEED_ROUTE === 'true') {
  app.use('/api/seed', seedRoutes);
}

// 404 handler
app.use((_req: express.Request, res: express.Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    // 4xx messages are safe to surface; 5xx messages may leak internals
    message: status < 500 ? (err.message || 'Request failed') : 'Internal server error',
  });
});

// Socket.IO authentication — clients must present the same JWT used for the
// REST API in the handshake (`auth.token`). Rooms are derived from the
// verified token, never from client-supplied IDs.
import jwt from 'jsonwebtoken';

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== 'string' || !token) {
    return next(new Error('Authentication required'));
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId?: string; role?: string; purpose?: string };
    if (!payload.userId || payload.purpose) {
      return next(new Error('Invalid token'));
    }
    socket.data.user = { userId: payload.userId, role: payload.role };
    return next();
  } catch {
    return next(new Error('Invalid token'));
  }
});

const GOV_SOCKET_ROLES = new Set(['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER']);

io.on('connection', (socket) => {
  const user = socket.data.user as { userId: string; role?: string };
  // Personal notification room comes straight from the verified token —
  // no client-supplied id, so nobody can subscribe to another user.
  socket.join(`user-${user.userId}`);
  if (GOV_SOCKET_ROLES.has(user.role ?? '')) socket.join('role-gov');

  // Project rooms are for government staff only; contractors receive
  // submission events through their personal room instead.
  socket.on('join-project-room', async (projectId: string) => {
    if (typeof projectId !== 'string' || !GOV_SOCKET_ROLES.has(user.role ?? '')) return;
    socket.join(`project-${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server — only when run directly, not when imported by tests
// (supertest spins up its own ephemeral listener on the app).
const PORT = process.env.PORT || config.port;
if (require.main === module) {
  httpServer.listen(PORT, () => {
    console.log(`🚀 GPT API Server running on port ${PORT}`);
    console.log(`📱 Environment: ${config.nodeEnv}`);
    console.log(`🗄️ Database: PostgreSQL`);
    console.log(`🌐 CORS Origin: ${config.corsOrigin.join(', ')}`);
  });
}

export { io };
export default app;
