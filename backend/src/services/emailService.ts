import nodemailer from 'nodemailer';

export const isEmailConfigured = (): boolean =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

/**
 * Send an email via SMTP when configured. Returns false (and logs) when
 * SMTP env vars are absent so callers can degrade gracefully.
 */
export const sendEmail = async (to: string, subject: string, text: string): Promise<boolean> => {
  if (!isEmailConfigured()) {
    console.warn(`[email] SMTP not configured — email to ${to} skipped. Subject: ${subject}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"Government Project Tracker" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  });
  return true;
};

/**
 * Base URL for links in outbound email. Prefers FRONTEND_URL (set per
 * deployment), then the request Origin — a hardcoded default would send
 * white-label users to the wrong instance.
 */
export const getFrontendUrl = (origin?: string): string =>
  process.env.FRONTEND_URL ||
  (origin && /^https?:\/\/[\w.-]+(?::\d+)?$/.test(origin) ? origin : '') ||
  'http://localhost:5173';
