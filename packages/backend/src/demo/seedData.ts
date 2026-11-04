import type { SeasonType, Team } from '@shared/types/cfb-pickem-api.js';

// ------------------------------------------------------------------
// Demo seed data.
//
// The game data (real 2024 schedule and results) is exported once from CFBD into
// demoGameData.ts by `pnpm export:demo-games`. Everything else — users, the league,
// memberships, picks, notification log rows — is generated here deterministically, so a
// reset always produces identical data.
// ------------------------------------------------------------------

export const DEMO_YEAR = 2024;
export const DEMO_SEASON_TYPE: SeasonType = 'regular';

/** Weeks 1..COMPLETED_THROUGH_WEEK are final; the next week is open for picks. */
export const COMPLETED_THROUGH_WEEK = 3;
export const OPEN_WEEK = COMPLETED_THROUGH_WEEK + 1;
/** Games for this week exist in the global cache but are NOT in the league pool (admin curates them). */
export const CURATION_WEEK = OPEN_WEEK + 1;

// Fixed IDs so JWTs issued before a nightly reset stay valid after it.
export const DEMO_ADMIN_USER_ID = 1;
export const DEMO_USER_USER_ID = 2;
export const DEMO_LEAGUE_ID = 1;

export const DEMO_ADMIN_EMAIL = 'demo-admin@demo.invalid';
export const DEMO_USER_EMAIL = 'demo-user@demo.invalid';

// Valid "salt:hash" format that no password maps to, so password login can never succeed
// for the seeded accounts (visitors use demo-login). Random bytes, discarded.
const UNUSABLE_PASSWORD_HASH =
  'AkDOUbGIZO5Gql8nAq+yug==:oMqP0Ba9iqXTxMVYI3uUyyeTQ25Xsjl2hKqrfIPpT3M=';

export interface DemoWeek {
  weekNumber: number;
  year: number;
  seasonType: SeasonType;
  weekStart: string;
  weekEnd: string;
}

export interface DemoGame {
  cfbdGameId: number | null;
  weekNumber: number;
  homeTeam: string;
  awayTeam: string;
  /** ISO 8601 */
  startTime: string;
  completed: boolean;
  homePoints: number | null;
  awayPoints: number | null;
  spread: number | null;
}

export interface DemoGameData {
  weeks: DemoWeek[];
  games: DemoGame[];
}

export interface DemoSeedGame {
  gameId: number;
  cfbdGameId: number | null;
  weekNumber: number;
  year: number;
  seasonType: SeasonType;
  completed: boolean;
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
  winningTeam: Team;
  startTime: Date;
  spread: number | null;
}

export interface DemoSeedUser {
  userId: number;
  email: string;
  displayName: string;
  passwordHash: string;
  roles: ('admin' | 'user')[];
  emailVerified: boolean;
}

export interface DemoSeedPick {
  userId: number;
  gameId: number;
  leagueId: number;
  teamChosen: Team;
}

export interface DemoSeedLogRow {
  userId: number;
  leagueId: number;
  year: number;
  weekNumber: number;
  notificationType: string;
  channel: string;
  sentAt: Date;
}

export interface DemoSeed {
  weeks: DemoWeek[];
  games: DemoSeedGame[];
  users: DemoSeedUser[];
  league: { leagueId: number; name: string; inviteCode: string; createdBy: number };
  members: { leagueId: number; userId: number; role: 'admin' | 'member' }[];
  /** Game IDs in the league pool (every game except the curation week's). */
  leagueGameIds: number[];
  picks: DemoSeedPick[];
  notificationLog: DemoSeedLogRow[];
}

const FAKE_MEMBERS: { name: string; skill: number }[] = [
  { name: 'Tailgate Tom', skill: 0.78 },
  { name: 'Blitz Bella', skill: 0.72 },
  { name: 'Hail Mary Hank', skill: 0.7 },
  { name: 'Red Zone Rita', skill: 0.66 },
  { name: 'Gridiron Gus', skill: 0.62 },
  { name: 'Pylon Penny', skill: 0.58 },
  { name: 'Fumble Fred', skill: 0.55 },
  { name: 'Punt Patty', skill: 0.5 },
];
const DEMO_USER_SKILL = 0.65;
const DEMO_ADMIN_SKILL = 0.7;

// Small deterministic PRNG so every reset produces the same picks.
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function winnerOf(g: { homePoints: number | null; awayPoints: number | null; completed: boolean }): Team {
  if (!g.completed || g.homePoints == null || g.awayPoints == null) return 'pending';
  if (g.homePoints > g.awayPoints) return 'home_team';
  if (g.awayPoints > g.homePoints) return 'away_team';
  return 'pending';
}

/**
 * Validates the exported CFBD game data and expands it into a full seed.
 * Throws a descriptive error if the data is missing or shaped wrong, so a bad or empty
 * export can never silently produce an empty demo.
 */
