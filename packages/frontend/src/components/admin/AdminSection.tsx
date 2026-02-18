import { useEffect, useState } from 'react';
import { Box, Alert, Snackbar, Typography } from '@mui/material';
import type { AdminDbWeekData, AdminDbGameData, WeekIdentifier } from '@shared/types/cfb-pickem-api';
import DashboardCard from '../dashboard/DashboardCard';
import GamesList from './GamesList';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import {
  getGamesForWeek,
  getWeeksForYear,
  setPickedGames,
} from '../../apis/adminRequests';
import WeekSelector from './WeekSelector';

export default function AdminSection() {
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear();

  // State
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [weeks, setWeeks] = useState<AdminDbWeekData[]>([]);
  const [games, setGames] = useState<AdminDbGameData[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        const pickedGameIds = result.data.filter((game) => game.picked).map((game) => game.gameId);
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

  const handleGameSelection = (gameId: number, selected: boolean) => {
    setSelectedGameIds((prev) =>
      selected ? [...prev, gameId] : prev.filter((id) => id !== gameId)
    );
  };

  const handleSelectAll = () => {
    setSelectedGameIds(games.map((game) => game.gameId));
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
    const handleLoadWeeks = async () => {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);
      setWeeks([]);

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
        setLoading(false);
      }
    };

    handleLoadWeeks();
  }, [selectedYear]);

  // Load games when year or week changes
  useEffect(() => {
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
          const pickedGameIds = result.data.filter((game) => game.picked).map((game) => game.gameId);
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

    handleLoadGames();
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
            loading={loading}
          />          

          {games.length > 0 ? (
            <Box sx={{ mt: 4, pt: 4, borderTop: 2, borderColor: 'divider' }}>
              <GamesList
                games={games}
                selectedGameIds={selectedGameIds}
                onGameSelect={handleGameSelection}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
                onSaveSelection={handleSavePickedGames}
                loading={loading}
              />
            </Box>
          ) : (
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                color: 'text.secondary',
                textAlign: 'center',
                py: 4,
                fontStyle: 'italic',
              }}
            >
              No Games Loaded
            </Typography>
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
