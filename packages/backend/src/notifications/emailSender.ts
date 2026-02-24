import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { awsRegion, notificationFromEmail, notificationsEnabled, skipEmailSend } from '../utils/envVars.js';
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
    const sesClient = new SESClient({ region: awsRegion });
    const command = new SendEmailCommand({
      Source: `CFB Pick'em <${notificationFromEmail}>`,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: params.subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: params.htmlBody, Charset: 'UTF-8' },
          Text: { Data: params.textBody, Charset: 'UTF-8' },
        },
      },
    });
    await sesClient.send(command);
    logger.info({ to: params.to, subject: params.subject }, 'Email sent');
    return true;
  } catch (e) {
    logger.error({ err: e, to: params.to }, 'sendEmail failed');
    return false;
  }
}
