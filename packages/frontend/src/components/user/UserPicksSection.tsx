import { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Snackbar, Alert } from '@mui/material';
import type { AdminDbWeekData, AdminDbGameData } from '@shared/types/cfb-pickem-api';
import { getPickedGames, getUserPicks, getWeeksForYear, postUserPicks } from '../../apis/userRequests';
import { getCurrentWeek } from '../../utils/weekCalculation';
import { logger } from '../../utils/logger';
import UserWeekSelector from './UserWeekSelector';
import UserPicksGamesList from './UserPicksGamesList';


export default function UserPicksSection() {
  const [selectedYear, setSelectedYear] = useState<number>(0);
  const [selectedWeek, setSelectedWeek] = useState<number>(0);
  const [weeks, setWeeks] = useState<AdminDbWeekData[]>([]);
  const [availableGames, setAvailableGames] = useState<AdminDbGameData[]>([]);
  const [userPicks, setUserPicks] = useState<Map<number, 'home_team' | 'away_team'>>(new Map());
  const [savedPickIds, setSavedPickIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);

  // Initial load: fetch weeks and determine current week
  useEffect(() => {
    async function initialize() {
      try {
        setInitializing(true);
        const currentYear = new Date().getFullYear();

        // Fetch weeks for previous year and current year (to handle off-season)
        const [currentYearResult, nextYearResult] = await Promise.all([
          getWeeksForYear(currentYear - 1),
          getWeeksForYear(currentYear),
        ]);

        const allWeeks: AdminDbWeekData[] = [];
        if (currentYearResult.success && currentYearResult.data) {
          allWeeks.push(...currentYearResult.data.weeks);
        }
        if (nextYearResult.success && nextYearResult.data) {
          allWeeks.push(...nextYearResult.data.weeks);
        }

        if (allWeeks.length === 0) {
          setSnackbarMessage('No weeks available. Please contact admin.');
          setSnackbarSeverity('error');
          setSnackbarOpen(true);
          setInitializing(false);
          return;
        }

        // Calculate current week
        const current = getCurrentWeek(allWeeks);
        setSelectedYear(current.year);
        setSelectedWeek(current.week);

        // Set weeks for the current year
        const weeksForYear = allWeeks.filter(w => w.year === current.year);
        setWeeks(weeksForYear);
      } catch (error) {
        logger.error('Error initializing:', error);
        setSnackbarMessage('Failed to initialize. Please try again.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      } finally {
        setInitializing(false);
      }
    }

    initialize();
  }, []);

  // Load weeks when year changes
  useEffect(() => {
    if (selectedYear === 0) return; // Skip initial render

    async function loadWeeks() {
      const result = await getWeeksForYear(selectedYear);
      if (result.success && result.data) {
        const weeksData = result.data.weeks;
        setWeeks(weeksData);
        // Reset to week 1 when year changes
        if (weeksData.length > 0) {
          const firstWeek = [...weeksData].sort((a, b) => a.weekNumber - b.weekNumber)[0];
          setSelectedWeek(firstWeek.weekNumber);
        }
      } else {
        setWeeks([]);
        setSnackbarMessage(result.error || 'Failed to load weeks');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    }

    loadWeeks();
  }, [selectedYear]);

  // Load games and picks when week changes
  useEffect(() => {
    if (selectedYear === 0 || selectedWeek === 0) return; // Skip initial render

    async function loadGamesAndPicks() {
      try {
        setLoading(true);
        const weekIdentifier = { year: selectedYear, week: selectedWeek };

        const [gamesResult, picksResult] = await Promise.all([
          getPickedGames(weekIdentifier),
          getUserPicks(weekIdentifier),
        ]);

        // Handle games
        if (gamesResult.success && gamesResult.data) {
          setAvailableGames(gamesResult.data);
        } else {
          setAvailableGames([]);
          if (gamesResult.error) {
            // Don't show error for "no games found" - it's a normal state
            if (!gamesResult.error.includes('No picked games found')) {
              setSnackbarMessage(gamesResult.error);
              setSnackbarSeverity('error');
              setSnackbarOpen(true);
            }
          }
        }

        // Handle existing picks
        if (picksResult.success && picksResult.data) {
          const picks = picksResult.data;
          const picksMap = new Map<number, 'home_team' | 'away_team'>();
          const savedIds = new Set<number>();

          picks.forEach(pick => {
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
      } catch (error) {
        logger.error('Error loading games and picks:', error);
        setSnackbarMessage('Failed to load data. Please try again.');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      } finally {
        setLoading(false);
      }
    }

    loadGamesAndPicks();
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

      // Transform Map to request format
      const picksArray = Array.from(userPicks.entries()).map(([gameId, pick]) => ({
        game: gameId,
        pick,
      }));

      const request = {
        year: selectedYear,
        week: selectedWeek,
        games: picksArray,
      };

      const result = await postUserPicks(request);

      if (result.success) {
        // Update saved picks to include all current picks
        setSavedPickIds(new Set(userPicks.keys()));
        setSnackbarMessage('Picks saved successfully!');
        setSnackbarSeverity('success');
        setSnackbarOpen(true);
      } else {
        setSnackbarMessage(result.error || 'Failed to save picks');
        setSnackbarSeverity('error');
        setSnackbarOpen(true);
      }
    } catch (error) {
      logger.error('Error submitting picks:', error);
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

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && availableGames.length === 0 && (
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

      {!loading && availableGames.length > 0 && (
        <UserPicksGamesList
          games={availableGames}
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
