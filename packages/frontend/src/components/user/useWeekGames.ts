import { useState, useEffect } from 'react';
import type { AdminWeekData } from '@shared/types/cfb-pickem-api';
import {
  getPickedGames,
  getUserPicks,
  getWeeksForYear,
  postUserPicks,
  type AdminGameWire,
} from '../../apis/userRequests';
import { getCurrentWeek, getCurrentSeason, isResultsMode } from '../../utils/weekCalculation';
import { logger } from '../../utils/logger';
import type { WeekResultRow } from './WeekResultsGameRow';

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error';
}

interface UseWeekGamesReturn {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedWeek: number;
  setSelectedWeek: (week: number) => void;
  weeks: AdminWeekData[];
  games: AdminGameWire[];
  userPicks: Map<number, 'home_team' | 'away_team'>;
  savedPickIds: Set<number>;
  loading: boolean;
  submitting: boolean;
  initializing: boolean;
  error: string | null;
  snackbar: SnackbarState;
  resultsMode: boolean;
  resultRows: WeekResultRow[];
  handlePickChange: (gameId: number, pick: 'home_team' | 'away_team') => void;
  handleSubmit: () => Promise<void>;
  handleSnackbarClose: () => void;
}

export function useWeekGames(): UseWeekGamesReturn {
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [weeks, setWeeks] = useState<AdminWeekData[]>([]);
  const [games, setGames] = useState<AdminGameWire[]>([]);
  const [userPicks, setUserPicks] = useState<Map<number, 'home_team' | 'away_team'>>(new Map());
  const [savedPickIds, setSavedPickIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'success',
  });

  const resultsMode = isResultsMode(games);

  const resultRows: WeekResultRow[] = games.map(game => ({
    gameId: game.gameId,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    homePoints: game.homePoints,
    awayPoints: game.awayPoints,
    winningTeam: game.winningTeam,
    completed: game.completed,
    teamChosen: userPicks.get(game.gameId) ?? null,
  }));

  // Initial load: fetch weeks for prev/current/next season, default to current week
  useEffect(() => {
    async function initialize() {
      try {
        setInitializing(true);
        const currentSeason = getCurrentSeason();

        const [prevSeasonResult, currentSeasonResult, nextSeasonResult] = await Promise.all([
          getWeeksForYear(currentSeason - 1),
          getWeeksForYear(currentSeason),
          getWeeksForYear(currentSeason + 1),
        ]);

        const allWeeks: AdminWeekData[] = [];
        if (prevSeasonResult.success && prevSeasonResult.data) {
          allWeeks.push(...prevSeasonResult.data.weeks);
        }
        if (currentSeasonResult.success && currentSeasonResult.data) {
          allWeeks.push(...currentSeasonResult.data.weeks);
        }
        if (nextSeasonResult.success && nextSeasonResult.data) {
          allWeeks.push(...nextSeasonResult.data.weeks);
        }

        if (allWeeks.length === 0) {
          setError('No weeks available. Please contact admin.');
          setInitializing(false);
          return;
        }

        const current = getCurrentWeek(allWeeks);
        setSelectedYear(current.year);
        setSelectedWeek(current.week);
        setWeeks(allWeeks.filter(w => w.year === current.year));
      } catch (err) {
        logger.error('Error initializing WeekGameSection:', err);
        setError('Failed to initialize. Please try again.');
      } finally {
        setInitializing(false);
      }
    }

    initialize();
  }, []);

  // Load weeks when year changes (skip during init — init already fetches and sets weeks)
  useEffect(() => {
    if (selectedYear === 0 || initializing) return;

    let cancelled = false;

    async function loadWeeks() {
      try {
        const result = await getWeeksForYear(selectedYear);
        if (cancelled) return;
        if (result.success && result.data) {
          const weeksData = result.data.weeks;
          setWeeks(weeksData);
          if (weeksData.length > 0) {
            const firstWeek = [...weeksData].sort((a, b) => a.weekNumber - b.weekNumber)[0];
            setSelectedWeek(firstWeek.weekNumber);
          }
        } else {
          setWeeks([]);
          setError(result.error ?? 'Failed to load weeks');
        }
      } catch {
        if (!cancelled) setError('Failed to load weeks. Please try again.');
      }
    }

    loadWeeks();

    return () => {
      cancelled = true;
    };
  }, [selectedYear, initializing]);

  // Load games and picks when week changes
  useEffect(() => {
    if (selectedYear === 0 || selectedWeek === 0) return;

    let cancelled = false;

    async function loadGamesAndPicks() {
      try {
        setLoading(true);
        setError(null);
        const weekIdentifier = { year: selectedYear, week: selectedWeek };

        const [gamesResult, picksResult] = await Promise.all([
          getPickedGames(weekIdentifier),
          getUserPicks(weekIdentifier),
        ]);

        if (cancelled) return;

        if (gamesResult.success && gamesResult.data) {
          setGames(gamesResult.data);
        } else {
          setGames([]);
          if (gamesResult.error && !gamesResult.error.includes('No picked games found')) {
            setError(gamesResult.error);
          }
        }

        if (picksResult.success && picksResult.data) {
          const picksMap = new Map<number, 'home_team' | 'away_team'>();
          const savedIds = new Set<number>();

          picksResult.data.forEach(pick => {
            if (pick.teamChosen !== 'pending') {
              picksMap.set(pick.gameId, pick.teamChosen);
              savedIds.add(pick.gameId);
            }
          });

          setUserPicks(picksMap);
          setSavedPickIds(savedIds);
        } else {
          setUserPicks(new Map());
          setSavedPickIds(new Set());
        }
      } catch (err) {
        if (cancelled) return;
        logger.error('Error loading games and picks:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGamesAndPicks();

    return () => {
      cancelled = true;
    };
  }, [selectedYear, selectedWeek]);

  function handlePickChange(gameId: number, pick: 'home_team' | 'away_team') {
    setUserPicks(prev => {
      const newPicks = new Map(prev);
      newPicks.set(gameId, pick);
      return newPicks;
    });
  }

  async function handleSubmit() {
    if (userPicks.size === 0) {
      setSnackbar({ open: true, message: 'Please make at least one pick before submitting', severity: 'error' });
      return;
    }

    try {
      setSubmitting(true);

      const picksArray = Array.from(userPicks.entries()).map(([gameId, pick]) => ({
        game: gameId,
        pick,
      }));

      const result = await postUserPicks({
        year: selectedYear,
        week: selectedWeek,
        games: picksArray,
      });

      if (result.success) {
        setSavedPickIds(new Set(userPicks.keys()));
        setSnackbar({ open: true, message: 'Picks saved successfully!', severity: 'success' });
      } else {
        setSnackbar({ open: true, message: result.error ?? 'Failed to save picks', severity: 'error' });
      }
    } catch (err) {
      logger.error('Error submitting picks:', err);
      setSnackbar({ open: true, message: 'An error occurred while saving picks', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSnackbarClose() {
    setSnackbar(prev => ({ ...prev, open: false }));
  }

  return {
    selectedYear,
    setSelectedYear,
    selectedWeek,
    setSelectedWeek,
    weeks,
    games,
    userPicks,
    savedPickIds,
    loading,
    submitting,
    initializing,
    error,
    snackbar,
    resultsMode,
    resultRows,
    handlePickChange,
    handleSubmit,
    handleSnackbarClose,
  };
}
