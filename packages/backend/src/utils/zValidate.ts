import z from 'zod';
import { zValidator } from '@hono/zod-validator';
import type {
  AllUserGamePicksRequest,
  UserGamePicks,
  WeekIdentifier,
  PickedGamesRequest,
} from '@shared/types/cfb-pickem-api.js';

const weekIdentifierSchema: z.ZodType<WeekIdentifier> = z.object({
  year: z.number(),
  week: z.number(),
});

const pickedGameRequestSchema: z.ZodType<PickedGamesRequest> = z.object({
  year: z.number(),
  week: z.number(),
  games: z.number().array(),
});

const userPickedGameSchema: z.ZodType<UserGamePicks> = z.object({
  game: z.number(),
  pick: z.enum(['home_team', 'away_team']),
});

const allUserPickedRequestSchema: z.ZodType<AllUserGamePicksRequest> = z.object({
  year: z.number(),
  week: z.number(),
  games: userPickedGameSchema.array(),
});

export const weekIdentifierValidator = zValidator('json', weekIdentifierSchema);
export const pickedGameRequestValidator = zValidator('json', pickedGameRequestSchema);
export const allUserPickedRequestValidator = zValidator('json', allUserPickedRequestSchema);
