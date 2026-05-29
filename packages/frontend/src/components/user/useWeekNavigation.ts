import { useState, useEffect } from 'react';
import type { AdminWeekData } from '@shared/types/cfb-pickem-api';
import { getPickedGames, getWeeksForYear, type AdminGameWire } from '../../apis/userRequests';
import { useLeague } from '../../contexts/LeagueContext';
import { getCurrentWeek, getCurrentSeason } from '../../utils/weekCalculation';
import { logger } from '../../utils/logger';

export interface UseWeekNavigationReturn {
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedWeek: number;
  setSelectedWeek: (week: number) => void;
  availableYears: number[];
  weeks: AdminWeekData[];
  games: AdminGameWire[];
  loading: boolean;
  initializing: boolean;
  error: string | null;
}

export function useWeekNavigation(): UseWeekNavigationReturn {
  const { activeLeague } = useLeague();
  const leagueId = activeLeague?.leagueId ?? 1;
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [weeks, setWeeks] = useState<AdminWeekData[]>([]);
  const [games, setGames] = useState<AdminGameWire[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

        const years = [...new Set(allWeeks.map(w => w.year))].sort((a, b) => b - a);
        setAvailableYears(years);

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

  // Load games when week changes
  useEffect(() => {
    if (selectedYear === 0 || selectedWeek === 0) return;

    let cancelled = false;

    async function loadGames() {
      try {
        setLoading(true);
        setError(null);
        const gamesResult = await getPickedGames({ year: selectedYear, week: selectedWeek }, leagueId);

        if (cancelled) return;

        if (gamesResult.success && gamesResult.data) {
          setGames(gamesResult.data);
        } else {
          setGames([]);
          if (gamesResult.error && !gamesResult.error.includes('No picked games found')) {
            setError(gamesResult.error);
          }
        }
      } catch (err) {
        if (cancelled) return;
        logger.error('Error loading games:', err);
        setError('Failed to load data. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGames();

    return () => {
      cancelled = true;
    };
  }, [selectedYear, selectedWeek, leagueId]);

  return {
    selectedYear,
    setSelectedYear,
    selectedWeek,
    setSelectedWeek,
    availableYears,
    weeks,
    games,
    loading,
    initializing,
    error,
  };
}
