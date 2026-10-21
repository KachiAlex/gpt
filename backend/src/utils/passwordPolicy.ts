/**
 * Shared password policy for every credential-setting path (self-register,
 * invite accept, change-password, reset-password, admin reset).
 * Returns a user-facing error string, or null when the password is acceptable.
 */

const COMMON = new Set([
  'password', 'password1', 'password123', 'passw0rd123', 'letmein123',
  'qwerty123456', 'iloveyou123', 'admin123456', 'welcome12345', '123456789012',
  'changeme123', 'nigeria123', 'trustnoone1',
]);

export const passwordPolicyError = (password: unknown): string | null => {
  if (typeof password !== 'string' || password.length < 12) {
    return 'Password must be at least 12 characters';
  }
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must include a number';
  if (COMMON.has(password.toLowerCase())) {
    return 'Password is too common — choose a stronger one';
  }
  return null;
};
