import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Paper,
  Snackbar,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GroupsIcon from '@mui/icons-material/Groups';
import DashboardCard from '../dashboard/DashboardCard';
import WeekSelector from './WeekSelector';
import ScoreCorrectionDialog from './ScoreCorrectionDialog';
import { useWeekManagement } from './useWeekManagement';
import { useLeague } from '../../contexts/LeagueContext';
import {
  getLeagueGamesForWeek,
  addGameToLeague,
  removeGameFromLeague,
  markLeagueWeekComplete,
  correctLeagueGameScore,
  type LeagueGameWire,
} from '../../apis/adminRequests';
import { logger } from '../../utils/logger';

export default function LeagueAdminSection() {
  const { activeLeague } = useLeague();
  const leagueId = activeLeague?.leagueId ?? 0;
  const weekHook = useWeekManagement();

  const [games, setGames] = useState<LeagueGameWire[]>([]);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // Score correction dialog state
  const [correctionGame, setCorrectionGame] = useState<LeagueGameWire | null>(null);

  async function loadGames() {
    if (!leagueId || !weekHook.selectedYear || !weekHook.selectedWeek) return;
    setGamesLoading(true);
    setGamesError(null);
    const result = await getLeagueGamesForWeek(leagueId, weekHook.selectedYear, weekHook.selectedWeek);
    if (result.success && result.data) {
      setGames(result.data);
    } else {
      setGames([]);
      setGamesError(result.error ?? 'Failed to load games');
    }
    setGamesLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    if (!leagueId || !weekHook.selectedYear || !weekHook.selectedWeek) return;

    setGamesLoading(true);
    setGamesError(null);

    getLeagueGamesForWeek(leagueId, weekHook.selectedYear, weekHook.selectedWeek).then(result => {
      if (cancelled) return;
      if (result.success && result.data) {
        setGames(result.data);
      } else {
        setGames([]);
        setGamesError(result.error ?? 'Failed to load games');
      }
      setGamesLoading(false);
    }).catch(err => {
      if (cancelled) return;
      logger.error('Error loading league games:', err);
      setGamesError('Failed to load games');
      setGamesLoading(false);
    });

    return () => { cancelled = true; };
  }, [leagueId, weekHook.selectedYear, weekHook.selectedWeek]);

  async function handleToggleGame(game: LeagueGameWire, checked: boolean) {
    const prevGames = games;
    // Optimistic update
    setGames(prev => prev.map(g => g.gameId === game.gameId ? { ...g, inLeague: checked } : g));

    const result = checked
      ? await addGameToLeague(leagueId, game.gameId)
      : await removeGameFromLeague(leagueId, game.gameId);

    if (!result.success) {
      // Revert
      setGames(prevGames);
      const msg = result.status === 409
        ? 'Cannot remove game — it has existing picks'
        : (result.error ?? 'Failed to update game');
      setSnackbar({ open: true, message: msg, severity: 'error' });
    }
  }

  async function handleMarkComplete() {
    setCompleting(true);
    const result = await markLeagueWeekComplete(leagueId, weekHook.selectedYear, weekHook.selectedWeek);
    setCompleting(false);
    if (result.success) {
      setSnackbar({
        open: true,
        message: `Marked ${result.data?.completed ?? 0} game(s) complete`,
        severity: 'success',
      });
      await loadGames();
    } else {
      setSnackbar({ open: true, message: result.error ?? 'Failed to mark complete', severity: 'error' });
    }
  }

  const inLeagueGames = games.filter(g => g.inLeague);
  const loading = weekHook.weekLoading || gamesLoading;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
        gap: 3,
      }}
    >
      <DashboardCard
        icon={<GroupsIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />}
        title={`League Admin — ${activeLeague?.name ?? ''}`}
        accentColor="primary"
        gridColumn={{ xs: '1', md: 'span 2' }}
      >
        <Box sx={{ mt: 2 }}>
          <WeekSelector
            selectedYear={weekHook.selectedYear}
            onYearChange={weekHook.setSelectedYear}
            weeks={weekHook.weeks}
            selectedWeek={weekHook.selectedWeek}
            onWeekChange={weekHook.setSelectedWeek}
            loading={loading}
          />

          {weekHook.weekError && (
            <Alert severity="error" sx={{ mt: 2 }}>{weekHook.weekError}</Alert>
          )}

          {weekHook.weeksChecked && !weekHook.weekLoading && weekHook.weeks.length === 0 && (
            <Typography
              sx={{ mt: 3, fontFamily: '"Work Sans", sans-serif', color: 'text.secondary', fontStyle: 'italic' }}
            >
              No weeks loaded for {weekHook.selectedYear}. Ask a site admin to load weeks.
            </Typography>
          )}

          {weekHook.weeks.length > 0 && (
            <Box sx={{ mt: 4, pt: 4, borderTop: 2, borderColor: 'divider' }}>
              {/* Actions row */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={completing || loading || inLeagueGames.length === 0}
                  onClick={handleMarkComplete}
                  startIcon={completing ? <CircularProgress size={16} /> : undefined}
                >
                  {completing ? 'Marking...' : 'Mark Week Complete'}
                </Button>
              </Box>

              {gamesError && (
                <Alert severity="error" sx={{ mb: 2 }}>{gamesError}</Alert>
              )}

              {gamesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : games.length === 0 ? (
                <Typography
                  sx={{ fontFamily: '"Work Sans", sans-serif', color: 'text.secondary', fontStyle: 'italic', textAlign: 'center' }}
                >
                  No games in global cache for week {weekHook.selectedWeek}.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {games.map(game => (
                    <LeagueGameRow
                      key={game.gameId}
                      game={game}
                      onToggle={handleToggleGame}
                      onCorrect={() => setCorrectionGame(game)}
                    />
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      </DashboardCard>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {correctionGame && (
        <ScoreCorrectionDialog
          open={true}
          game={correctionGame}
          onClose={() => setCorrectionGame(null)}
          onSave={async (homePoints, awayPoints) => {
            const result = await correctLeagueGameScore(leagueId, correctionGame.gameId, weekHook.selectedYear!, weekHook.selectedWeek!, {
              homePoints,
              awayPoints,
            });
            if (result.success && result.data) {
              setGames(prev =>
                prev.map(g =>
                  g.gameId === correctionGame.gameId
                    ? { ...g, homePoints: result.data!.homePoints, awayPoints: result.data!.awayPoints, winningTeam: result.data!.winningTeam, completed: result.data!.completed }
                    : g
                )
              );
            }
            return result;
          }}
        />
      )}
    </Box>
  );
}

interface LeagueGameRowProps {
  game: LeagueGameWire;
  onToggle: (game: LeagueGameWire, checked: boolean) => void;
  onCorrect: () => void;
}

function LeagueGameRow({ game, onToggle, onCorrect }: LeagueGameRowProps) {
  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        border: 2,
        borderColor: game.inLeague ? 'success.main' : 'transparent',
        transition: 'border-color 0.2s',
        position: 'relative',
        '&:hover': { borderColor: game.inLeague ? 'success.main' : 'grey.300' },
      }}
    >
      {game.inLeague && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'success.main',
          }}
        >
          <CheckCircleIcon fontSize="small" />
          <Typography variant="caption" sx={{ fontFamily: '"Work Sans", sans-serif', fontWeight: 600 }}>
            IN LEAGUE
          </Typography>
          <IconButton
            size="small"
            onClick={e => { e.stopPropagation(); onCorrect(); }}
            sx={{ ml: 0.5, color: 'text.secondary' }}
            title="Correct score"
          >
            <EditIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      )}

      <FormControlLabel
        control={
          <Checkbox
            checked={game.inLeague ?? false}
            onChange={e => onToggle(game, e.target.checked)}
            sx={{ '& .MuiSvgIcon-root': { fontSize: 28 } }}
          />
        }
        label={
          <Box sx={{ ml: 1 }}>
            <Typography
              variant="h6"
              sx={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '1.25rem', letterSpacing: '0.5px', mb: 0.5 }}
            >
              {game.awayTeam} @ {game.homeTeam}
            </Typography>
            <Typography
              variant="body2"
              sx={{ fontFamily: '"Work Sans", sans-serif', color: 'text.secondary', fontSize: '0.875rem' }}
            >
              Week {game.weekNumber} • {game.seasonType}
            </Typography>
            {game.completed && game.awayPoints !== null && game.homePoints !== null && (
              <Typography
                variant="body2"
                sx={{ fontFamily: '"Work Sans", sans-serif', color: 'primary.main', fontWeight: 600, mt: 0.5 }}
              >
                Final: {game.awayTeam} {game.awayPoints} - {game.homePoints} {game.homeTeam}
              </Typography>
            )}
          </Box>
        }
        sx={{ m: 0, width: '100%', alignItems: 'flex-start' }}
      />
    </Paper>
  );
}
