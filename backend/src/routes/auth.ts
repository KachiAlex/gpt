import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { config } from '../config';
import { query } from '../config/database';
import { sendEmail, getFrontendUrl } from '../services/emailService';
import { audit, auditFromReq } from '../services/auditService';
import { authenticate, getTokenFromRequest } from '../middleware/auth';
import userRepository from '../repositories/userRepository';
import contractorRepository from '../repositories/contractorRepository';
import inviteRepository from '../repositories/inviteRepository';
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
  const { password, totpSecret, ...rest } = user;
  return rest;
};

const clientIp = (req: Request) =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress;

const issueToken = (user: DbUser, contractorId: string | null) =>
  jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      ...(contractorId ? { contractorId } : {}),
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
  );

/**
 * Returns the caller if they hold a valid token AND are still an active
 * GOVERNMENT_ADMIN in the database — the JWT claim alone is not enough,
 * since a demoted/deactivated admin's token would otherwise mint new
 * admins for the rest of its 7-day lifetime.
 */
const getAdminCaller = async (req: Request): Promise<{ userId: string; role: string } | null> => {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret) as { userId: string; role: string; purpose?: string };
    if (decoded.purpose || !decoded.userId) return null;
    const result = await query('SELECT is_active, role FROM users WHERE id = $1', [decoded.userId]);
    const user = result.rows[0];
    if (!user || user.is_active === false || user.role !== 'GOVERNMENT_ADMIN') return null;
    return { userId: decoded.userId, role: user.role };
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

    // Run a dummy hash comparison on unknown/inactive emails so response
    // timing doesn't reveal whether the account exists.
    if (!user || !user.isActive) {
      await verifyPassword(password, '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy').catch(() => undefined);
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

    // Accounts with TOTP enabled get a short-lived challenge token instead of
    // a session — the real token is only issued by /mfa-verify.
    if (user.totpEnabled) {
      const mfaToken = jwt.sign(
        { userId: user.id, purpose: 'mfa' },
        config.jwtSecret,
        { expiresIn: '5m' }
      );
      return res.json({
        success: true,
        message: 'Two-factor authentication required',
        data: { mfaRequired: true, mfaToken }
      });
    }

    await userRepository.updateLastLogin(user.id);
    await audit({
      actorId: user.id, actorEmail: user.email, actorRole: user.role,
      action: 'auth.login', entityType: 'user', entityId: user.id,
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress,
    });

    // Include contractor profile id when applicable so the client can scope queries
    const contractor = await userRepository.findContractorProfileId(user.id).catch(() => null);

    const token = issueToken(user, contractor);

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
 * POST /api/auth/mfa-verify
 * Second factor: exchange an mfa challenge token + TOTP code for a session.
 */
router.post('/mfa-verify', async (req: Request, res: Response) => {
  try {
    const { mfaToken, code } = req.body;
    if (!mfaToken || !code) {
      return res.status(400).json({ success: false, message: 'mfaToken and code are required' });
    }

    let payload: { userId: string; purpose: string };
    try {
      payload = jwt.verify(mfaToken, config.jwtSecret) as { userId: string; purpose: string };
    } catch {
      return res.status(401).json({ success: false, message: 'MFA session expired — log in again' });
    }
    if (payload.purpose !== 'mfa') {
      return res.status(401).json({ success: false, message: 'Invalid MFA session' });
    }

    const user = await userRepository.findById(payload.userId);
    if (!user || !user.isActive || !user.totpEnabled || !user.totpSecret) {
      return res.status(401).json({ success: false, message: 'Invalid MFA session' });
    }

    if (!authenticator.check(String(code), user.totpSecret)) {
      await audit({
        actorId: user.id, actorEmail: user.email, actorRole: user.role,
        action: 'auth.login_failed', detail: { reason: 'bad_totp' }, ip: clientIp(req),
      });
      return res.status(401).json({ success: false, message: 'Invalid authentication code' });
    }

    await userRepository.updateLastLogin(user.id);
    await audit({
      actorId: user.id, actorEmail: user.email, actorRole: user.role,
      action: 'auth.login', entityType: 'user', entityId: user.id, ip: clientIp(req),
    });

    const contractor = await userRepository.findContractorProfileId(user.id).catch(() => null);
    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: { ...sanitizeUser(user), contractorId: contractor ?? undefined },
        token: issueToken(user, contractor)
      }
    });
  } catch (error: any) {
    console.error('MFA verify error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auth/mfa/setup
 * Generate a pending TOTP secret + QR for the authenticated user.
 * Nothing is enforced until /mfa/enable verifies a code.
 */
router.post('/mfa/setup', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await userRepository.findById(req.user!.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.totpEnabled) {
      return res.status(409).json({ success: false, message: 'Two-factor authentication is already enabled' });
    }

    const secret = authenticator.generateSecret();
    await query('UPDATE users SET totp_secret = $1 WHERE id = $2', [secret, user.id]);

    const issuer = process.env.INSTANCE_NAME || 'Project Tracker';
    const otpauthUrl = authenticator.keyuri(user.email, issuer, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    return res.json({
      success: true,
      data: { secret, otpauthUrl, qrDataUrl }
    });
  } catch (error: any) {
    console.error('MFA setup error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auth/mfa/enable
 * Verify a code against the pending secret to activate TOTP.
 */
router.post('/mfa/enable', authenticate, async (req: Request, res: Response) => {
  try {
    const { code, password } = req.body;
    const user = await userRepository.findById(req.user!.userId);
    if (!user || !user.totpSecret) {
      return res.status(400).json({ success: false, message: 'Run mfa setup first' });
    }
    // Password required — a stolen session alone must not be able to bind an
    // attacker-held TOTP secret (that would lock the real user out).
    if (!password || !(await verifyPassword(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Password is required to enable two-factor authentication' });
    }
    if (!code || !authenticator.check(String(code), user.totpSecret)) {
      return res.status(401).json({ success: false, message: 'Invalid authentication code' });
    }

    await query('UPDATE users SET totp_enabled = TRUE, updated_at = NOW() WHERE id = $1', [user.id]);
    await audit(auditFromReq(req, 'auth.mfa_enabled', 'user', user.id));
    return res.json({ success: true, message: 'Two-factor authentication enabled' });
  } catch (error: any) {
    console.error('MFA enable error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auth/mfa/disable
 * Disable TOTP — requires the account password + a valid code so a stolen
 * session alone cannot strip the second factor.
 */
router.post('/mfa/disable', authenticate, async (req: Request, res: Response) => {
  try {
    const { password, code } = req.body;
    const user = await userRepository.findById(req.user!.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.totpEnabled || !user.totpSecret) {
      return res.status(400).json({ success: false, message: 'Two-factor authentication is not enabled' });
    }

    const passwordOk = password && (await verifyPassword(password, user.password));
    const codeOk = code && authenticator.check(String(code), user.totpSecret);
    if (!passwordOk || !codeOk) {
      return res.status(401).json({ success: false, message: 'Password and authentication code are both required' });
    }

    await query('UPDATE users SET totp_enabled = FALSE, totp_secret = NULL, updated_at = NOW() WHERE id = $1', [user.id]);
    await audit(auditFromReq(req, 'auth.mfa_disabled', 'user', user.id));
    return res.json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (error: any) {
    console.error('MFA disable error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
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

    // Validate input — lastName is optional (single-word names are common)
    if (!email || !password || !firstName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, firstName, and role are required'
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
    if (PRIVILEGED_ROLES.includes(requestedRole) && !(await getAdminCaller(req))) {
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
      lastName: lastName || '',
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
    const { firstName, lastName, phone, department, jobTitle, address, city, state, profileImage, preferences } = req.body;

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
      // Only persist a plain object — ignore strings/arrays/numbers
      ...(preferences && typeof preferences === 'object' && !Array.isArray(preferences)
        ? { preferences }
        : {}),
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

      const resetUrl = `${getFrontendUrl(req.get('origin'))}/reset-password?token=${token}`;
      try {
        const sent = await sendEmail(
          email,
          'Reset your Government Project Tracker password',
          `A password reset was requested for this account.\n\nOpen this link within 30 minutes to choose a new password:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`
        );
        if (!sent && config.nodeEnv !== 'production') {
          // Dev fallback only — never write live reset tokens to production logs
          console.log(`[auth] Password reset link for ${email}: ${resetUrl}`);
        }
      } catch (mailError) {
        // Swallow SMTP failures — a 500 here only happens for registered
        // emails, which would leak account existence.
        console.error(`[auth] Failed to send reset email to ${email}:`, mailError);
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

    // Atomically consume the token — a single UPDATE ... RETURNING means a
    // token can only ever be redeemed once, even under concurrent requests.
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await query(
      `UPDATE password_resets
       SET used_at = NOW()
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING id, user_id`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, message: 'Reset link is invalid or has expired' });
    }

    const reset = result.rows[0];
    await userRepository.updatePassword(reset.user_id, await hashPassword(newPassword));
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

/**
 * GET /api/auth/invite/:token
 * Public: validate an invite link and return the role/pre-set email the
 * form should display. Tokens are stored hashed — lookup by hash.
 */
router.get('/invite/:token', async (req: Request, res: Response) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(String(req.params.token)).digest('hex');
    const invite = await inviteRepository.findByToken(tokenHash);

    if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= new Date()) {
      return res.status(404).json({
        success: false,
        message: 'This invite link is invalid, expired, or has already been used',
      });
    }

    return res.json({
      success: true,
      data: {
        role: invite.role,
        email: invite.email,
        expiresAt: invite.expiresAt,
        requiresCompanyProfile: invite.role === UserRole.CONTRACTOR,
      },
    });
  } catch (error: any) {
    console.error('Validate invite error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * POST /api/auth/register-invite
 * Public: accept an invite — the invitee supplies their own password.
 * The invite is consumed atomically before the user row is inserted so
 * the same link can't register two accounts.
 */
router.post('/register-invite', async (req: Request, res: Response) => {
  try {
    const {
      token, email, password, firstName, lastName, phone, department, jobTitle,
      companyName, registrationNo, contactPerson, companyEmail, companyPhone,
      companyAddress, yearsExperience, specialization,
    } = req.body ?? {};

    if (!token || !email || !password || !firstName) {
      return res.status(400).json({
        success: false,
        message: 'token, email, password, and firstName are required',
      });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const invite = await inviteRepository.findByToken(tokenHash);
    if (!invite || invite.usedAt || invite.revokedAt || invite.expiresAt <= new Date()) {
      return res.status(404).json({
        success: false,
        message: 'This invite link is invalid, expired, or has already been used',
      });
    }

    // An invite pinned to an email can only register that address
    if (invite.email && invite.email !== String(email).toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'This invite was issued for a different email address',
      });
    }

    // Contractor invites need the company profile fields up front —
    // contractor_profiles columns are NOT NULL
    if (invite.role === UserRole.CONTRACTOR) {
      const missing = ['companyName', 'registrationNo', 'contactPerson', 'companyEmail', 'companyPhone', 'companyAddress']
        .filter((k) => !req.body[k]);
      if (missing.length > 0) {
        return res.status(400).json({ success: false, message: `Missing company fields: ${missing.join(', ')}` });
      }
    }

    const existingUser = await userRepository.findByEmail(String(email).toLowerCase());
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }

    if (invite.role === UserRole.CONTRACTOR) {
      const existingReg = await contractorRepository.findByRegistrationNo(String(registrationNo));
      if (existingReg) {
        return res.status(409).json({ success: false, message: 'A contractor with that registration number already exists' });
      }
    }

    // Consume atomically — a racing second acceptance gets null here
    const consumed = await inviteRepository.consume(tokenHash);
    if (!consumed) {
      return res.status(404).json({
        success: false,
        message: 'This invite link is invalid, expired, or has already been used',
      });
    }

    const hashedPassword = await hashPassword(password);
    const user = await userRepository.create({
      email: String(email).toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName: lastName || '',
      role: invite.role as UserRole,
      phone: phone || null,
      department: department || null,
      jobTitle: jobTitle || null,
      address: null,
      city: null,
      state: null,
      profileImage: null,
    });

    await inviteRepository.stampUsedBy(invite.id, user.id);

    if (invite.role === UserRole.CONTRACTOR) {
      await contractorRepository.create({
        userId: user.id,
        companyName: String(companyName),
        registrationNo: String(registrationNo),
        contactPerson: String(contactPerson),
        companyEmail: String(companyEmail),
        companyPhone: String(companyPhone),
        companyAddress: String(companyAddress),
        yearsExperience: yearsExperience ? parseInt(yearsExperience, 10) : undefined,
        specialization: Array.isArray(specialization) ? specialization : [],
      });
    }

    await audit(auditFromReq(req, 'invite.accept', 'user', user.id, { email: user.email, role: user.role, inviteId: invite.id }));

    return res.status(201).json({
      success: true,
      message: 'Account created — you can now log in',
      data: { user: sanitizeUser(user) },
    });
  } catch (error: any) {
    console.error('Register invite error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
