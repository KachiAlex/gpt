import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const BCRYPT_ROUNDS = 10;
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_KEYLEN = 64;
const PBKDF2_DIGEST = 'sha256';

/**
 * Hash a plaintext password for storage (bcrypt).
 */
export const hashPassword = (password: string): Promise<string> => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

const verifyPbkdf2 = (password: string, stored: string): boolean => {
  // Legacy format from the Supabase edge function era: "pbkdf2:<saltHex>:<keyHex>"
  const parts = stored.split(':');
  if (parts.length !== 3) return false;
  const [, saltHex, keyHex] = parts;
  const derived = crypto.pbkdf2Sync(
    password,
    Buffer.from(saltHex, 'hex'),
    PBKDF2_ITERATIONS,
    PBKDF2_KEYLEN,
    PBKDF2_DIGEST
  );
  const expected = Buffer.from(keyHex, 'hex');
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
};

/**
 * Verify a plaintext password against a stored hash.
 * Supports bcrypt hashes and the legacy "pbkdf2:salt:key" format.
 */
export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  if (stored.startsWith('pbkdf2:')) {
    return verifyPbkdf2(password, stored);
  }
  if (stored.startsWith('$2')) {
    return bcrypt.compare(password, stored);
  }
  // Legacy scrypt format "salt:hash" (64-byte hex hash)
  if (/^[0-9a-f]+:[0-9a-f]{128}$/i.test(stored)) {
    const [saltHex, keyHex] = stored.split(':');
    const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), PBKDF2_KEYLEN);
    const expected = Buffer.from(keyHex, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  }
  return false;
};
