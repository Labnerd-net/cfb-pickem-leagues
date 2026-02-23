import { useEffect, useState } from 'react';
import { Box, Alert, Snackbar, Typography, Button, CircularProgress } from '@mui/material';
import type {
  AdminDbWeekData,
  AdminDbGameData,
  WeekIdentifier,
} from '@shared/types/cfb-pickem-api';
import DashboardCard from '../dashboard/DashboardCard';
import GamesList from './GamesList';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import {
  getGamesForWeek,
  getWeeksForYear,
  setPickedGames,
  addWeeksToYear,
  addGamesToWeek,
} from '../../apis/adminRequests';
import WeekSelector from './WeekSelector';
import { getCurrentSeason } from '../../utils/weekCalculation';

export default function AdminSection() {
  // State
  const [selectedYear, setSelectedYear] = useState(() => getCurrentSeason());
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [weeks, setWeeks] = useState<AdminDbWeekData[]>([]);
  const [games, setGames] = useState<AdminDbGameData[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [weeksChecked, setWeeksChecked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importFeedback, setImportFeedback] = useState<{
    severity: 'success' | 'error';
    message: string;
  } | null>(null);

  // API Handlers
  const handleLoadGames = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setGames([]);
    setSelectedGameIds([]);

    try {
      const weekData: WeekIdentifier = {
        year: selectedYear,
        week: selectedWeek,
      };
      const result = await getGamesForWeek(weekData);
      if (result.success && result.data) {
        setGames(result.data);
        // Pre-select games that are already marked as picked
        const pickedGameIds = result.data.filter(game => game.picked).map(game => game.gameId);
        setSelectedGameIds(pickedGameIds);
        setSuccessMessage(`Loaded ${result.data.length} games`);
      } else {
        setErrorMessage(result.error || 'Failed to load games');
      }
    } catch {
      setErrorMessage('An unexpected error occurred while loading games');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePickedGames = async () => {
    if (selectedGameIds.length === 0) {
      setErrorMessage('Please select at least one game');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const pickedData = {
        year: selectedYear,
        week: selectedWeek,
        games: selectedGameIds,
      };
      const result = await setPickedGames(pickedData);
      if (result.success) {
        setSuccessMessage(`${selectedGameIds.length} games marked as available for picks`);
        // Reload games to reflect updated picked status
        await handleLoadGames();
      } else {
        setErrorMessage(result.error || 'Failed to save picked games');
      }
    } catch {
      setErrorMessage('An unexpected error occurred while saving picked games');
    } finally {
      setLoading(false);
    }
  };

  const handleImportWeeks = async () => {
    setImporting(true);
    setImportFeedback(null);
    try {
      const result = await addWeeksToYear(selectedYear);
      if (result.success) {
        const weeksResult = await getWeeksForYear(selectedYear);
        if (weeksResult.success && weeksResult.data) {
          setWeeks(weeksResult.data);
          if (weeksResult.data.length > 0) setSelectedWeek(weeksResult.data[0].weekNumber);
        }
        setImportFeedback({ severity: 'success', message: `Weeks loaded for ${selectedYear}` });
      } else {
        setImportFeedback({ severity: 'error', message: result.error || 'Failed to load weeks' });
      }
    } catch {
      setImportFeedback({ severity: 'error', message: 'An unexpected error occurred' });
    } finally {
      setImporting(false);
    }
  };

  const handleImportGames = async () => {
    setImporting(true);
    setImportFeedback(null);
    try {
      const result = await addGamesToWeek({ year: selectedYear, week: selectedWeek });
      if (result.success) {
        const gamesResult = await getGamesForWeek({ year: selectedYear, week: selectedWeek });
        if (gamesResult.success && gamesResult.data) {
          setGames(gamesResult.data);
          const pickedIds = gamesResult.data.filter(g => g.picked).map(g => g.gameId);
          setSelectedGameIds(pickedIds);
        }
        setImportFeedback({
          severity: 'success',
          message: result.data?.status || 'Games imported',
        });
      } else {
        setImportFeedback({ severity: 'error', message: result.error || 'Failed to import games' });
      }
    } catch {
      setImportFeedback({ severity: 'error', message: 'An unexpected error occurred' });
    } finally {
      setImporting(false);
    }
  };

  const handleGameSelection = (gameId: number, selected: boolean) => {
    setSelectedGameIds(prev => (selected ? [...prev, gameId] : prev.filter(id => id !== gameId)));
  };

  const handleSelectAll = () => {
    setSelectedGameIds(games.map(game => game.gameId));
  };

  const handleDeselectAll = () => {
    setSelectedGameIds([]);
  };

  const handleCloseSnackbar = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  // Load weeks when year changes
  useEffect(() => {
    const loadWeeks = async () => {
      setLoading(true);
      setWeeksChecked(false);
      setErrorMessage(null);
      setSuccessMessage(null);
      setWeeks([]);
      setImportFeedback(null);

      try {
        const result = await getWeeksForYear(selectedYear);
        if (result.success && result.data) {
          setWeeks(result.data);
          // Reset to week 1 when year changes
          setSelectedWeek(1);
        } else {
          setErrorMessage(result.error || 'Failed to load weeks');
        }
      } catch {
        setErrorMessage('An unexpected error occurred while loading weeks');
      } finally {
        setWeeksChecked(true);
        setLoading(false);
      }
    };

    loadWeeks();
  }, [selectedYear]);

  // Load games when year or week changes
  useEffect(() => {
    const loadGames = async () => {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setGames([]);
      setSelectedGameIds([]);
      setImportFeedback(null);

      try {
        const weekData: WeekIdentifier = {
          year: selectedYear,
          week: selectedWeek,
        };
        const result = await getGamesForWeek(weekData);
        if (result.success && result.data) {
          setGames(result.data);
          // Pre-select games that are already marked as picked
          const pickedGameIds = result.data.filter(game => game.picked).map(game => game.gameId);
          setSelectedGameIds(pickedGameIds);
        } else {
          setErrorMessage(result.error || 'Failed to load games');
        }
      } catch {
        setErrorMessage('An unexpected error occurred while loading games');
      } finally {
        setLoading(false);
      }
    };

    loadGames();
  }, [selectedYear, selectedWeek]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        gap: 3,
      }}
    >
      <DashboardCard
        icon={<AdminPanelSettingsIcon sx={{ fontSize: 32, color: 'secondary.main', mr: 2 }} />}
        title="Admin Controls"
        accentColor="secondary"
        gridColumn={{ xs: '1', md: 'span 2' }}
      >
        <Box sx={{ mt: 2 }}>
          <WeekSelector
            selectedYear={selectedYear}
            onYearChange={setSelectedYear}
            weeks={weeks}
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
            loading={loading || importing}
          />

          {/* Import feedback alert */}
          {importFeedback && (
            <Alert
              severity={importFeedback.severity}
              onClose={() => setImportFeedback(null)}
              sx={{ mt: 2 }}
            >
              {importFeedback.message}
            </Alert>
          )}

          {/* Empty weeks state */}
          {weeksChecked && !loading && weeks.length === 0 && (
            <Box
              sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
            >
              <Typography
                sx={{
                  fontFamily: '"Work Sans", sans-serif',
                  color: 'text.secondary',
                  fontStyle: 'italic',
                }}
              >
                No weeks loaded for {selectedYear} Season
              </Typography>
              <Button
                variant="contained"
                onClick={handleImportWeeks}
                disabled={importing}
                startIcon={importing ? <CircularProgress size={16} /> : undefined}
              >
                {importing ? 'Loading Weeks...' : 'Load Weeks'}
              </Button>
            </Box>
          )}

          {/* Games section — only render when weeks are loaded */}
          {weeks.length > 0 && (
            <Box sx={{ mt: 4, pt: 4, borderTop: 2, borderColor: 'divider' }}>
              {games.length > 0 ? (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleImportGames}
                      disabled={importing || loading}
                      startIcon={importing ? <CircularProgress size={16} /> : undefined}
                    >
                      {importing ? 'Re-importing...' : 'Re-import'}
                    </Button>
                  </Box>
                  <GamesList
                    games={games}
                    selectedGameIds={selectedGameIds}
                    onGameSelect={handleGameSelection}
                    onSelectAll={handleSelectAll}
                    onDeselectAll={handleDeselectAll}
                    onSaveSelection={handleSavePickedGames}
                    loading={loading}
                  />
                </>
              ) : (
                !loading && (
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                  >
                    <Typography
                      sx={{
                        fontFamily: '"Work Sans", sans-serif',
                        color: 'text.secondary',
                        textAlign: 'center',
                        fontStyle: 'italic',
                      }}
                    >
                      No games imported for week {selectedWeek}
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={handleImportGames}
                      disabled={importing}
                      startIcon={importing ? <CircularProgress size={16} /> : undefined}
                    >
                      {importing ? 'Importing...' : 'Import Games'}
                    </Button>
                  </Box>
                )
              )}
            </Box>
          )}
        </Box>
      </DashboardCard>

      {/* Success/Error Messages */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!errorMessage}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
          {errorMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}
