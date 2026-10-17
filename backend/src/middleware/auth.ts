import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
  contractorId?: string;
}

/**
 * Extract the bearer token from the Authorization header.
 * Falls back to the `token` query parameter so browser-driven
 * downloads (window.open) can authenticate.
 */
export const getTokenFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const queryToken = req.query.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
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
    req.user = jwt.verify(token, config.jwtSecret) as AuthUser;
    next();
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
