import {
  addNotificationLog,
  hasNotificationBeenSent,
  returnEmailOptedInUsers,
  returnSentNotificationUserIds,
} from '../db/dbNotificationFunctions.js';
import { returnLeaderboard } from '../db/dbUserFunctions.js';
import { sendEmail } from './emailSender.js';
import { sendNtfyNotification } from './ntfySender.js';
import { sendTelegramNotification } from './telegramSender.js';
import { sendDiscordNotification } from './discordSender.js';
import {
  gamesReadyTemplate,
  picksReminderTemplate,
  rankingsUpdatedTemplate,
} from './templates.js';
import logger from '../utils/logger.js';
import { getNow } from '../utils/clock.js';
import { ntfyEnabled, telegramEnabled, discordEnabled } from '../utils/envVars.js';
import type { LeaderboardEntry, NotificationType } from '@shared/types/cfb-pickem-api.js';

// Sentinel userId for broadcast channel deduplication log entries
const BROADCAST_USER_ID = 0;

interface DispatchParams {
  notificationType: NotificationType;
  year: number;
  weekNumber: number;
  firstKickoffTime?: Date;
}

export async function dispatchNotification(params: DispatchParams): Promise<void> {
  const { notificationType, year, weekNumber, firstKickoffTime } = params;
  logger.info({ notificationType, year, weekNumber }, 'dispatchNotification started');

  let leaderboard: LeaderboardEntry[] = [];
  if (notificationType === 'rankings_updated') {
    try {
      leaderboard = await returnLeaderboard(year);
    } catch (e) {
      logger.error({ err: e }, 'Failed to fetch leaderboard for rankings_updated notification');
    }
  }

  const template = buildTemplate(notificationType, { year, weekNumber, firstKickoffTime, leaderboard });

  // ----------------------------------------------------------------
  // Email channel — per-user loop
  // ----------------------------------------------------------------
  try {
    const users = await returnEmailOptedInUsers(notificationType);
    const alreadySentUserIds = await returnSentNotificationUserIds(year, weekNumber, notificationType, 'email');
    for (const user of users) {
      try {
        if (!user.emailVerified || !user.email) continue;

        if (alreadySentUserIds.has(user.userId)) continue;

        const sent = await sendEmail({
          to: user.email,
          subject: template.subject,
          htmlBody: template.htmlBody,
          textBody: template.textBody,
        });

        if (sent) {
          await addNotificationLog(user.userId, year, weekNumber, notificationType, 'email');
        }
      } catch (e) {
        logger.error({ err: e, userId: user.userId, notificationType }, 'Failed to send email notification to user');
      }
    }
  } catch (e) {
    logger.error({ err: e, notificationType }, 'Failed to fetch opted-in users for email');
  }

  // ----------------------------------------------------------------
  // ntfy broadcast channel
  // ----------------------------------------------------------------
  if (ntfyEnabled) {
    try {
      const alreadySent = await hasNotificationBeenSent(BROADCAST_USER_ID, year, weekNumber, notificationType, 'ntfy');
      if (!alreadySent) {
        const sent = await sendNtfyNotification({ title: template.subject, message: template.textBody });
        if (sent) {
          await addNotificationLog(BROADCAST_USER_ID, year, weekNumber, notificationType, 'ntfy');
        }
      }
    } catch (e) {
      logger.error({ err: e, notificationType }, 'Failed to send ntfy broadcast notification');
    }
  }

  // ----------------------------------------------------------------
  // Telegram broadcast channel
  // ----------------------------------------------------------------
  if (telegramEnabled) {
    try {
      const alreadySent = await hasNotificationBeenSent(BROADCAST_USER_ID, year, weekNumber, notificationType, 'telegram');
      if (!alreadySent) {
        const sent = await sendTelegramNotification({ title: template.subject, message: template.textBody });
        if (sent) {
          await addNotificationLog(BROADCAST_USER_ID, year, weekNumber, notificationType, 'telegram');
        }
      }
    } catch (e) {
      logger.error({ err: e, notificationType }, 'Failed to send Telegram broadcast notification');
    }
  }

  // ----------------------------------------------------------------
  // Discord broadcast channel
  // ----------------------------------------------------------------
  if (discordEnabled) {
    try {
      const alreadySent = await hasNotificationBeenSent(BROADCAST_USER_ID, year, weekNumber, notificationType, 'discord');
      if (!alreadySent) {
        const sent = await sendDiscordNotification({ title: template.subject, message: template.textBody });
        if (sent) {
          await addNotificationLog(BROADCAST_USER_ID, year, weekNumber, notificationType, 'discord');
        }
      }
    } catch (e) {
      logger.error({ err: e, notificationType }, 'Failed to send Discord broadcast notification');
    }
  }

  logger.info({ notificationType, year, weekNumber }, 'dispatchNotification complete');
}

function buildTemplate(
  notificationType: NotificationType,
  params: { year: number; weekNumber: number; firstKickoffTime?: Date; leaderboard: LeaderboardEntry[] }
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
      return rankingsUpdatedTemplate({ year: params.year, weekNumber: params.weekNumber, leaderboard: params.leaderboard });
  }
}
