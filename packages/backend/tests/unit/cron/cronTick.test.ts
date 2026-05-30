import { describe, it, expect, vi, beforeEach } from 'vitest';

// All mocks must be declared before imports of the module under test.
// vi.hoisted variables are accessible inside vi.mock() factories.
const mockReturnCurrentWeek = vi.hoisted(() => vi.fn());
const mockReturnGamesForWeek = vi.hoisted(() => vi.fn());
const mockGetGamesForLeagueWeek = vi.hoisted(() => vi.fn());
const mockUpsertGameForWeek = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockDispatchNotification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetGameData = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const mockGetNow = vi.hoisted(() => vi.fn());
const mockShouldSendPicksReminder = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockShouldSend24hrReminder = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockShouldRefreshScores = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockIsWeekComplete = vi.hoisted(() => vi.fn().mockReturnValue(false));
const mockGetFirstKickoff = vi.hoisted(() => vi.fn().mockReturnValue(null));
const mockGetLastKickoff = vi.hoisted(() => vi.fn().mockReturnValue(null));
const mockGetActiveLeaguesForWeek = vi.hoisted(() => vi.fn());

vi.mock('../../../src/db/dbAdminFunctions.js', () => ({
	returnCurrentWeek: mockReturnCurrentWeek,
	returnGamesForWeek: mockReturnGamesForWeek,
	getGamesForLeagueWeek: mockGetGamesForLeagueWeek,
	upsertGameForWeek: mockUpsertGameForWeek,
}));

vi.mock('../../../src/db/dbNotificationFunctions.js', () => ({
	getActiveLeaguesForWeek: mockGetActiveLeaguesForWeek,
}));

vi.mock('../../../src/notifications/dispatcher.js', () => ({
	dispatchNotification: mockDispatchNotification,
}));

vi.mock('../../../src/api/index.js', () => ({
	getGameData: mockGetGameData,
}));

vi.mock('../../../src/utils/clock.js', () => ({
	getNow: mockGetNow,
}));

vi.mock('../../../src/utils/logger.js', () => ({
	default: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock('../../../src/cron/cronLogic.js', () => ({
	shouldSendPicksReminder: mockShouldSendPicksReminder,
	shouldSend24hrReminder: mockShouldSend24hrReminder,
	shouldRefreshScores: mockShouldRefreshScores,
	isWeekComplete: mockIsWeekComplete,
	getFirstKickoff: mockGetFirstKickoff,
	getLastKickoff: mockGetLastKickoff,
}));

// runCronTick must be imported after all vi.mock() calls.
// We import it at module scope so each test in the same describe block
// shares the same module instance (and its state). Tests that need fresh
// state use a separate describe block and re-import dynamically.
import { runCronTick } from '../../../src/cron/cronTick.js';

const DEFAULT_LEAGUE = { leagueId: 1, name: 'Default League' };

function makeWeek(year: number, weekNumber: number) {
	return { year, weekNumber, seasonType: 'regular' as const };
}

function makeGame(gameId = 1) {
	return {
		gameId,
		cfbdGameId: null,
		weekNumber: 1,
		year: 2024,
		seasonType: 'regular' as const,
		completed: false,
		homeTeam: 'Team A',
		awayTeam: 'Team B',
		homePoints: null,
		awayPoints: null,
		winningTeam: 'pending' as const,
		startTime: null,
		createdAt: new Date(),
	};
}

const now = new Date('2024-09-07T18:00:00Z');

describe('runCronTick — first tick (null initial state)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('calls shouldRefreshScores with null hardCapStart and lastRefreshAt on first tick', async () => {
		mockGetNow.mockReturnValue(now);
		mockReturnCurrentWeek.mockResolvedValue(makeWeek(2024, 1));
		mockGetActiveLeaguesForWeek.mockResolvedValue([DEFAULT_LEAGUE]);
		mockReturnGamesForWeek.mockResolvedValue([makeGame()]);
		mockGetGamesForLeagueWeek.mockResolvedValue([makeGame()]);
		mockGetLastKickoff.mockReturnValue(null);

		await runCronTick();

		expect(mockShouldRefreshScores).toHaveBeenCalledWith(
			expect.objectContaining({ hardCapStart: null, lastRefreshAt: null })
		);
	});
});

