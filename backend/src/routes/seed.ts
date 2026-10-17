import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { hashPassword } from '../utils/password';
import { UserRole } from '../types/domain';

const router = Router();

/**
 * POST /api/seed
 * Create the initial admin user. Only works while no GOVERNMENT_ADMIN
 * account exists, or when the request carries the SEED_KEY matching
 * the JWT_SECRET environment variable.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const adminCount = await query(
      "SELECT COUNT(*) FROM users WHERE role = 'GOVERNMENT_ADMIN'"
    );
    const hasAdmin = parseInt(adminCount.rows[0]?.count || '0', 10) > 0;

    const seedKey = req.headers['x-seed-key'];
    const seedKeyValid = typeof seedKey === 'string'
      && seedKey.length > 0
      && seedKey === process.env.SEED_KEY
      && (process.env.SEED_KEY || '').length > 0;

    if (hasAdmin && !seedKeyValid) {
      return res.status(403).json({
        success: false,
        message: 'Seed disabled: an admin account already exists',
      });
    }

    const email = (process.env.ADMIN_EMAIL || 'admin@gpt.local').toLowerCase();
    const password = process.env.ADMIN_PASSWORD || 'Admin@123!';
    const firstName = process.env.ADMIN_FIRST_NAME || 'Government';
    const lastName = process.env.ADMIN_LAST_NAME || 'Administrator';

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    const hashedPassword = await hashPassword(password);

    let userId: string;
    if (existing.rows.length > 0) {
      userId = existing.rows[0].id;
      await query(
        `UPDATE users SET password = $1, role = 'GOVERNMENT_ADMIN', is_active = TRUE, updated_at = NOW()
         WHERE id = $2`,
        [hashedPassword, userId]
      );
    } else {
      const result = await query(
        `INSERT INTO users (email, password, first_name, last_name, role, is_active)
         VALUES ($1, $2, $3, $4, $5, TRUE)
         RETURNING id`,
        [email, hashedPassword, firstName, lastName, UserRole.GOVERNMENT_ADMIN]
      );
      userId = result.rows[0].id;
    }

    return res.status(201).json({
      success: true,
      message: 'Admin user seeded successfully',
      data: { userId, email },
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to seed database',
    });
  }
});

export default router;
