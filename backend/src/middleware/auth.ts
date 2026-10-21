import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../config/database';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  contractorId?: string;
  tv?: number;
}

/**
 * Extract the bearer token from the Authorization header.
 * No query-parameter fallback — a `?token=` JWT ends up in access logs,
 * browser history, and Referer headers. Downloads authenticate via
 * header through the frontend's blob-fetch helper instead.
 */
export const getTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

/**
 * Verify the JWT and attach the decoded payload to req.user.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ success: false, message: 'Authorization token required' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthUser & { purpose?: string };
    // Challenge/scoped tokens (e.g. the MFA `purpose: 'mfa'` token) are not
    // session credentials and must not reach authenticated routes.
    if (payload.purpose || !payload.userId || !payload.role) {
      res.status(401).json({ success: false, message: 'Invalid token' });
      return;
    }

    // Re-check the account against the DB so deactivated/demoted users lose
    // access immediately instead of living out the token lifetime.
    query('SELECT is_active, role, token_version FROM users WHERE id = $1', [payload.userId])
      .then((result) => {
        const user = result.rows[0];
        if (!user || user.is_active === false) {
          res.status(401).json({ success: false, message: 'Account is not active' });
          return;
        }
        // Logout/password-change bumps token_version — tokens minted before
        // the bump are dead even though they haven't hit their exp yet.
        // Legacy tokens without `tv` count as version 0.
        if ((payload.tv ?? 0) !== (user.token_version ?? 0)) {
          res.status(401).json({ success: false, message: 'Session has been revoked' });
          return;
        }
        req.user = { ...payload, role: user.role };
        next();
      })
      .catch((error) => {
        console.error('Auth user check error:', error);
        res.status(500).json({ success: false, message: 'Authentication failed' });
      });
  } catch (error: any) {
    const message = error.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    res.status(401).json({ success: false, message });
  }
};

/**
 * Require the authenticated user to have one of the given roles.
 */
export const requireRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: roles.length === 1 && roles[0] === 'GOVERNMENT_ADMIN'
          ? 'Admin access required'
          : 'Insufficient permissions',
      });
      return;
    }
    next();
  };
};
