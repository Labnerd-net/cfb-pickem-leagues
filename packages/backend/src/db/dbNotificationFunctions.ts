import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';
import { users, notificationPreferences, notificationLog } from './schema/users.js';
import { db } from './index.js';
import logger from '../utils/logger.js';
import type {
  NotificationChannel,
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
// Return full notification settings for a user
// ------------------------------------------------------------------
export async function returnNotificationSettings(userId: number): Promise<NotificationSettings> {
  logger.debug({ userId }, 'returnNotificationSettings');
  try {
    const [userRow] = await db
      .select({ ntfyServerUrl: users.ntfyServerUrl, emailVerified: users.emailVerified })
      .from(users)
      .where(eq(users.userId, userId));

    const preferences = await returnNotificationPreferences(userId);

    return {
      preferences,
      ntfyServerUrl: userRow?.ntfyServerUrl ?? null,
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

interface OptedInUser {
  userId: number;
  email: string;
  ntfyServerUrl: string | null;
  emailVerified: boolean;
}

// ------------------------------------------------------------------
// Return users opted in to a notification type + channel
// Users with no preference row are treated as opted-in by default
// ------------------------------------------------------------------
export async function returnOptedInUsers(
  notificationType: NotificationType,
  channel: NotificationChannel
): Promise<OptedInUser[]> {
  logger.debug({ notificationType, channel }, 'returnOptedInUsers');
  try {
    // LEFT JOIN so users with no preference row appear with NULL for preference columns.
    // Include the user if: no preference row (NULL) OR enabled=true.
    const rows = await db
      .select({
        userId: users.userId,
        email: users.email,
        ntfyServerUrl: users.ntfyServerUrl,
        emailVerified: users.emailVerified,
        prefEnabled: notificationPreferences.enabled,
      })
      .from(users)
      .leftJoin(
        notificationPreferences,
        and(
          eq(notificationPreferences.userId, users.userId),
          eq(notificationPreferences.notificationType, notificationType),
          eq(notificationPreferences.channel, channel)
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
      ntfyServerUrl: r.ntfyServerUrl ?? null,
      emailVerified: r.emailVerified ?? false,
    }));
  } catch (e) {
    logger.error({ err: e }, 'returnOptedInUsers failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Log a sent notification (on conflict do nothing = idempotent)
// ------------------------------------------------------------------
export async function addNotificationLog(
  userId: number,
  year: number,
  weekNumber: number,
  notificationType: NotificationType,
  channel: NotificationChannel
): Promise<void> {
  logger.debug({ userId, year, weekNumber, notificationType, channel }, 'addNotificationLog');
  try {
    await db
      .insert(notificationLog)
      .values({ userId, year, weekNumber, notificationType, channel })
      .onConflictDoNothing();
  } catch (e) {
    logger.error({ err: e }, 'addNotificationLog failed');
    throw e;
  }
}

// ------------------------------------------------------------------
// Check whether a notification has already been sent
// ------------------------------------------------------------------
export async function hasNotificationBeenSent(
  userId: number,
  year: number,
  weekNumber: number,
  notificationType: NotificationType,
  channel: NotificationChannel
): Promise<boolean> {
  logger.debug({ userId, year, weekNumber, notificationType, channel }, 'hasNotificationBeenSent');
  try {
    const rows = await db
      .select({ id: notificationLog.id })
      .from(notificationLog)
      .where(
        and(
          eq(notificationLog.userId, userId),
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
// Update a user's NTFY server URL
// ------------------------------------------------------------------
export async function updateUserNtfyUrl(userId: number, ntfyServerUrl: string | null): Promise<void> {
  logger.debug({ userId, ntfyServerUrl }, 'updateUserNtfyUrl');
  try {
    await db.update(users).set({ ntfyServerUrl }).where(eq(users.userId, userId));
  } catch (e) {
    logger.error({ err: e }, 'updateUserNtfyUrl failed');
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
