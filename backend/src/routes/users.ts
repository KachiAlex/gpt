import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { config } from '../config';
import { authenticate, requireRoles } from '../middleware/auth';
import { userRepository } from '../repositories/userRepository';
import { notificationRepository } from '../repositories/notificationRepository';
import { documentRepository } from '../repositories/documentRepository';
import { inviteRepository } from '../repositories/inviteRepository';
import { fileUploadService } from '../services/fileUploadService';
import { passwordPolicyError } from '../utils/passwordPolicy';
import { getFrontendUrl } from '../services/emailService';
import { DocumentCategory } from '../types/domain';
import { query } from '../config/database';
import { hashPassword } from '../utils/password';
import { audit, auditFromReq } from '../services/auditService';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxFileSize },
});

/**
 * GET /api/users
 * List users (Admin only)
 */
router.get('/', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (req: Request, res: Response) => {
  try {
    const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '50', 10), 1), 200);

    const { users, total } = await userRepository.list({
      role: typeof req.query.role === 'string' ? req.query.role : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
      page,
      limit,
    });

    return res.json({
      success: true,
      data: {
        users,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (error: any) {
    console.error('Get users error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get users' });
  }
});

/**
 * PATCH /api/users/:id
 * Admin: activate/deactivate a user or change their role.
 * Deactivation takes effect immediately — authenticate re-checks
 * is_active on every request, so outstanding tokens stop working.
 */
router.patch('/:id', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive, role } = req.body ?? {};

    const target = await userRepository.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (id === req.user!.userId) {
      return res.status(400).json({ success: false, message: 'You cannot modify your own account here' });
    }

    const VALID_ROLES = new Set(['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER', 'CONTRACTOR', 'PUBLIC']);
    const updates: { isActive?: boolean; role?: string } = {};
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
      }
      updates.isActive = isActive;
    }
    if (role !== undefined) {
      if (!VALID_ROLES.has(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }
      updates.role = role;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update — send isActive and/or role' });
    }

    // Prevent locking the system out — never deactivate or demote the last
    // remaining active GOVERNMENT_ADMIN.
    const targetIsAdmin = target.role === 'GOVERNMENT_ADMIN';
    const wouldDemote = updates.role !== undefined && updates.role !== 'GOVERNMENT_ADMIN';
    const wouldDeactivate = updates.isActive === false;
    if (targetIsAdmin && (wouldDemote || wouldDeactivate)) {
      const otherAdmins = await query(
        `SELECT COUNT(*)::int AS n FROM users
         WHERE role = 'GOVERNMENT_ADMIN' AND is_active = true AND id <> $1`,
        [id]
      );
      if ((otherAdmins.rows[0]?.n ?? 0) === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the last active GOVERNMENT_ADMIN — promote another admin first',
        });
      }
    }

    const sets: string[] = [];
    const vals: any[] = [];
    if (updates.isActive !== undefined) { sets.push(`is_active = $${vals.length + 1}`); vals.push(updates.isActive); }
    if (updates.role !== undefined) { sets.push(`role = $${vals.length + 1}`); vals.push(updates.role); }
    vals.push(id);
    const result = await query(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}
       RETURNING id, email, role, is_active`,
      vals
    );

    const updated = result.rows[0];
    await audit(auditFromReq(req, 'user.update', 'user', id, {
      targetEmail: target.email,
      ...(updates.isActive !== undefined ? { isActive: updates.isActive } : {}),
      ...(updates.role !== undefined ? { role: updates.role } : {}),
    }));

    return res.json({ success: true, message: 'User updated', data: { user: updated } });
  } catch (error: any) {
    console.error('Update user error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update user' });
  }
});

/**
 * POST /api/users/:id/reset-password
 * Admin: force a password reset — sets a new password and marks the
 * account for a change on next login is left to the admin to enforce.
 */
router.post('/:id/reset-password', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body ?? {};

    const target = await userRepository.findById(id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const policyError = passwordPolicyError(newPassword);
    if (policyError) {
      return res.status(400).json({ success: false, message: policyError });
    }

    await userRepository.updatePassword(id, await hashPassword(newPassword));
    await audit(auditFromReq(req, 'user.password_reset_admin', 'user', id, { targetEmail: target.email }));

    return res.json({ success: true, message: `Password reset for ${target.email}` });
  } catch (error: any) {
    console.error('Admin reset password error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

const INVITABLE_ROLES = new Set(['GOVERNMENT_ADMIN', 'GOVERNMENT_OFFICER', 'ME_OFFICER', 'CONTRACTOR', 'PUBLIC']);

const inviteOrigin = (req: Request): string => {
  const origin = req.headers.origin;
  return typeof origin === 'string' ? origin : undefined as any;
};

/**
 * POST /api/users/invites
 * Admin: generate a role-locked invite link. The invitee sets their own
 * password — no shared credentials. Token is stored hashed; the raw
 * token only exists in the returned URL.
 */
router.post('/invites', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (req: Request, res: Response) => {
  try {
    const { role, email, expiresInDays, note } = req.body ?? {};

    if (!role || !INVITABLE_ROLES.has(String(role).toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Invalid role — must be one of: ${[...INVITABLE_ROLES].join(', ')}`,
      });
    }
    if (email !== undefined && email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ success: false, message: 'Invalid email address' });
    }

    const days = Math.min(Math.max(parseInt(expiresInDays ?? '7', 10) || 7, 1), 30);

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    const invite = await inviteRepository.create({
      token: tokenHash,
      email: email ? String(email).toLowerCase() : null,
      role: String(role).toUpperCase(),
      note: note ? String(note).slice(0, 500) : null,
      invitedBy: req.user!.userId,
      expiresAt,
    });

    await audit(auditFromReq(req, 'invite.create', 'invite', invite.id, { role: invite.role, email: invite.email }));

    return res.status(201).json({
      success: true,
      message: 'Invite link created',
      data: {
        invite: {
          id: invite.id,
          role: invite.role,
          email: invite.email,
          expiresAt: invite.expiresAt,
          url: `${getFrontendUrl(inviteOrigin(req))}/invite/${token}`,
        },
      },
    });
  } catch (error: any) {
    console.error('Create invite error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create invite' });
  }
});

