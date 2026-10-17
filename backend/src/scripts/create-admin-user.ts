/**
 * Create or update the admin user in PostgreSQL.
 *
 * Usage:
 *   npm run create-admin          (dev, via ts-node)
 *   node dist/scripts/create-admin-user.js   (after build)
 *
 * Env overrides: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_FIRST_NAME, ADMIN_LAST_NAME
 */

import dotenv from 'dotenv';
dotenv.config();

import pool from '../config/database';
import { hashPassword } from '../utils/password';
import { UserRole } from '../types/domain';

async function createAdminUser() {
  // Positional args override env vars: <email> <password> <firstName> <lastName>
  const [argEmail, argPassword, argFirstName, argLastName] = process.argv.slice(2);
  const email = (argEmail || process.env.ADMIN_EMAIL || 'admin@gpt.local').toLowerCase();
  const password = argPassword || process.env.ADMIN_PASSWORD || 'Admin@123!';
  const firstName = argFirstName || process.env.ADMIN_FIRST_NAME || 'Admin';
  const lastName = argLastName || process.env.ADMIN_LAST_NAME || 'User';

  console.log(`Creating admin user ${email} ...`);

  const hashedPassword = await hashPassword(password);

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE users
       SET password = $1, role = $2, first_name = $3, last_name = $4, is_active = TRUE, updated_at = NOW()
       WHERE id = $5`,
      [hashedPassword, UserRole.GOVERNMENT_ADMIN, firstName, lastName, existing.rows[0].id]
    );
    console.log(`✅ Admin user updated (${existing.rows[0].id})`);
  } else {
    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id`,
      [email, hashedPassword, firstName, lastName, UserRole.GOVERNMENT_ADMIN]
    );
    console.log(`✅ Admin user created (${result.rows[0].id})`);
  }

  console.log(`   Email: ${email}`);
  console.log('   ⚠️  Change this password after first login!');
}

if (require.main === module) {
  createAdminUser()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch(async (error) => {
      console.error('Fatal error:', error);
      await pool.end();
      process.exit(1);
    });
}

export { createAdminUser };
