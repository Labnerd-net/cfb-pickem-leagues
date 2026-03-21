import { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Snackbar, Alert } from '@mui/material';
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
import UserWeekSelector from './UserWeekSelector';
import UserPicksGamesList from './UserPicksGamesList';
import WeekResultsGameRow from './WeekResultsGameRow';
import type { WeekResultRow } from './WeekResultsGameRow';

export default function WeekGameSection() {
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
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  const resultsMode = isResultsMode(games);

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

  // Load weeks when year changes
  useEffect(() => {
    if (selectedYear === 0) return;

    async function loadWeeks() {
      const result = await getWeeksForYear(selectedYear);
      if (result.success && result.data) {
        const weeksData = result.data.weeks;
        setWeeks(weeksData);
        if (weeksData.length > 0) {
          const firstWeek = [...weeksData].sort((a, b) => a.weekNumber - b.weekNumber)[0];
          setSelectedWeek(firstWeek.weekNumber);
        }
      } else {
        setWeeks([]);
        setError(result.error || 'Failed to load weeks');
      }
    }

    loadWeeks();
  }, [selectedYear]);

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

  const handlePickChange = (gameId: number, pick: 'home_team' | 'away_team') => {
    setUserPicks(prev => {
      const newPicks = new Map(prev);
      newPicks.set(gameId, pick);
      return newPicks;
    });
  };

  const handleSubmit = async () => {
    if (userPicks.size === 0) {
      setSnackbarMessage('Please make at least one pick before submitting');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
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
        setSnackbarMessage('Picks saved successfully!');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      } else {
        setSnackbarMessage(result.error || 'Failed to save picks');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch (err) {
      logger.error('Error submitting picks:', err);
      setSnackbarMessage('An error occurred while saving picks');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  if (initializing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

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
          <Typography sx={{ fontFamily: '"Work Sans", sans-serif', color: 'error.main' }}>
            {error}
          </Typography>
        </Box>
      )}

      {loading && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && !error && games.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              color: 'text.secondary',
              fontSize: '1rem',
            }}
          >
            No games available for this week. Check back later!
          </Typography>
        </Box>
      )}

      {!loading && !error && games.length > 0 && resultsMode && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {resultRows.map(row => (
            <WeekResultsGameRow key={row.gameId} row={row} />
          ))}
        </Box>
      )}

      {!loading && !error && games.length > 0 && !resultsMode && (
        <UserPicksGamesList
          games={games}
          picks={userPicks}
          savedPicks={savedPickIds}
          onPickChange={handlePickChange}
          onSubmit={handleSubmit}
          loading={submitting}
        />
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
