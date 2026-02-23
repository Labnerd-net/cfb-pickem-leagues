import z from 'zod';
import { zValidator } from '@hono/zod-validator';
import type {
  AllUserGamePicksRequest,
  UserGamePicks,
  WeekIdentifier,
  PickedGamesRequest,
} from '@shared/types/cfb-pickem-api.js';

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

export const weekIdentifierValidator = zValidator('json', weekIdentifierSchema);
export const pickedGameRequestValidator = zValidator('json', pickedGameRequestSchema);
export const allUserPickedRequestValidator = zValidator('json', allUserPickedRequestSchema);
