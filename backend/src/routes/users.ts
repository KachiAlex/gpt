import { Router, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config';
import { authenticate, requireRoles } from '../middleware/auth';
import { userRepository } from '../repositories/userRepository';
import { notificationRepository } from '../repositories/notificationRepository';
import { documentRepository } from '../repositories/documentRepository';
import { fileUploadService } from '../services/fileUploadService';
import { DocumentCategory } from '../types/domain';

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
  upload.any(),
  async (req: Request, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[]) || [];
      const file = files[0];
      if (!file) {
        return res.status(400).json({ success: false, message: 'No file provided' });
      }

      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ success: false, message: 'Only image files are allowed' });
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