describe('runCronTick — week state reset', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetNow.mockReturnValue(now);
		mockGetActiveLeaguesForWeek.mockResolvedValue([DEFAULT_LEAGUE]);
		mockReturnGamesForWeek.mockResolvedValue([makeGame()]);
		mockGetGamesForLeagueWeek.mockResolvedValue([makeGame()]);
		mockGetFirstKickoff.mockReturnValue(null);
		mockShouldSendPicksReminder.mockReturnValue(false);
		mockShouldSend24hrReminder.mockReturnValue(false);
		mockIsWeekComplete.mockReturnValue(false);
		mockGetGameData.mockResolvedValue([]);
	});

	it('preserves hardCapStart across ticks when the week does not change', async () => {
		const lastKickoff = new Date('2024-09-07T23:30:00Z');
		const nowTick1 = lastKickoff;
		const nowTick2 = new Date(lastKickoff.getTime() + 60 * 60 * 1000);

		mockGetNow
			.mockReturnValueOnce(nowTick1)
			.mockReturnValueOnce(nowTick1) // lastRefreshAt = getNow() inside refresh block
			.mockReturnValue(nowTick2);

		mockReturnCurrentWeek.mockResolvedValue(makeWeek(2024, 1));
		mockGetLastKickoff.mockReturnValue(lastKickoff);
		mockShouldRefreshScores
			.mockReturnValueOnce(true)
			.mockReturnValue(false);

		await runCronTick();
		await runCronTick();

		const tick2Args = mockShouldRefreshScores.mock.calls[1][0];
		expect(tick2Args.hardCapStart).not.toBeNull();
	});

	it('resets hardCapStart and lastRefreshAt when the week changes', async () => {
		const lastKickoff = new Date('2024-09-07T23:30:00Z');
		const nowTick1 = lastKickoff;
		const nowTick2 = new Date(lastKickoff.getTime() - 60 * 60 * 1000);

		mockGetNow
			.mockReturnValueOnce(nowTick1)
			.mockReturnValueOnce(nowTick1)
			.mockReturnValue(nowTick2);

		mockReturnCurrentWeek
			.mockResolvedValueOnce(makeWeek(2024, 1))
			.mockResolvedValue(makeWeek(2024, 2));

		mockGetLastKickoff.mockReturnValue(lastKickoff);
		mockShouldRefreshScores
			.mockReturnValueOnce(true)
			.mockReturnValue(false);

		await runCronTick();
		await runCronTick();

		const tick2Args = mockShouldRefreshScores.mock.calls[1][0];
		expect(tick2Args.hardCapStart).toBeNull();
		expect(tick2Args.lastRefreshAt).toBeNull();
	});

	it('resets per-league reminder and completion Sets when the week changes', async () => {
		const firstKickoff = new Date('2024-09-07T20:00:00Z');
		mockGetFirstKickoff.mockReturnValue(firstKickoff);
		mockGetLastKickoff.mockReturnValue(null);
		mockShouldSend24hrReminder.mockReturnValue(true);
		mockShouldSendPicksReminder.mockReturnValue(true);
		mockShouldRefreshScores.mockReturnValue(false);

		mockReturnCurrentWeek
			.mockResolvedValueOnce(makeWeek(2024, 1))
			.mockResolvedValue(makeWeek(2024, 2));

		// Tick 1 — week 1, sends both reminders for league 1
		await runCronTick();
		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({ notificationType: 'picks_reminder_24h', leagueId: 1 })
		);
		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({ notificationType: 'picks_reminder_1h', leagueId: 1 })
		);

		vi.clearAllMocks();
		mockGetNow.mockReturnValue(now);
		mockGetActiveLeaguesForWeek.mockResolvedValue([DEFAULT_LEAGUE]);
		mockReturnGamesForWeek.mockResolvedValue([makeGame()]);
		mockGetGamesForLeagueWeek.mockResolvedValue([makeGame()]);
		mockGetFirstKickoff.mockReturnValue(firstKickoff);
		mockShouldSend24hrReminder.mockReturnValue(true);
		mockShouldSendPicksReminder.mockReturnValue(true);
		mockShouldRefreshScores.mockReturnValue(false);

		// Tick 2 — week 2, Sets were reset so both reminders should fire again
		await runCronTick();
		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({ notificationType: 'picks_reminder_24h', leagueId: 1 })
		);
		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({ notificationType: 'picks_reminder_1h', leagueId: 1 })
		);
	});
});