export function buildDemoSeed(data: DemoGameData): DemoSeed {
  if (!data.weeks.length || !data.games.length) {
    throw new Error('Demo game data is empty. Run `pnpm export:demo-games` to generate it.');
  }

  for (let w = 1; w <= CURATION_WEEK; w++) {
    const week = data.weeks.find(x => x.weekNumber === w && x.year === DEMO_YEAR);
    if (!week) throw new Error(`Demo game data is missing week ${w}`);
    const weekGames = data.games.filter(g => g.weekNumber === w);
    if (weekGames.length === 0) throw new Error(`Demo game data has no games for week ${w}`);
    for (const g of weekGames) {
      const mustBeFinal = w <= COMPLETED_THROUGH_WEEK;
      if (mustBeFinal && (!g.completed || g.homePoints == null || g.awayPoints == null)) {
        throw new Error(`Week ${w} game ${g.homeTeam} vs ${g.awayTeam} must be completed with a score`);
      }
      if (!mustBeFinal && (g.completed || g.homePoints != null || g.awayPoints != null)) {
        throw new Error(`Week ${w} game ${g.homeTeam} vs ${g.awayTeam} must not have a result`);
      }
    }
  }

  const seen = new Set<string>();
  const games: DemoSeedGame[] = data.games.map((g, i) => {
    const key = `${g.weekNumber}|${g.homeTeam}|${g.awayTeam}`;
    if (seen.has(key)) throw new Error(`Duplicate game in demo data: ${key}`);
    seen.add(key);
    return {
      gameId: i + 1,
      cfbdGameId: g.cfbdGameId,
      weekNumber: g.weekNumber,
      year: DEMO_YEAR,
      seasonType: DEMO_SEASON_TYPE,
      completed: g.completed,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      homePoints: g.homePoints,
      awayPoints: g.awayPoints,
      winningTeam: winnerOf(g),
      startTime: new Date(g.startTime),
      spread: g.spread,
    };
  });

  const users: DemoSeedUser[] = [
    {
      userId: DEMO_ADMIN_USER_ID,
      email: DEMO_ADMIN_EMAIL,
      displayName: 'Demo Admin',
      passwordHash: UNUSABLE_PASSWORD_HASH,
      roles: ['admin', 'user'],
      emailVerified: true,
    },
    {
      userId: DEMO_USER_USER_ID,
      email: DEMO_USER_EMAIL,
      displayName: 'Demo User',
      passwordHash: UNUSABLE_PASSWORD_HASH,
      roles: ['user'],
      emailVerified: true,
    },
    ...FAKE_MEMBERS.map((m, i) => ({
      userId: 3 + i,
      email: `member${3 + i}@demo.invalid`,
      displayName: m.name,
      passwordHash: UNUSABLE_PASSWORD_HASH,
      roles: ['user' as const],
      emailVerified: true,
    })),
  ];

  const skills = new Map<number, number>([
    [DEMO_ADMIN_USER_ID, DEMO_ADMIN_SKILL],
    [DEMO_USER_USER_ID, DEMO_USER_SKILL],
    ...FAKE_MEMBERS.map((m, i): [number, number] => [3 + i, m.skill]),
  ]);

  const leagueGameIds = games.filter(g => g.weekNumber < CURATION_WEEK).map(g => g.gameId);
  const poolGames = games.filter(g => g.weekNumber < CURATION_WEEK);

  const picks: DemoSeedPick[] = [];
  for (const user of users) {
    const rand = mulberry32(user.userId * 7919);
    const skill = skills.get(user.userId) ?? 0.5;
    const isVisitorAccount = user.userId === DEMO_ADMIN_USER_ID || user.userId === DEMO_USER_USER_ID;
    for (const g of poolGames) {
      if (g.weekNumber <= COMPLETED_THROUGH_WEEK) {
        const winner = g.winningTeam;
        if (winner === 'pending') continue;
        const loser: Team = winner === 'home_team' ? 'away_team' : 'home_team';
        picks.push({
          userId: user.userId,
          gameId: g.gameId,
          leagueId: DEMO_LEAGUE_ID,
          teamChosen: rand() < skill ? winner : loser,
        });
      } else if (g.weekNumber === OPEN_WEEK && !isVisitorAccount) {
        // Fake members have mostly made their picks for the open week; the visitor's accounts
        // are left blank so there is something to do.
        if (rand() < 0.85) {
          picks.push({
            userId: user.userId,
            gameId: g.gameId,
            leagueId: DEMO_LEAGUE_ID,
            teamChosen: rand() < 0.5 ? 'home_team' : 'away_team',
          });
        }
      }
    }
  }

  const DAY_MS = 86_400_000;
  const notificationLog: DemoSeedLogRow[] = [];
  for (let w = 1; w <= COMPLETED_THROUGH_WEEK; w++) {
    const lastKickoff = Math.max(...games.filter(g => g.weekNumber === w).map(g => g.startTime.getTime()));
    for (const u of users.slice(2, 6)) {
      notificationLog.push({
        userId: u.userId,
        leagueId: DEMO_LEAGUE_ID,
        year: DEMO_YEAR,
        weekNumber: w,
        notificationType: 'rankings_updated',
        channel: 'email',
        sentAt: new Date(lastKickoff + DAY_MS),
      });
    }
  }
  const openWeekRow = data.weeks.find(x => x.weekNumber === OPEN_WEEK)!;
  for (const u of users.slice(2)) {
    notificationLog.push({
      userId: u.userId,
      leagueId: DEMO_LEAGUE_ID,
      year: DEMO_YEAR,
      weekNumber: OPEN_WEEK,
      notificationType: 'games_ready',
      channel: 'email',
      sentAt: new Date(`${openWeekRow.weekStart.slice(0, 10)}T15:00:00Z`),
    });
  }

  return {
    weeks: data.weeks
      .filter(w => w.year === DEMO_YEAR && w.weekNumber <= CURATION_WEEK)
      .map(w => ({ ...w, weekStart: w.weekStart.slice(0, 10), weekEnd: w.weekEnd.slice(0, 10) })),
    games,
    users,
    league: { leagueId: DEMO_LEAGUE_ID, name: 'Demo League', inviteCode: 'demo2024', createdBy: DEMO_ADMIN_USER_ID },
    members: users.map(u => ({
      leagueId: DEMO_LEAGUE_ID,
      userId: u.userId,
      role: u.userId === DEMO_ADMIN_USER_ID ? ('admin' as const) : ('member' as const),
    })),
    leagueGameIds,
    picks,
    notificationLog,
  };
}
