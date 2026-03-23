import z from 'zod';
import { zValidator } from '@hono/zod-validator';
import type {
  AllUserGamePicksRequest,
  UserGamePicks,
  WeekIdentifier,
  PickedGamesRequest,
  MarkGameCompleteRequest,
} from '@shared/types/cfb-pickem-api.js';

const notificationTypeEnum = z.enum(['games_ready', 'picks_reminder_1h', 'picks_reminder_24h', 'rankings_updated']);
const notificationChannelEnum = z.enum(['email']);

const notificationPreferenceSchema = z.object({
  notificationType: notificationTypeEnum,
  channel: notificationChannelEnum,
  enabled: z.boolean(),
});

const verifyEmailQuerySchema = z.object({
  token: z.string().min(1),
});

const updateUserRolesSchema = z.object({
  roles: z.array(z.enum(['user', 'admin'])).min(1),
});

const yearSchema = z.number().int().min(1900).max(2100);
const weekSchema = z.number().int().min(1).max(52);

const yearQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
});

const weekIdentifierQuerySchema = z.object({
  year: z.coerce.number().int().min(1900).max(2100),
  weekNumber: z.coerce.number().int().min(1).max(52),
});

const weekIdentifierSchema: z.ZodType<WeekIdentifier> = z.object({
  year: yearSchema,
  week: weekSchema,
});

const pickedGameRequestSchema: z.ZodType<PickedGamesRequest> = z.object({
  year: yearSchema,
  week: weekSchema,
  games: z.number().int().positive().array(),
});

const userPickedGameSchema: z.ZodType<UserGamePicks> = z.object({
  game: z.number().int().positive(),
  pick: z.enum(['home_team', 'away_team']),
});

const allUserPickedRequestSchema: z.ZodType<AllUserGamePicksRequest> = z.object({
  year: yearSchema,
  week: weekSchema,
  games: userPickedGameSchema.array(),
});

const markGameCompleteSchema: z.ZodType<MarkGameCompleteRequest> = z.object({
  gameId: z.number().int().positive(),
  homePoints: z.number().int().min(0),
  awayPoints: z.number().int().min(0),
});

const registerRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
  displayName: z.string().trim().min(1).max(50),
});

const loginRequestSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(50).optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const hasCurrent = val.currentPassword !== undefined;
    const hasNew = val.newPassword !== undefined;
    if (hasCurrent !== hasNew) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'currentPassword and newPassword must both be provided together',
      });
    }
    if (!val.displayName && !hasCurrent && !hasNew) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one field must be provided',
      });
    }
  });

const adminBroadcastBodySchema = z.object({
  subject: z.string().min(1).max(100),
  message: z.string().min(1).max(1000),
  overrideEmailPreferences: z.boolean(),
});

const correctGameScoreParamSchema = z.object({
  gameId: z.coerce.number().int().positive(),
});

const correctGameScoreBodySchema = z.object({
  homePoints: z.number().int().min(0),
  awayPoints: z.number().int().min(0),
});

export const correctGameScoreParamValidator = zValidator('param', correctGameScoreParamSchema);
export const correctGameScoreBodyValidator = zValidator('json', correctGameScoreBodySchema);
export const yearQueryValidator = zValidator('query', yearQuerySchema);
export const weekIdentifierQueryValidator = zValidator('query', weekIdentifierQuerySchema);
export const markGameCompleteValidator = zValidator('json', markGameCompleteSchema);
export const weekIdentifierValidator = zValidator('json', weekIdentifierSchema);
export const pickedGameRequestValidator = zValidator('json', pickedGameRequestSchema);
export const allUserPickedRequestValidator = zValidator('json', allUserPickedRequestSchema);
export const updateUserRolesValidator = zValidator('json', updateUserRolesSchema);
export const notificationPreferenceValidator = zValidator('json', notificationPreferenceSchema);
export const verifyEmailQueryValidator = zValidator('query', verifyEmailQuerySchema);
export const registerRequestValidator = zValidator('json', registerRequestSchema);
export const loginRequestValidator = zValidator('json', loginRequestSchema);
export const updateProfileValidator = zValidator('json', updateProfileSchema);
export const adminBroadcastBodyValidator = zValidator('json', adminBroadcastBodySchema);
