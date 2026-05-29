import { describe, it, expect, vi, beforeEach } from 'vitest';

// All mocks must be declared before imports of the module under test.
// vi.hoisted variables are accessible inside vi.mock() factories.
const mockReturnCurrentWeek = vi.hoisted(() => vi.fn());
const mockReturnGamesForWeek = vi.hoisted(() => vi.fn());
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

vi.mock('../../../src/db/dbAdminFunctions.js', () => ({
	returnCurrentWeek: mockReturnCurrentWeek,
	returnGamesForWeek: mockReturnGamesForWeek,
	upsertGameForWeek: mockUpsertGameForWeek,
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

function makeWeek(year: number, weekNumber: number) {
	return { year, weekNumber, seasonType: 'regular' as const };
}

function makeGame(gameId = 1) {
	return {
		gameId,
		cfbdGameId: null,
		ncaaGameId: null,
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
		mockReturnGamesForWeek.mockResolvedValue([makeGame()]);
		mockGetLastKickoff.mockReturnValue(null);

		await runCronTick();

		expect(mockShouldRefreshScores).toHaveBeenCalledWith(
			expect.objectContaining({ hardCapStart: null, lastRefreshAt: null })
		);
	});
});

describe('runCronTick — week state reset', () => {
	// These tests share one module instance across ticks so that module-level
	// state (lastWeekKey, hardCapStart, lastRefreshAt) accumulates correctly.
	beforeEach(() => {
		vi.clearAllMocks();
		// Default safe return values
		mockGetNow.mockReturnValue(now);
		mockReturnGamesForWeek.mockResolvedValue([makeGame()]);
		mockGetFirstKickoff.mockReturnValue(null);
		mockShouldSendPicksReminder.mockReturnValue(false);
		mockIsWeekComplete.mockReturnValue(false);
		mockGetGameData.mockResolvedValue([]);
	});

	it('preserves hardCapStart across ticks when the week does not change', async () => {
		const lastKickoff = new Date('2024-09-07T23:30:00Z');
		const nowTick1 = lastKickoff; // triggers hardCapStart to be set
		const nowTick2 = new Date(lastKickoff.getTime() + 60 * 60 * 1000);

		mockGetNow
			.mockReturnValueOnce(nowTick1) // tick 1 runCronTick
			.mockReturnValueOnce(nowTick1) // tick 1 lastRefreshAt = getNow() inside refresh block
			.mockReturnValue(nowTick2);    // tick 2

		mockReturnCurrentWeek.mockResolvedValue(makeWeek(2024, 1));
		mockGetLastKickoff.mockReturnValue(lastKickoff);
		mockShouldRefreshScores
			.mockReturnValueOnce(true)  // tick 1: triggers refresh + sets lastRefreshAt
			.mockReturnValue(false);    // tick 2: throttled

		// Tick 1 — sets hardCapStart because now >= lastKickoff
		await runCronTick();
		// Tick 2 — same week, hardCapStart must still be set
		await runCronTick();

		const tick2Args = mockShouldRefreshScores.mock.calls[1][0];
		expect(tick2Args.hardCapStart).not.toBeNull();
	});

	it('resets hardCapStart and lastRefreshAt when the week changes', async () => {
		const lastKickoff = new Date('2024-09-07T23:30:00Z');
		const nowTick1 = lastKickoff; // triggers hardCapStart set on tick 1
		// nowTick2 is BEFORE lastKickoff so the hardCapStart guard doesn't re-fire on tick 2
		const nowTick2 = new Date(lastKickoff.getTime() - 60 * 60 * 1000);

		mockGetNow
			.mockReturnValueOnce(nowTick1) // tick 1
			.mockReturnValueOnce(nowTick1) // lastRefreshAt inside refresh block
			.mockReturnValue(nowTick2);    // tick 2

		mockReturnCurrentWeek
			.mockResolvedValueOnce(makeWeek(2024, 1)) // tick 1
			.mockResolvedValue(makeWeek(2024, 2));    // tick 2

		mockGetLastKickoff.mockReturnValue(lastKickoff);
		mockShouldRefreshScores
			.mockReturnValueOnce(true) // tick 1: fires, sets lastRefreshAt
			.mockReturnValue(false);   // tick 2

		// Tick 1 — week 1, sets hardCapStart and lastRefreshAt
		await runCronTick();
		// Tick 2 — week 2, should reset both to null; nowTick2 < lastKickoff so hardCapStart stays null
		await runCronTick();

		const tick2Args = mockShouldRefreshScores.mock.calls[1][0];
		expect(tick2Args.hardCapStart).toBeNull();
		expect(tick2Args.lastRefreshAt).toBeNull();
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

		expect(mockReturnGamesForWeek).not.toHaveBeenCalled();
	});

	it('returns early when there are no picked games', async () => {
		mockGetNow.mockReturnValue(now);
		mockReturnCurrentWeek.mockResolvedValue(makeWeek(2024, 1));
		mockReturnGamesForWeek.mockResolvedValue([]);

		await runCronTick();

		expect(mockShouldSendPicksReminder).not.toHaveBeenCalled();
	});
});
