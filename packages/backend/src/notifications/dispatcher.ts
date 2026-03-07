import {
  addNotificationLog,
  hasNotificationBeenSent,
  returnOptedInUsers,
} from '../db/dbNotificationFunctions.js';
import { sendEmail } from './emailSender.js';
import { sendNtfyNotification } from './ntfySender.js';
import {
  gamesReadyTemplate,
  picksReminderTemplate,
  rankingsUpdatedTemplate,
} from './templates.js';
import logger from '../utils/logger.js';
import { getNow } from '../utils/clock.js';
import type { NotificationChannel, NotificationType } from '@shared/types/cfb-pickem-api.js';

interface DispatchParams {
  notificationType: NotificationType;
  year: number;
  weekNumber: number;
  firstKickoffTime?: Date;
}

const CHANNELS: NotificationChannel[] = ['email', 'ntfy'];

export async function dispatchNotification(params: DispatchParams): Promise<void> {
  const { notificationType, year, weekNumber, firstKickoffTime } = params;
  logger.info({ notificationType, year, weekNumber }, 'dispatchNotification started');

  for (const channel of CHANNELS) {
    let users;
    try {
      users = await returnOptedInUsers(notificationType, channel);
    } catch (e) {
      logger.error({ err: e, channel, notificationType }, 'Failed to fetch opted-in users');
      continue;
    }

    for (const user of users) {
      try {
        // Skip if already sent
        const alreadySent = await hasNotificationBeenSent(
          user.userId,
          year,
          weekNumber,
          notificationType,
          channel
        );
        if (alreadySent) continue;

        // Channel eligibility checks
        if (channel === 'email') {
          if (!user.emailVerified || !user.email) continue;
        }
        if (channel === 'ntfy') {
          if (!user.ntfyServerUrl) continue;
        }

        const template = buildTemplate(notificationType, { year, weekNumber, firstKickoffTime });
        let sent = false;

        if (channel === 'email') {
          sent = await sendEmail({
            to: user.email,
            subject: template.subject,
            htmlBody: template.htmlBody,
            textBody: template.textBody,
          });
        } else if (channel === 'ntfy' && user.ntfyServerUrl) {
          sent = await sendNtfyNotification({
            ntfyServerUrl: user.ntfyServerUrl,
            userId: user.userId,
            title: template.subject,
            message: template.textBody,
          });
        }

        if (sent) {
          await addNotificationLog(user.userId, year, weekNumber, notificationType, channel);
        }
      } catch (e) {
        logger.error({ err: e, userId: user.userId, channel, notificationType }, 'Failed to send notification to user');
      }
    }
  }

  logger.info({ notificationType, year, weekNumber }, 'dispatchNotification complete');
}

function buildTemplate(
  notificationType: NotificationType,
  params: { year: number; weekNumber: number; firstKickoffTime?: Date }
) {
  switch (notificationType) {
    case 'games_ready':
      return gamesReadyTemplate({ year: params.year, weekNumber: params.weekNumber });
    case 'picks_reminder':
      return picksReminderTemplate({
        year: params.year,
        weekNumber: params.weekNumber,
        firstKickoffTime: params.firstKickoffTime ?? getNow(),
      });
    case 'rankings_updated':
      return rankingsUpdatedTemplate({ year: params.year, weekNumber: params.weekNumber });
  }
}