describe('runCronTick — early exits', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns early when returnCurrentWeek returns null', async () => {
		mockGetNow.mockReturnValue(now);
		mockReturnCurrentWeek.mockResolvedValue(null);

		await runCronTick();

		expect(mockGetActiveLeaguesForWeek).not.toHaveBeenCalled();
	});

	it('returns early when there are no active leagues', async () => {
		mockGetNow.mockReturnValue(now);
		mockReturnCurrentWeek.mockResolvedValue(makeWeek(2024, 1));
		mockGetActiveLeaguesForWeek.mockResolvedValue([]);

		await runCronTick();

		expect(mockReturnGamesForWeek).not.toHaveBeenCalled();
		expect(mockDispatchNotification).not.toHaveBeenCalled();
	});

	it('returns early when global games list is empty', async () => {
		mockGetNow.mockReturnValue(now);
		mockReturnCurrentWeek.mockResolvedValue(makeWeek(2024, 1));
		mockGetActiveLeaguesForWeek.mockResolvedValue([DEFAULT_LEAGUE]);
		mockReturnGamesForWeek.mockResolvedValue([]);

		await runCronTick();

		expect(mockShouldSendPicksReminder).not.toHaveBeenCalled();
	});
});

describe('runCronTick — per-league dispatch', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetNow.mockReturnValue(now);
		mockGetLastKickoff.mockReturnValue(null);
		mockShouldRefreshScores.mockReturnValue(false);
		mockShouldSend24hrReminder.mockReturnValue(false);
		mockShouldSendPicksReminder.mockReturnValue(false);
		mockIsWeekComplete.mockReturnValue(false);
		mockGetFirstKickoff.mockReturnValue(null);
	});

	it('dispatches picks_reminder_1h for each active league', async () => {
		const leagues = [
			{ leagueId: 1, name: 'League One' },
			{ leagueId: 2, name: 'League Two' },
		];
		mockReturnCurrentWeek.mockResolvedValue(makeWeek(2024, 1));
		mockGetActiveLeaguesForWeek.mockResolvedValue(leagues);
		mockReturnGamesForWeek.mockResolvedValue([makeGame()]);
		mockGetGamesForLeagueWeek.mockResolvedValue([makeGame()]);
		mockShouldSendPicksReminder.mockReturnValue(true);

		await runCronTick();

		expect(mockDispatchNotification).toHaveBeenCalledTimes(2);
		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({ notificationType: 'picks_reminder_1h', leagueId: 1, leagueName: 'League One' })
		);
		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({ notificationType: 'picks_reminder_1h', leagueId: 2, leagueName: 'League Two' })
		);
	});

	it('dispatches rankings_updated per-league when week is complete after refresh', async () => {
		mockReturnCurrentWeek.mockResolvedValue(makeWeek(2024, 1));
		mockGetActiveLeaguesForWeek.mockResolvedValue([DEFAULT_LEAGUE]);
		mockReturnGamesForWeek.mockResolvedValue([makeGame()]);
		mockGetGamesForLeagueWeek.mockResolvedValue([makeGame()]);
		mockShouldRefreshScores.mockReturnValue(true);
		mockIsWeekComplete.mockReturnValue(true);
		mockGetGameData.mockResolvedValue([]);

		// Provide a stable getNow for the lastRefreshAt set
		mockGetNow.mockReturnValue(now);

		await runCronTick();

		expect(mockDispatchNotification).toHaveBeenCalledWith(
			expect.objectContaining({ notificationType: 'rankings_updated', leagueId: 1, leagueName: 'Default League' })
		);
	});

	it('does not dispatch rankings_updated twice for the same league+week', async () => {
		// Use week 2 so the key '1-2024-2' is fresh — week 1 key was set by a prior test
		mockReturnCurrentWeek.mockResolvedValue(makeWeek(2024, 2));
		mockGetActiveLeaguesForWeek.mockResolvedValue([DEFAULT_LEAGUE]);
		mockReturnGamesForWeek.mockResolvedValue([makeGame()]);
		mockGetGamesForLeagueWeek.mockResolvedValue([makeGame()]);
		mockShouldRefreshScores.mockReturnValue(true);
		mockIsWeekComplete.mockReturnValue(true);
		mockGetGameData.mockResolvedValue([]);
		mockGetNow.mockReturnValue(now);

		// Two consecutive ticks — second should not re-dispatch
		await runCronTick();
		const firstCallCount = mockDispatchNotification.mock.calls.filter(
			c => c[0].notificationType === 'rankings_updated'
		).length;

		await runCronTick();
		const secondCallCount = mockDispatchNotification.mock.calls.filter(
			c => c[0].notificationType === 'rankings_updated'
		).length;

		expect(firstCallCount).toBe(1);
		expect(secondCallCount).toBe(1); // no additional call on second tick
	});

	it('does not dispatch 24h reminder twice for the same league+week', async () => {
		const firstKickoff = new Date('2024-09-07T20:00:00Z');
		mockReturnCurrentWeek.mockResolvedValue(makeWeek(2024, 1));
		mockGetActiveLeaguesForWeek.mockResolvedValue([DEFAULT_LEAGUE]);
		mockReturnGamesForWeek.mockResolvedValue([makeGame()]);
		mockGetGamesForLeagueWeek.mockResolvedValue([makeGame()]);
		mockGetFirstKickoff.mockReturnValue(firstKickoff);
		mockShouldSend24hrReminder.mockReturnValue(true);

		await runCronTick();
		const firstCount = mockDispatchNotification.mock.calls.filter(
			c => c[0].notificationType === 'picks_reminder_24h'
		).length;

		await runCronTick();
		const secondCount = mockDispatchNotification.mock.calls.filter(
			c => c[0].notificationType === 'picks_reminder_24h'
		).length;

		expect(firstCount).toBe(1);
		expect(secondCount).toBe(1);
	});

	it('does not dispatch 1h reminder twice for the same league+week', async () => {
		const firstKickoff = new Date('2024-09-07T20:00:00Z');
		// Use week 3 — fresh key not used by any prior test in this describe block
		mockReturnCurrentWeek.mockResolvedValue(makeWeek(2024, 3));
		mockGetActiveLeaguesForWeek.mockResolvedValue([DEFAULT_LEAGUE]);
		mockReturnGamesForWeek.mockResolvedValue([makeGame()]);
		mockGetGamesForLeagueWeek.mockResolvedValue([makeGame()]);
		mockGetFirstKickoff.mockReturnValue(firstKickoff);
		mockShouldSendPicksReminder.mockReturnValue(true);

		await runCronTick();
		const firstCount = mockDispatchNotification.mock.calls.filter(
			c => c[0].notificationType === 'picks_reminder_1h'
		).length;

		await runCronTick();
		const secondCount = mockDispatchNotification.mock.calls.filter(
			c => c[0].notificationType === 'picks_reminder_1h'
		).length;

		expect(firstCount).toBe(1);
		expect(secondCount).toBe(1);
	});
});