/**
 * GET /api/users/invites
 * Admin: recent invites with inviter/acceptor info.
 */
router.get('/invites', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (_req: Request, res: Response) => {
  try {
    const invites = await inviteRepository.listRecent();
    return res.json({ success: true, data: { invites } });
  } catch (error: any) {
    console.error('List invites error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list invites' });
  }
});

/**
 * DELETE /api/users/invites/:id
 * Admin: revoke a pending invite.
 */
router.delete('/invites/:id', authenticate, requireRoles('GOVERNMENT_ADMIN'), async (req: Request, res: Response) => {
  try {
    const revoked = await inviteRepository.revoke(req.params.id);
    if (!revoked) {
      return res.status(404).json({ success: false, message: 'Invite not found or already used' });
    }
    await audit(auditFromReq(req, 'invite.revoke', 'invite', req.params.id));
    return res.json({ success: true, message: 'Invite revoked' });
  } catch (error: any) {
    console.error('Revoke invite error:', error);
    return res.status(500).json({ success: false, message: 'Failed to revoke invite' });
  }
});

/**
 * GET /api/users/notifications
 * Get the current user's notifications
 */
router.get('/notifications', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '50', 10), 1), 200);
    const [notifications, unreadCount] = await Promise.all([
      notificationRepository.listByUser(req.user!.userId, limit),
      notificationRepository.unreadCount(req.user!.userId),
    ]);

    return res.json({
      success: true,
      data: { notifications, unreadCount },
    });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get notifications' });
  }
});

/**
 * PUT /api/users/notifications/:id/read
 * Mark a notification as read
 */
router.put('/notifications/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    await notificationRepository.markRead(req.params.id, req.user!.userId);
    return res.json({ success: true, message: 'Notification marked as read' });
  } catch (error: any) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark notification read' });
  }
});

/**
 * PUT /api/users/notifications/read-all
 * Mark all notifications as read
 */
router.put('/notifications/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    await notificationRepository.markAllRead(req.user!.userId);
    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark notifications read' });
  }
});

/**
 * POST /api/users/upload-profile-image
 * Upload a profile image (stored as a public file)
 */
router.post(
  '/upload-profile-image',
  authenticate,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ success: false, message: 'No file provided' });
      }

      // Raster formats only — SVG can carry embedded script and is served
      // from the app origin via /uploads/public.
      const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
      if (!allowed.has(file.mimetype)) {
        return res.status(400).json({ success: false, message: 'Only JPEG, PNG, WebP or GIF images are allowed' });
      }

      const uploadResult = await fileUploadService.uploadFile(
        file,
        DocumentCategory.OTHER,
        req.user!.userId,
        undefined,
        undefined,
        true // public profile image
      );

      await documentRepository.create({
        fileName: uploadResult.fileName,
        originalName: uploadResult.originalName,
        filePath: uploadResult.filePath,
        fileSize: uploadResult.fileSize,
        mimeType: uploadResult.mimeType,
        category: DocumentCategory.OTHER,
        uploadedBy: req.user!.userId,
        isPublic: true,
      });

      const imageUrl = `/uploads/${uploadResult.filePath}`;
      await userRepository.update(req.user!.userId, { profileImage: imageUrl });

      return res.json({
        success: true,
        message: 'Profile image uploaded',
        data: { profileImage: imageUrl },
      });
    } catch (error: any) {
      console.error('Profile image upload error:', error);
      return res.status(500).json({ success: false, message: 'Failed to upload profile image' });
    }
  }
);

export default router;
