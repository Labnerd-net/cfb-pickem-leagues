import { Resend } from 'resend';
import { resendApiKey, notificationFromEmail, notificationsEnabled, skipEmailSend } from '../utils/envVars.js';
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

  const resend = new Resend(resendApiKey);

  try {
    const { error } = await resend.emails.send({
      from: `CFB Pick'em <${notificationFromEmail}>`,
      to: params.to,
      subject: params.subject,
      html: params.htmlBody,
      text: params.textBody,
    });

    if (error) {
      logger.error({ err: error, to: params.to }, 'sendEmail failed');
      return false;
    }

    logger.info({ to: params.to, subject: params.subject }, 'Email sent');
    return true;
  } catch (e) {
    logger.error({ err: e, to: params.to }, 'sendEmail failed');
    return false;
  }
}
