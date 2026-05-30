import { and, desc, eq, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { users, notificationPreferences, notificationLog } from './schema/users.js';
import { leagueMembers, leagues, leagueGames } from './schema/leagues.js';
import { adminGames } from './schema/admin.js';
import { db } from './index.js';
import logger from '../utils/logger.js';
import type {
  NotificationChannel,
  NotificationLogEntry,
  NotificationPreference,
  NotificationSettings,
  NotificationType,
} from '@shared/types/cfb-pickem-api.js';

// ------------------------------------------------------------------
// Return all notification preferences for a user
// ------------------------------------------------------------------
export async function returnNotificationPreferences(userId: number): Promise<NotificationPreference[]> {
  logger.debug({ userId }, 'returnNotificationPreferences');
  try {
    const rows = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId));
    return rows.map(r => ({
      userId: r.userId,
      notificationType: r.notificationType as NotificationType,
      channel: r.channel as NotificationChannel,
      enabled: r.enabled ?? true,
    }));
  } catch (e) {
    logger.error({ err: e }, 'returnNotificationPreferences failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return full notification settings for a user (email-only channels)
// ------------------------------------------------------------------
export async function returnNotificationSettings(userId: number): Promise<NotificationSettings> {
  logger.debug({ userId }, 'returnNotificationSettings');
  try {
    const [userRow] = await db
      .select({ emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.userId, userId));

    const preferences = await returnNotificationPreferences(userId);

    return {
      preferences,
      emailVerified: userRow?.emailVerified ?? false,
    };
  } catch (e) {
    logger.error({ err: e }, 'returnNotificationSettings failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Upsert a notification preference
// ------------------------------------------------------------------
export async function upsertNotificationPreference(
  userId: number,
  notificationType: NotificationType,
  channel: NotificationChannel,
  enabled: boolean
): Promise<void> {
  logger.debug({ userId, notificationType, channel, enabled }, 'upsertNotificationPreference');
  try {
    await db
      .insert(notificationPreferences)
      .values({ userId, notificationType, channel, enabled })
      .onConflictDoUpdate({
        target: [
          notificationPreferences.userId,
          notificationPreferences.notificationType,
          notificationPreferences.channel,
        ],
        set: { enabled },
      });
  } catch (e) {
    logger.error({ err: e }, 'upsertNotificationPreference failed');
    throw e;
  }
}

interface EmailOptedInUser {
  userId: number;
  email: string;
  emailVerified: boolean;
}

// ------------------------------------------------------------------
// Return users opted in to an email notification type.
// When leagueId > 0, results are filtered to that league's members.
// When leagueId = 0 (site-wide sentinel), returns all opted-in users.
// Users with no preference row are treated as opted-in by default.
// ------------------------------------------------------------------
export async function returnEmailOptedInUsers(
  notificationType: NotificationType,
  leagueId: number
): Promise<EmailOptedInUser[]> {
  logger.debug({ notificationType, leagueId }, 'returnEmailOptedInUsers');
  try {
    let query = db
      .select({
        userId: users.userId,
        email: users.email,
        emailVerified: users.emailVerified,
        prefEnabled: notificationPreferences.enabled,
      })
      .from(users)
      .$dynamic();

    if (leagueId > 0) {
      query = query.innerJoin(leagueMembers, and(
        eq(leagueMembers.userId, users.userId),
        eq(leagueMembers.leagueId, leagueId)
      ));
    }

    const rows = await query
      .leftJoin(
        notificationPreferences,
        and(
          eq(notificationPreferences.userId, users.userId),
          eq(notificationPreferences.notificationType, notificationType),
          eq(notificationPreferences.channel, 'email')
        )
      )
      .where(
        or(
          isNull(notificationPreferences.userId),
          eq(notificationPreferences.enabled, true)
        )
      );

    return rows.map(r => ({
      userId: r.userId,
      email: r.email,
      emailVerified: r.emailVerified ?? false,
    }));
  } catch (e) {
    logger.error({ err: e }, 'returnEmailOptedInUsers failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Bulk-check which users already have a sent log entry for a given
// (leagueId, year, weekNumber, notificationType, channel) tuple.
// Returns a Set of userIds — O(1) lookup for the dispatcher loop.
// ------------------------------------------------------------------
export async function returnSentNotificationUserIds(
  leagueId: number,
  year: number,
  weekNumber: number,
  notificationType: NotificationType,
  channel: NotificationChannel
): Promise<Set<number>> {
  logger.debug({ leagueId, year, weekNumber, notificationType, channel }, 'returnSentNotificationUserIds');
  try {
    const rows = await db
      .select({ userId: notificationLog.userId })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.leagueId, leagueId),
          eq(notificationLog.year, year),
          eq(notificationLog.weekNumber, weekNumber),
          eq(notificationLog.notificationType, notificationType),
          eq(notificationLog.channel, channel)
        )
      );
    return new Set(rows.map(r => r.userId));
  } catch (e) {
    logger.error({ err: e }, 'returnSentNotificationUserIds failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Log a sent notification (on conflict do nothing = idempotent)
// For broadcast channels, use userId = 0 as sentinel.
// For site-wide notifications (admin broadcast), use leagueId = 0.
// ------------------------------------------------------------------
export async function addNotificationLog(
  userId: number,
  leagueId: number,
  year: number,
  weekNumber: number,
  notificationType: NotificationType,
  channel: NotificationChannel
): Promise<void> {
  logger.debug({ userId, leagueId, year, weekNumber, notificationType, channel }, 'addNotificationLog');
  try {
    await db
      .insert(notificationLog)
      .values({ userId, leagueId, year, weekNumber, notificationType, channel })
      .onConflictDoNothing();
  } catch (e) {
    logger.error({ err: e }, 'addNotificationLog failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Check whether a notification has already been sent
// For broadcast channels, pass userId = 0.
// For site-wide notifications, pass leagueId = 0.
// ------------------------------------------------------------------
export async function hasNotificationBeenSent(
  userId: number,
  leagueId: number,
  year: number,
  weekNumber: number,
  notificationType: NotificationType,
  channel: NotificationChannel
): Promise<boolean> {
  logger.debug({ userId, leagueId, year, weekNumber, notificationType, channel }, 'hasNotificationBeenSent');
  try {
    const rows = await db
      .select({ id: notificationLog.id })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.userId, userId),
          eq(notificationLog.leagueId, leagueId),
          eq(notificationLog.year, year),
          eq(notificationLog.weekNumber, weekNumber),
          eq(notificationLog.notificationType, notificationType),
          eq(notificationLog.channel, channel)
        )
      )
      .limit(1);
    return rows.length > 0;
  } catch (e) {
    logger.error({ err: e }, 'hasNotificationBeenSent failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return notification log entries with recipient display names
// ------------------------------------------------------------------
export async function returnNotificationLogs(
  limit: number,
  offset: number,
  channel?: NotificationChannel,
  notificationType?: NotificationType
): Promise<{ entries: NotificationLogEntry[]; total: number }> {
  logger.debug({ limit, offset, channel, notificationType }, 'returnNotificationLogs');
  try {
    const conditions = [];
    if (channel) conditions.push(eq(notificationLog.channel, channel));
    if (notificationType) conditions.push(eq(notificationLog.notificationType, notificationType));
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: notificationLog.id,
          userId: notificationLog.userId,
          year: notificationLog.year,
          weekNumber: notificationLog.weekNumber,
          notificationType: notificationLog.notificationType,
          channel: notificationLog.channel,
          sentAt: notificationLog.sentAt,
          displayName: users.displayName,
        })
        .from(notificationLog)
        .leftJoin(users, eq(notificationLog.userId, users.userId))
        .where(whereClause)
        .orderBy(desc(notificationLog.sentAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(notificationLog).where(whereClause),
    ]);

    const total = countRows[0]?.count ?? 0;
    const entries: NotificationLogEntry[] = rows.map(r => ({
      id: r.id,
      userId: r.userId,
      year: r.year,
      weekNumber: r.weekNumber,
      notificationType: r.notificationType as NotificationType,
      channel: r.channel as NotificationChannel,
      sentAt: r.sentAt.toISOString(),
      recipient:
        r.userId === 0 ? 'Broadcast' : r.displayName !== null ? r.displayName : 'Deleted user',
    }));

    return { entries, total };
  } catch (e) {
    logger.error({ err: e }, 'returnNotificationLogs failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Return leagues that have at least one game for the given week.
// Used by the cron to iterate over active leagues.
// ------------------------------------------------------------------
export async function getActiveLeaguesForWeek(
  year: number,
  weekNumber: number
): Promise<{ leagueId: number; name: string }[]> {
  logger.debug({ year, weekNumber }, 'getActiveLeaguesForWeek');
  try {
    const rows = await db
      .selectDistinct({
        leagueId: leagues.leagueId,
        name: leagues.name,
      })
      .from(leagueGames)
      .innerJoin(adminGames, eq(leagueGames.gameId, adminGames.gameId))
      .innerJoin(leagues, eq(leagueGames.leagueId, leagues.leagueId))
      .where(
        and(
          eq(adminGames.year, year),
          eq(adminGames.weekNumber, weekNumber)
        )
      );
    return rows;
  } catch (e) {
    logger.error({ err: e }, 'getActiveLeaguesForWeek failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Set email verification token
// ------------------------------------------------------------------
export async function setEmailVerificationToken(
  userId: number,
  token: string,
  sentAt: Date
): Promise<void> {
  logger.debug({ userId }, 'setEmailVerificationToken');
  try {
    await db
      .update(users)
      .set({ emailVerificationToken: token, emailVerificationSentAt: sentAt })
      .where(eq(users.userId, userId));
  } catch (e) {
    logger.error({ err: e }, 'setEmailVerificationToken failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Mark email as verified by token; returns the user or null
// ------------------------------------------------------------------
export async function markEmailVerified(token: string): Promise<{ userId: number } | null> {
  logger.debug('markEmailVerified');
  try {
    const rows = await db
      .update(users)
      .set({ emailVerified: true, emailVerificationToken: null, emailVerificationSentAt: null })
      .where(and(eq(users.emailVerificationToken, token), isNotNull(users.emailVerificationToken)))
      .returning({ userId: users.userId });
    return rows.length > 0 ? rows[0] : null;
  } catch (e) {
    logger.error({ err: e }, 'markEmailVerified failed');
    throw e;
  }
}
