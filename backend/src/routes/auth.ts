import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { query } from '../config/database';
import { sendEmail, getFrontendUrl } from '../services/emailService';
import { audit, auditFromReq } from '../services/auditService';
import { authenticate, getTokenFromRequest } from '../middleware/auth';
import userRepository from '../repositories/userRepository';
import { hashPassword, verifyPassword } from '../utils/password';
import { UserRole } from '../types/domain';
import { DbUser } from '../types/models';

const router = Router();

// Privileged government roles require an authenticated GOVERNMENT_ADMIN caller.
// Self-registration is limited to CONTRACTOR and PUBLIC.
const PRIVILEGED_ROLES: string[] = [
  UserRole.GOVERNMENT_ADMIN,
  UserRole.GOVERNMENT_OFFICER,
  UserRole.ME_OFFICER,
];

const sanitizeUser = (user: DbUser) => {
  const { password, ...rest } = user;
  return rest;
};

/**
 * Returns the decoded caller if a valid admin token is present, else null.
 */
const getAdminCaller = (req: Request): { userId: string; role: string } | null => {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; role: string };
    return decoded.role === 'GOVERNMENT_ADMIN' ? decoded : null;
  } catch {
    return null;
  }
};

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    const user = await userRepository.findByEmail((email as string).toLowerCase());

    if (!user || !user.isActive) {
      await audit({ action: 'auth.login_failed', detail: { email: (email as string)?.toLowerCase(), reason: !user ? 'unknown_email' : 'inactive' }, ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password (supports bcrypt and legacy pbkdf2/scrypt formats)
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      await audit({ actorId: user.id, actorEmail: user.email, actorRole: user.role, action: 'auth.login_failed', detail: { reason: 'bad_password' }, ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Transparently upgrade legacy password hashes to bcrypt
    if (!user.password.startsWith('$2')) {
      const upgradedHash = await hashPassword(password);
      await userRepository.updatePassword(user.id, upgradedHash).catch(() => undefined);
    }

    await userRepository.updateLastLogin(user.id);
    await audit({
      actorId: user.id, actorEmail: user.email, actorRole: user.role,
      action: 'auth.login', entityType: 'user', entityId: user.id,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    });

    // Include contractor profile id when applicable so the client can scope queries
    const contractor = await userRepository.findContractorProfileId(user.id).catch(() => null);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        ...(contractor ? { contractorId: contractor } : {}),
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
    );

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: { ...sanitizeUser(user), contractorId: contractor ?? undefined },
        token
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/auth/profile
 * Get current user profile
 */
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await userRepository.findById(req.user!.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: {
        user: sanitizeUser(user)
      }
    });

  } catch (error: any) {
    console.error('Profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/register
 * Register new user.
 *
 * Self-registration is limited to CONTRACTOR and PUBLIC roles.
 * Creating GOVERNMENT_ADMIN, GOVERNMENT_OFFICER or ME_OFFICER accounts
 * requires a valid GOVERNMENT_ADMIN token.
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, role, phone, department, jobTitle } = req.body;

    // Validate input
    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, firstName, lastName, and role are required'
      });
    }

    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    const requestedRole = String(role).toUpperCase();
    const allRoles = Object.values(UserRole) as string[];
    if (!allRoles.includes(requestedRole)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Privileged roles require an authenticated admin
    if (PRIVILEGED_ROLES.includes(requestedRole) && !getAdminCaller(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only government admins can create staff accounts'
      });
    }

    const existingUser = await userRepository.findByEmail((email as string).toLowerCase());

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);
    const user = await userRepository.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role: requestedRole as UserRole,
      phone: phone || null,
      department: department || null,
      jobTitle: jobTitle || null,
      address: null,
      city: null,
      state: null,
      profileImage: null,
    });

    await audit(auditFromReq(req, 'user.register', 'user', user.id, { email: user.email, role: user.role }));

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: sanitizeUser(user)
      }
    });

  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, phone, department, jobTitle, address, city, state, profileImage } = req.body;

    const user = await userRepository.update(req.user!.userId, {
      firstName,
      lastName,
      phone,
      department,
      jobTitle,
      address,
      city,
      state,
      profileImage,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: sanitizeUser(user)
      }
    });

  } catch (error: any) {
    console.error('Profile update error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/auth/change-password
 * Change user password
 */
router.put('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters'
      });
    }

    const user = await userRepository.findById(req.user!.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const hashedNewPassword = await hashPassword(newPassword);

    await userRepository.updatePassword(user.id, hashedNewPassword);
    await audit(auditFromReq(req, 'auth.password_change', 'user', user.id));

    return res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error: any) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Issue a one-time reset token. Always returns success so the endpoint
 * cannot be used to probe which emails are registered. When SMTP is not
 * configured the reset link is written to the server log instead.
 */
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const user = await userRepository.findByEmail(email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      // Invalidate any outstanding tokens for this user
      await query(
        'UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
        [user.id]
      );
      await query(
        'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
        [user.id, tokenHash, expiresAt]
      );

      const resetUrl = `${getFrontendUrl()}/reset-password?token=${token}`;
      const sent = await sendEmail(
        email,
        'Reset your Government Project Tracker password',
        `A password reset was requested for this account.\n\nOpen this link within 30 minutes to choose a new password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`
      );
      if (!sent) {
        console.log(`[auth] Password reset link for ${email}: ${resetUrl}`);
      }
    }

    return res.json({
      success: true,
      message: 'If that email is registered, a reset link has been sent.',
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auth/reset-password
 * Exchange a valid reset token for a new password.
 */
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, message: 'Reset token is required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await query(
      `SELECT pr.id, pr.user_id
       FROM password_resets pr
       WHERE pr.token_hash = $1 AND pr.used_at IS NULL AND pr.expires_at > NOW()`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired' });
    }

    const reset = result.rows[0];
    await userRepository.updatePassword(reset.user_id, await hashPassword(newPassword));
    await query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [reset.id]);
    await audit({ actorId: reset.user_id, action: 'auth.password_reset', entityType: 'user', entityId: reset.user_id, ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress });

    return res.json({ success: true, message: 'Password has been reset. You can now log in.' });
  } catch (error: any) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client-side token removal)
 */
router.post('/logout', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;
