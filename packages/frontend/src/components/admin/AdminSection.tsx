import { useState } from 'react';
import { Box, Alert, Snackbar } from '@mui/material';
import type { AdminDbGameData, SeasonType, WeekQuery } from '@shared/types/cfb-pickem-api';
import DashboardCard from '../dashboard/DashboardCard';
import WeekSelector from './WeekSelector';
import GamesList from './GamesList';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import {
  addWeekstoYear,
  addGamesToWeek,
  getGamesForWeek,
  setPickedGames,
} from '../../apis/adminRequests';

export default function AdminSection() {
  const currentYear = new Date().getFullYear();

  // State
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedSeasonType, setSelectedSeasonType] = useState<SeasonType>('regular');
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [games, setGames] = useState<AdminDbGameData[]>([]);
  const [selectedGameIds, setSelectedGameIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Helper to create WeekQuery
  const getWeekData = (): WeekQuery => ({
    year: selectedYear,
    week: selectedWeek,
    seasonType: selectedSeasonType,
  });

  // API Handlers
  const handlePopulateYear = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await addWeekstoYear(selectedYear);
      if (result.success) {
        setSuccessMessage(`All weeks populated for ${selectedYear}`);
      } else {
        setErrorMessage(result.error || 'Failed to populate year');
      }
    } catch {
      setErrorMessage('An unexpected error occurred while populating year');
    } finally {
      setLoading(false);
    }
  };

  const handlePopulateWeek = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const weekData = getWeekData();
      const result = await addGamesToWeek(weekData);
      if (result.success) {
        setSuccessMessage(
          `Games populated for ${selectedSeasonType} Week ${selectedWeek}, ${selectedYear}`
        );
      } else {
        setErrorMessage(result.error || 'Failed to populate week');
      }
    } catch {
      setErrorMessage('An unexpected error occurred while populating week');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadGames = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setGames([]);
    setSelectedGameIds([]);

    try {
      const weekData = getWeekData();
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
        ...getWeekData(),
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
            selectedSeasonType={selectedSeasonType}
            onSeasonTypeChange={setSelectedSeasonType}
            selectedWeek={selectedWeek}
            onWeekChange={setSelectedWeek}
            onPopulateYear={handlePopulateYear}
            onPopulateWeek={handlePopulateWeek}
            onLoadGames={handleLoadGames}
            loading={loading}
          />

          {games.length > 0 && (
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
