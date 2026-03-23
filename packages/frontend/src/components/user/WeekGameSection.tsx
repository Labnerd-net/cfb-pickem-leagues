import { Box, Typography, CircularProgress, Snackbar, Alert } from '@mui/material';
import UserWeekSelector from './UserWeekSelector';
import WeekPicksView from './WeekPicksView';
import WeekResultsView from './WeekResultsView';
import { useWeekGames } from './useWeekGames';

export default function WeekGameSection() {
  const {
    selectedYear,
    setSelectedYear,
    selectedWeek,
    setSelectedWeek,
    availableYears,
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
  } = useWeekGames();

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
        <WeekPicksView
          games={games}
          picks={userPicks}
          savedPicks={savedPickIds}
          onPickChange={handlePickChange}
          onSubmit={handleSubmit}
          loading={submitting}
        />
      )}

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
