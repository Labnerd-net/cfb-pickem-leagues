import {
  addNotificationLog,
  hasNotificationBeenSent,
  returnEmailOptedInUsers,
  returnSentNotificationUserIds,
} from '../db/dbNotificationFunctions.js';
import { returnLeaderboard, returnUsers } from '../db/dbUserFunctions.js';
import { getLeagueById } from '../db/dbLeagueFunctions.js';
import { sendEmail } from './emailSender.js';
import { sendNtfyNotification } from './ntfySender.js';
import { sendTelegramNotification } from './telegramSender.js';
import { sendDiscordNotification } from './discordSender.js';
import {
  gamesReadyTemplate,
  picksReminderTemplate,
  picksReminder24hTemplate,
  rankingsUpdatedTemplate,
  escapeHtml,
} from './templates.js';
import logger from '../utils/logger.js';
import { getNow } from '../utils/clock.js';
import { ntfyEnabled, telegramEnabled, discordEnabled } from '../utils/envVars.js';
import type { LeaderboardEntry, NotificationType } from '@shared/types/cfb-pickem-api.js';

// Sentinel userId for broadcast channel deduplication log entries
const BROADCAST_USER_ID = 0;

// Sentinel leagueId for site-wide (non-league-scoped) notifications
const SITE_WIDE_LEAGUE_ID = 0;

interface DispatchParams {
  notificationType: Exclude<NotificationType, 'admin_broadcast'>;
  leagueId: number;
  leagueName: string;
  year: number;
  weekNumber: number;
  firstKickoffTime?: Date;
}

