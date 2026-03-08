import nodemailer from 'nodemailer';
import { smtpHost, smtpPort, smtpUser, smtpPass, smtpSecure, notificationFromEmail, notificationsEnabled, skipEmailSend } from '../utils/envVars.js';
import logger from '../utils/logger.js';

interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  if (!notificationsEnabled || skipEmailSend) {
    logger.warn({ to: params.to, subject: params.subject }, 'Email send skipped (notifications disabled or SKIP_EMAIL_SEND=true)');
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });

    await transporter.sendMail({
      from: `CFB Pick'em <${notificationFromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.htmlBody,
      text: params.textBody,
    });

    logger.info({ to: params.to, subject: params.subject }, 'Email sent');
    return true;
  } catch (e) {
    logger.error({ err: e, to: params.to }, 'sendEmail failed');
    return false;
  }
}
