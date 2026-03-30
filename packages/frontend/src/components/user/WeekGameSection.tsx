import { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Snackbar, Alert } from '@mui/material';
import UserWeekSelector from './UserWeekSelector';
import UserPicksGamesList from './UserPicksGamesList';
import WeekResultsView from './WeekResultsView';
import LockWarningDialog from './LockWarningDialog';
import { useWeekGames } from './useWeekGames';
import { isWarningThreshold } from '../../utils/countdownFormat';

export default function WeekGameSection() {
  const {
    selectedYear,
    setSelectedYear,
    selectedWeek,
    setSelectedWeek,
    availableYears,
    weeks,
    games,
    now,
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
  } = useWeekGames();

  const ignoreDeadline = import.meta.env.VITE_IGNORE_PICK_DEADLINE === 'true';
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);

  // Reset dismissed state when the user navigates to a different week
  useEffect(() => {
    setWarningDismissed(false);
    setWarningOpen(false);
  }, [selectedWeek, selectedYear]);

  // Evaluate warning trigger on each clock tick
  useEffect(() => {
    if (ignoreDeadline || resultsMode || warningDismissed || warningOpen || games.length === 0) return;

    const earliestUnlocked = games
      .filter(g => g.startTime !== null && now < new Date(g.startTime))
      .sort((a, b) => new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime())[0];

    if (!earliestUnlocked) return;

    const msRemaining = new Date(earliestUnlocked.startTime!).getTime() - now.getTime();
    if (!isWarningThreshold(msRemaining)) return;

    const hasUnsaved = [...userPicks.keys()].some(id => !savedPickIds.has(id));
    if (hasUnsaved) {
      setWarningOpen(true);
    }
  }, [now, games, userPicks, savedPickIds, resultsMode, warningDismissed, warningOpen, ignoreDeadline]);

  // Compute props for the warning dialog
  const unsavedCount = [...userPicks.keys()].filter(id => !savedPickIds.has(id)).length;
  const earliestUnlockedMs = games
    .filter(g => g.startTime !== null && now < new Date(g.startTime))
    .reduce<number>((min, g) => {
      const ms = new Date(g.startTime!).getTime() - now.getTime();
      return ms > 0 ? Math.min(min, ms) : min;
    }, Infinity);
  // Math.max(1, ...) prevents "0 minutes" text if now races past a threshold boundary between ticks.
  const minutesUntilLock = isFinite(earliestUnlockedMs) && earliestUnlockedMs > 0
    ? Math.max(1, Math.ceil(earliestUnlockedMs / 60000))
    : 1;

  const handleWarningSubmit = async () => {
    setWarningOpen(false);
    setWarningDismissed(true);
    await handleSubmit();
  };

  const handleWarningDismiss = () => {
    setWarningOpen(false);
    setWarningDismissed(true);
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
        availableYears={availableYears}
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
        <WeekResultsView resultRows={resultRows} />
      )}

      {!loading && !error && games.length > 0 && !resultsMode && (
        <UserPicksGamesList
          games={games}
          picks={userPicks}
          savedPicks={savedPickIds}
          now={now}
          onPickChange={handlePickChange}
          onSubmit={handleSubmit}
          loading={submitting}
        />
      )}

      <LockWarningDialog
        open={warningOpen}
        unsavedCount={unsavedCount}
        minutesUntilLock={minutesUntilLock}
        onSubmit={handleWarningSubmit}
        onDismiss={handleWarningDismiss}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
