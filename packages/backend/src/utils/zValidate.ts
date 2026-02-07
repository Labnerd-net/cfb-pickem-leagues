import z from 'zod';
import { zValidator } from '@hono/zod-validator';
import type {
  // AllUserGamePicks,
  Credentials,
  PickedGamesData,
  // UserGamePicks,
  WeekIdData,
} from '@shared/types/cfb-pickem-api.js';

const loginSchema: z.ZodType<Credentials> = z.object({
  email: z.email(),
  password: z.string(),
});

const weekIdSchema: z.ZodType<WeekIdData> = z.object({
  year: z.number(),
  week: z.number(),
  seasonType: z.enum([
    'regular',
    'postseason',
    'both',
    'allstar',
    'spring_regular',
    'spring_postseason',
  ]),
});

const pickedGameSchema: z.ZodType<PickedGamesData> = z.object({
  year: z.number(),
  week: z.number(),
  seasonType: z.enum([
    'regular',
    'postseason',
    'both',
    'allstar',
    'spring_regular',
    'spring_postseason',
  ]),
  games: z.number().array(),
});

// const userPickedGameSchema: z.ZodType<UserGamePicks> = z.object({
//   game: z.number(),
//   pick: z.enum(['home_team', 'away_team']),
// });

// const allUserPickedSchema: z.ZodType<AllUserGamePicks> = z.object({
//   games: userPickedGameSchema.array(),
//   weekIdSchema,
// });

export const loginValidator = zValidator('json', loginSchema);
export const weekIdValidator = zValidator('json', weekIdSchema);
export const pickedGameValidator = zValidator('json', pickedGameSchema);
