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
import seedRoutes from './routes/seed';

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/contractors', contractorRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/instance', instanceRoutes);
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
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join user to their personal room for notifications
  socket.on('join-user-room', (userId: string) => {
    socket.join(`user-${userId}`);
  });

  // Join project room for real-time updates
  socket.on('join-project-room', (projectId: string) => {
    socket.join(`project-${projectId}`);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || config.port;
httpServer.listen(PORT, () => {
  console.log(`🚀 GPT API Server running on port ${PORT}`);
  console.log(`📱 Environment: ${config.nodeEnv}`);
  console.log(`🗄️ Database: PostgreSQL`);
  console.log(`🌐 CORS Origin: ${config.corsOrigin.join(', ')}`);
});

export { io };
export default app;
