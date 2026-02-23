import { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import type { AdminDbWeekData } from '@shared/types/cfb-pickem-api';
import { getPickedGames, getUserPicks, getWeeksForYear } from '../../apis/userRequests';
import { getMostRecentCompletedWeek, getCurrentSeason } from '../../utils/weekCalculation';
import { logger } from '../../utils/logger';
import UserWeekSelector from './UserWeekSelector';
import WeekResultsGameRow from './WeekResultsGameRow';
import type { WeekResultRow } from './WeekResultsGameRow';

export default function WeekResultsSection() {
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [weeks, setWeeks] = useState<AdminDbWeekData[]>([]);
  const [results, setResults] = useState<WeekResultRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState<boolean>(true);

  // Initial load: fetch weeks for prev + current year, default to most recently completed week
  useEffect(() => {
    async function initialize() {
      try {
        setInitializing(true);
        const currentSeason = getCurrentSeason();

        const [prevResult, currentSeasonResult] = await Promise.all([
          getWeeksForYear(currentSeason - 1),
          getWeeksForYear(currentSeason),
        ]);

        const allWeeks: AdminDbWeekData[] = [];
        if (prevResult.success && prevResult.data) {
          allWeeks.push(...prevResult.data.weeks);
        }
        if (currentSeasonResult.success && currentSeasonResult.data) {
          allWeeks.push(...currentSeasonResult.data.weeks);
        }

        if (allWeeks.length === 0) {
          setError('No weeks available. Please contact admin.');
          setInitializing(false);
          return;
        }

        const defaultWeek = getMostRecentCompletedWeek(allWeeks);
        setSelectedYear(defaultWeek.year);
        setSelectedWeek(defaultWeek.week);
        setWeeks(allWeeks.filter(w => w.year === defaultWeek.year));
      } catch (err) {
        logger.error('Error initializing WeekResultsSection:', err);
        setError('Failed to initialize. Please try again.');
      } finally {
        setInitializing(false);
      }
    }

    initialize();
  }, []);

  // Reload weeks when year changes
  useEffect(() => {
    if (selectedYear === 0) return;

    async function loadWeeks() {
      const result = await getWeeksForYear(selectedYear);
      if (result.success && result.data) {
        const weeksData = result.data.weeks;
        setWeeks(weeksData);
        const recent = getMostRecentCompletedWeek(weeksData);
        setSelectedWeek(recent.week);
      } else {
        setWeeks([]);
        setError(result.error || 'Failed to load weeks');
      }
    }

    loadWeeks();
  }, [selectedYear]);

  // Fetch games + picks when week selection changes
  useEffect(() => {
    if (selectedYear === 0 || selectedWeek === 0) return;

    async function loadResults() {
      try {
        setLoading(true);
        setError(null);

        const weekIdentifier = { year: selectedYear, week: selectedWeek };
        const [gamesResult, picksResult] = await Promise.all([
          getPickedGames(weekIdentifier),
          getUserPicks(weekIdentifier),
        ]);

        const games = gamesResult.success && gamesResult.data ? gamesResult.data : [];

        if (!gamesResult.success && gamesResult.error) {
          if (!gamesResult.error.includes('No picked games found')) {
            setError(gamesResult.error);
            setResults([]);
            return;
          }
        }

        // Build a map of gameId -> teamChosen from user picks
        const picksMap = new Map<number, 'home_team' | 'away_team'>();
        if (picksResult.success && picksResult.data) {
          picksResult.data.forEach(pick => {
            if (pick.teamChosen !== 'pending') {
              picksMap.set(pick.gameId, pick.teamChosen as 'home_team' | 'away_team');
            }
          });
        }

        const rows: WeekResultRow[] = games.map(game => ({
          gameId: game.gameId,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          homePoints: game.homePoints,
          awayPoints: game.awayPoints,
          winningTeam: game.winningTeam,
          completed: game.completed,
          teamChosen: picksMap.get(game.gameId) ?? null,
        }));

        setResults(rows);
      } catch (err) {
        logger.error('Error loading results:', err);
        setError('Failed to load results. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    loadResults();
  }, [selectedYear, selectedWeek]);

  if (initializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <UserWeekSelector
        selectedYear={selectedYear}
        selectedWeek={selectedWeek}
        weeks={weeks}
        onYearChange={setSelectedYear}
        onWeekChange={setSelectedWeek}
        loading={loading}
      />

      {error && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              color: 'error.main',
            }}
          >
            {error}
          </Typography>
        </Box>
      )}

      {loading && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && !error && results.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              color: 'text.secondary',
              fontSize: '1rem',
            }}
          >
            No games available for this week.
          </Typography>
        </Box>
      )}

      {!loading && !error && results.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {results.map(row => (
            <WeekResultsGameRow key={row.gameId} row={row} />
          ))}
        </Box>
      )}
    </Box>
  );
}