export async function dispatchNotification(params: DispatchParams): Promise<void> {
  const { notificationType, leagueId, leagueName, year, weekNumber, firstKickoffTime } = params;
  logger.info({ notificationType, leagueId, year, weekNumber }, 'dispatchNotification started');

  let leaderboard: LeaderboardEntry[] = [];
  if (notificationType === 'rankings_updated') {
    try {
      leaderboard = await returnLeaderboard(year, leagueId);
    } catch (e) {
      logger.error({ err: e }, 'Failed to fetch leaderboard for rankings_updated notification');
    }
  }

  const template = buildTemplate(notificationType, { year, weekNumber, leagueName, firstKickoffTime, leaderboard });

  // ----------------------------------------------------------------
  // Email channel — per-user loop
  // ----------------------------------------------------------------
  try {
    const users = await returnEmailOptedInUsers(notificationType, leagueId);
    const alreadySentUserIds = await returnSentNotificationUserIds(leagueId, year, weekNumber, notificationType, 'email');
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
          await addNotificationLog(user.userId, leagueId, year, weekNumber, notificationType, 'email');
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
      const alreadySent = await hasNotificationBeenSent(BROADCAST_USER_ID, leagueId, year, weekNumber, notificationType, 'ntfy');
      if (!alreadySent) {
        const sent = await sendNtfyNotification({ title: template.subject, message: template.textBody });
        if (sent) {
          await addNotificationLog(BROADCAST_USER_ID, leagueId, year, weekNumber, notificationType, 'ntfy');
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
      const alreadySent = await hasNotificationBeenSent(BROADCAST_USER_ID, leagueId, year, weekNumber, notificationType, 'telegram');
      if (!alreadySent) {
        const sent = await sendTelegramNotification({ title: template.subject, message: template.textBody });
        if (sent) {
          await addNotificationLog(BROADCAST_USER_ID, leagueId, year, weekNumber, notificationType, 'telegram');
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
      const alreadySent = await hasNotificationBeenSent(BROADCAST_USER_ID, leagueId, year, weekNumber, notificationType, 'discord');
      if (!alreadySent) {
        const sent = await sendDiscordNotification({ title: template.subject, message: template.textBody });
        if (sent) {
          await addNotificationLog(BROADCAST_USER_ID, leagueId, year, weekNumber, notificationType, 'discord');
        }
      }
    } catch (e) {
      logger.error({ err: e, notificationType }, 'Failed to send Discord broadcast notification');
    }
  }

  logger.info({ notificationType, leagueId, year, weekNumber }, 'dispatchNotification complete');
}

// ------------------------------------------------------------------
// Convenience wrapper called by route handlers after marking games complete
// or correcting scores. Looks up the league name, then dispatches.
// ------------------------------------------------------------------
export async function dispatchGameComplete(leagueId: number, year: number, weekNumber: number): Promise<void> {
  const league = await getLeagueById(leagueId);
  if (!league) {
    logger.warn({ leagueId }, 'dispatchGameComplete: league not found, skipping');
    return;
  }
  await dispatchNotification({
    notificationType: 'rankings_updated',
    leagueId,
    leagueName: league.name,
    year,
    weekNumber,
  });
}

function buildTemplate(
  notificationType: Exclude<NotificationType, 'admin_broadcast'>,
  params: { year: number; weekNumber: number; leagueName: string; firstKickoffTime?: Date; leaderboard: LeaderboardEntry[] }
) {
  switch (notificationType) {
    case 'games_ready':
      return gamesReadyTemplate({ year: params.year, weekNumber: params.weekNumber, leagueName: params.leagueName });
    case 'picks_reminder_1h':
      return picksReminderTemplate({
        year: params.year,
        weekNumber: params.weekNumber,
        leagueName: params.leagueName,
        firstKickoffTime: params.firstKickoffTime ?? getNow(),
      });
    case 'picks_reminder_24h':
      return picksReminder24hTemplate({
        year: params.year,
        weekNumber: params.weekNumber,
        leagueName: params.leagueName,
        firstKickoffTime: params.firstKickoffTime ?? getNow(),
      });
    case 'rankings_updated':
      return rankingsUpdatedTemplate({
        year: params.year,
        weekNumber: params.weekNumber,
        leagueName: params.leagueName,
        leaderboard: params.leaderboard,
      });
  }
}

// ------------------------------------------------------------------
// Dispatch a free-form admin broadcast to all users and broadcast channels.
// No deduplication — each call is an intentional unique send.
// year/weekNumber are the resolved week context for the notification log.
// ------------------------------------------------------------------
export async function dispatchAdminBroadcast(
  subject: string,
  message: string,
  overrideEmailPreferences: boolean,
  year: number,
  weekNumber: number
): Promise<void> {
  logger.info({ year, weekNumber, overrideEmailPreferences }, 'dispatchAdminBroadcast started');

  // ----------------------------------------------------------------
  // Email channel
  // ----------------------------------------------------------------
  try {
    let emailUsers: { userId: number; email: string; emailVerified: boolean }[];
    if (overrideEmailPreferences) {
      const allUsers = await returnUsers();
      emailUsers = allUsers
        .filter(u => u.emailVerified && u.email)
        .map(u => ({ userId: u.userId, email: u.email, emailVerified: u.emailVerified }));
    } else {
      emailUsers = await returnEmailOptedInUsers('admin_broadcast', SITE_WIDE_LEAGUE_ID);
    }

    for (const user of emailUsers) {
      try {
        if (!user.emailVerified || !user.email) continue;
        const sent = await sendEmail({
          to: user.email,
          subject,
          htmlBody: escapeHtml(message),
          textBody: message,
        });
        if (sent) {
          await addNotificationLog(user.userId, SITE_WIDE_LEAGUE_ID, year, weekNumber, 'admin_broadcast', 'email');
        }
      } catch (e) {
        logger.error({ err: e, userId: user.userId }, 'Failed to send admin broadcast email to user');
      }
    }
  } catch (e) {
    logger.error({ err: e }, 'Failed to fetch users for admin broadcast email');
  }

  // ----------------------------------------------------------------
  // ntfy broadcast channel
  // ----------------------------------------------------------------
  if (ntfyEnabled) {
    try {
      const sent = await sendNtfyNotification({ title: subject, message });
      if (sent) {
        await addNotificationLog(BROADCAST_USER_ID, SITE_WIDE_LEAGUE_ID, year, weekNumber, 'admin_broadcast', 'ntfy');
      }
    } catch (e) {
      logger.error({ err: e }, 'Failed to send admin broadcast ntfy notification');
    }
  }

  // ----------------------------------------------------------------
  // Telegram broadcast channel
  // ----------------------------------------------------------------
  if (telegramEnabled) {
    try {
      const sent = await sendTelegramNotification({ title: subject, message });
      if (sent) {
        await addNotificationLog(BROADCAST_USER_ID, SITE_WIDE_LEAGUE_ID, year, weekNumber, 'admin_broadcast', 'telegram');
      }
    } catch (e) {
      logger.error({ err: e }, 'Failed to send admin broadcast Telegram notification');
    }
  }

  // ----------------------------------------------------------------
  // Discord broadcast channel
  // ----------------------------------------------------------------
  if (discordEnabled) {
    try {
      const sent = await sendDiscordNotification({ title: subject, message });
      if (sent) {
        await addNotificationLog(BROADCAST_USER_ID, SITE_WIDE_LEAGUE_ID, year, weekNumber, 'admin_broadcast', 'discord');
      }
    } catch (e) {
      logger.error({ err: e }, 'Failed to send admin broadcast Discord notification');
    }
  }

  logger.info({ year, weekNumber }, 'dispatchAdminBroadcast complete');
}
