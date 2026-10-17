import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * PostgreSQL Database Connection
 * Supports both Render PostgreSQL and standard PostgreSQL connections
 */

// Parse database URL (DATABASE_URL) or fall back to individual DB_* vars.
// SSL is opt-in via DB_SSL=true or ?sslmode=require|verify-* in DATABASE_URL;
// Docker Compose's internal postgres does not speak TLS.
const wantsSsl = (databaseUrl?: string): boolean =>
  process.env.DB_SSL === 'true' ||
  (typeof databaseUrl === 'string' && /sslmode=(require|verify-ca|verify-full)/.test(databaseUrl));

const getDatabaseConfig = (): PoolConfig => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    // Parse DATABASE_URL format: postgresql://user:password@host:port/database
    // or postgres://user:password@host:port/database
    const url = new URL(databaseUrl);
    
    return {
      user: url.username,
      password: url.password,
      host: url.hostname,
      port: parseInt(url.port || '5432', 10),
      database: url.pathname.slice(1), // Remove leading '/'
      ssl: wantsSsl(databaseUrl) ? { rejectUnauthorized: false } : false,
    };
  }
  
  // Fallback to individual environment variables
  return {
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'abt_tracker',
    ssl: wantsSsl() ? { rejectUnauthorized: false } : false,
  };
};

// Create connection pool
const pool = new Pool(getDatabaseConfig());

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Database connected successfully');
  }
});

/**
 * Execute a query
 */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('Executed query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
};

/**
 * Get a client from the pool for transactions
 */
export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

/**
 * Helper to convert camelCase to snake_case for database columns
 */
export const toSnakeCase = (str: string): string => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
};

/**
 * Helper to convert snake_case to camelCase for JavaScript objects
 */
export const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * Convert database row (snake_case) to JavaScript object (camelCase)
 */
export const rowToCamelCase = (row: any): any => {
  if (!row || typeof row !== 'object') return row;
  
  const camelCaseRow: any = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = toCamelCase(key);
    camelCaseRow[camelKey] = value;
  }
  return camelCaseRow;
};

/**
 * Convert JavaScript object (camelCase) to database row (snake_case)
 */
export const objectToSnakeCase = (obj: any): any => {
  if (!obj || typeof obj !== 'object') return obj;
  
  const snakeCaseObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);
    snakeCaseObj[snakeKey] = value;
  }
  return snakeCaseObj;
};

export default pool;

