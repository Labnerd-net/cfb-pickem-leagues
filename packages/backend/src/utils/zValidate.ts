import z from 'zod';
import { zValidator } from '@hono/zod-validator';
import type {
  AllUserGamePicksRequest,
  UserGamePicks,
  WeekIdentifier,
  PickedGamesRequest,
  MarkGameCompleteRequest,
} from '@shared/types/cfb-pickem-api.js';

const notificationTypeEnum = z.enum(['games_ready', 'picks_reminder', 'rankings_updated']);
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

export const markGameCompleteValidator = zValidator('json', markGameCompleteSchema);
export const weekIdentifierValidator = zValidator('json', weekIdentifierSchema);
export const pickedGameRequestValidator = zValidator('json', pickedGameRequestSchema);
export const allUserPickedRequestValidator = zValidator('json', allUserPickedRequestSchema);
export const updateUserRolesValidator = zValidator('json', updateUserRolesSchema);
export const notificationPreferenceValidator = zValidator('json', notificationPreferenceSchema);
export const verifyEmailQueryValidator = zValidator('query', verifyEmailQuerySchema);
export const registerRequestValidator = zValidator('json', registerRequestSchema);
export const loginRequestValidator = zValidator('json', loginRequestSchema);
