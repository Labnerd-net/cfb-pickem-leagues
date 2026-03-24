import {
  Box,
  Alert,
  Snackbar,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { useState } from 'react';
import DashboardCard from '../dashboard/DashboardCard';
import GamesList from './GamesList';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import WeekSelector from './WeekSelector';
import { useWeekManagement } from './useWeekManagement';
import { useGameManagement } from './useGameManagement';

export default function AdminSection() {
  const weekHook = useWeekManagement();
  const gameHook = useGameManagement(weekHook.selectedYear, weekHook.selectedWeek);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const loading = weekHook.weekLoading || gameHook.gameLoading;
  const importing = gameHook.importing;

  const handleImportWeeks = () =>
    weekHook.importWeeks({
      setImporting: gameHook.setImporting,
      setImportFeedback: gameHook.setImportFeedback,
    });

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
            selectedYear={weekHook.selectedYear}
            onYearChange={weekHook.setSelectedYear}
            weeks={weekHook.weeks}
            selectedWeek={weekHook.selectedWeek}
            onWeekChange={weekHook.setSelectedWeek}
            loading={loading || importing}
          />

          {/* Import feedback alert */}
          {gameHook.importFeedback && (
            <Alert
              severity={gameHook.importFeedback.severity}
              onClose={() => gameHook.setImportFeedback(null)}
              sx={{ mt: 2 }}
            >
              {gameHook.importFeedback.message}
            </Alert>
          )}

          {/* Empty weeks state */}
          {weekHook.weeksChecked && !loading && weekHook.weeks.length === 0 && (
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
                No weeks loaded for {weekHook.selectedYear} Season
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
          {weekHook.weeks.length > 0 && (
            <Box sx={{ mt: 4, pt: 4, borderTop: 2, borderColor: 'divider' }}>
              {gameHook.games.length > 0 ? (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 2 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={gameHook.handleImportGames}
                      disabled={importing || loading}
                      startIcon={importing ? <CircularProgress size={16} /> : undefined}
                    >
                      {importing ? 'Re-importing...' : 'Re-import'}
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={() => setResetDialogOpen(true)}
                      disabled={importing || loading || resetting}
                    >
                      Reset Year
                    </Button>
                  </Box>
                  <GamesList
                    games={gameHook.games}
                    selectedGameIds={gameHook.selectedGameIds}
                    onGameSelect={gameHook.handleGameSelection}
                    onSelectAll={gameHook.handleSelectAll}
                    onDeselectAll={gameHook.handleDeselectAll}
                    onSaveSelection={gameHook.handleSavePickedGames}
                    onGameCorrected={gameHook.handleGameCorrected}
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
                      No games imported for week {weekHook.selectedWeek}
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={gameHook.handleImportGames}
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
        open={!!gameHook.successMessage}
        autoHideDuration={6000}
        onClose={gameHook.clearMessages}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={gameHook.clearMessages} severity="success" sx={{ width: '100%' }}>
          {gameHook.successMessage}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!gameHook.errorMessage}
        autoHideDuration={6000}
        onClose={gameHook.clearMessages}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={gameHook.clearMessages} severity="error" sx={{ width: '100%' }}>
          {gameHook.errorMessage}
        </Alert>
      </Snackbar>

      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
        <DialogTitle>Reset {weekHook.selectedYear} Season?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete all weeks and games for {weekHook.selectedYear}. This
            action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)} disabled={resetting}>
            Cancel
          </Button>
          <Button
            color="error"
            disabled={resetting}
            startIcon={resetting ? <CircularProgress size={16} /> : undefined}
            onClick={async () => {
              await weekHook.deleteYear({
                setImporting: setResetting,
                setImportFeedback: gameHook.setImportFeedback,
              });
              setResetDialogOpen(false);
            }}
          >
            {resetting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
