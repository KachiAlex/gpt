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

export const getFrontendUrl = (): string =>
  process.env.FRONTEND_URL || 'https://gptapp.vercel.app';
