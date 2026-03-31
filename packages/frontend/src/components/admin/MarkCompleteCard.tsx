import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Snackbar,
  TextField,
  Chip,
  CircularProgress,
  Paper,
} from '@mui/material';
import SportsScoreIcon from '@mui/icons-material/SportsScore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DashboardCard from '../dashboard/DashboardCard';
import WeekSelector from './WeekSelector';
import { getWeeksForYear, getGamesForWeek, markGameComplete } from '../../apis/adminRequests';
import { getCurrentSeason } from '../../utils/weekCalculation';
import type { AdminDbWeekDataWire, AdminDbGameDataWire } from '../../apis/adminRequests';

interface GameRowProps {
  game: AdminDbGameDataWire;
  homeScore: string;
  awayScore: string;
  onHomeChange: (v: string) => void;
  onAwayChange: (v: string) => void;
  onComplete: () => void;
  completing: boolean;
}

function GameRow({ game, homeScore, awayScore, onHomeChange, onAwayChange, onComplete, completing }: GameRowProps) {
  const done = game.completed;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
        opacity: done ? 0.75 : 1,
      }}
    >
      <Box sx={{ flex: '1 1 160px', minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '1rem',
            letterSpacing: '0.5px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {game.awayTeam} @ {game.homeTeam}
        </Typography>
        {done && (
          <Chip
            icon={<CheckCircleIcon fontSize="small" />}
            label={`${game.awayPoints}–${game.homePoints} (${game.winningTeam === 'home_team' ? game.homeTeam : game.winningTeam === 'away_team' ? game.awayTeam : 'Tie'})`}
            size="small"
            color="success"
            variant="outlined"
            sx={{ mt: 0.5, fontFamily: '"Work Sans", sans-serif', fontSize: '0.7rem' }}
          />
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
        <TextField
          label={game.awayTeam.split(' ').pop()}
          value={awayScore}
          onChange={e => onAwayChange(e.target.value)}
          type="number"
          size="small"
          disabled={done || completing}
          inputProps={{ min: 0, style: { width: 56 } }}
          sx={{ '& input': { fontFamily: '"Work Sans", sans-serif' } }}
        />
        <Typography sx={{ fontFamily: '"Work Sans", sans-serif', color: 'text.secondary' }}>–</Typography>
        <TextField
          label={game.homeTeam.split(' ').pop()}
          value={homeScore}
          onChange={e => onHomeChange(e.target.value)}
          type="number"
          size="small"
          disabled={done || completing}
          inputProps={{ min: 0, style: { width: 56 } }}
          sx={{ '& input': { fontFamily: '"Work Sans", sans-serif' } }}
        />
      </Box>

      <Button
        variant={done ? 'outlined' : 'contained'}
        color={done ? 'success' : 'primary'}
        size="small"
        disabled={done || completing}
        onClick={onComplete}
        startIcon={completing ? <CircularProgress size={14} /> : done ? <CheckCircleIcon /> : undefined}
        sx={{ flexShrink: 0, fontFamily: '"Work Sans", sans-serif' }}
      >
        {done ? 'Done' : completing ? 'Saving…' : 'Mark Complete'}
      </Button>
    </Paper>
  );
}

export default function MarkCompleteCard() {
  const [selectedYear, setSelectedYear] = useState(() => getCurrentSeason());
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [weeks, setWeeks] = useState<AdminDbWeekDataWire[]>([]);
  const [games, setGames] = useState<AdminDbGameDataWire[]>([]);
  const [scores, setScores] = useState<Record<number, { home: string; away: string }>>({});
  const [completing, setCompleting] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ severity: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getWeeksForYear(selectedYear);
      if (result.success && result.data && result.data.length > 0) {
        const sorted = [...result.data].sort((a, b) => a.weekNumber - b.weekNumber);
        setWeeks(sorted);
        setSelectedWeek(sorted[0].weekNumber);
      } else {
        setWeeks([]);
      }
      setLoading(false);
    };
    load();
  }, [selectedYear]);

  useEffect(() => {
    if (weeks.length === 0) return;
    const load = async () => {
      setLoading(true);
      setGames([]);
      setScores({});
      const result = await getGamesForWeek({ year: selectedYear, week: selectedWeek });
      if (result.success && result.data) {
        const picked = result.data.filter(g => g.picked);
        setGames(picked);
        const init: Record<number, { home: string; away: string }> = {};
        for (const g of picked) {
          init[g.gameId] = {
            home: g.homePoints !== null ? String(g.homePoints) : '',
            away: g.awayPoints !== null ? String(g.awayPoints) : '',
          };
        }
        setScores(init);
      }
      setLoading(false);
    };
    load();
  }, [selectedYear, selectedWeek, weeks]);

  const handleScoreChange = (gameId: number, side: 'home' | 'away', value: string) => {
    setScores(prev => ({ ...prev, [gameId]: { ...prev[gameId], [side]: value } }));
  };

  const handleMarkComplete = async (game: AdminDbGameDataWire) => {
    const score = scores[game.gameId] ?? { home: '', away: '' };
    const homePoints = parseInt(score.home);
    const awayPoints = parseInt(score.away);
    if (isNaN(homePoints) || isNaN(awayPoints)) {
      setFeedback({ severity: 'error', message: 'Enter scores for both teams before marking complete.' });
      return;
    }
    setCompleting(game.gameId);
    setFeedback(null);
    const result = await markGameComplete({ gameId: game.gameId, homePoints, awayPoints });
    if (result.success && result.data) {
      setGames(prev => prev.map(g => (g.gameId === game.gameId ? result.data! : g)));
      setFeedback({
        severity: 'success',
        message: `${game.awayTeam} @ ${game.homeTeam} marked complete.`,
      });
    } else {
      setFeedback({ severity: 'error', message: result.error || 'Failed to mark complete.' });
    }
    setCompleting(null);
  };

  return (
    <DashboardCard
      icon={<SportsScoreIcon sx={{ fontSize: 32, color: 'secondary.main', mr: 2 }} />}
      title="Mark Games Complete"
      accentColor="secondary"
    >
      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <WeekSelector
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          weeks={weeks}
          selectedWeek={selectedWeek}
          onWeekChange={setSelectedWeek}
          loading={loading}
        />

        {!loading && weeks.length === 0 && (
          <Typography
            sx={{ fontFamily: '"Work Sans", sans-serif', color: 'text.secondary', fontStyle: 'italic' }}
          >
            No weeks loaded for {selectedYear}.
          </Typography>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {!loading && weeks.length > 0 && games.length === 0 && (
          <Typography
            sx={{ fontFamily: '"Work Sans", sans-serif', color: 'text.secondary', fontStyle: 'italic' }}
          >
            No picked games for week {selectedWeek}.
          </Typography>
        )}

        {games.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {games.map(game => (
              <GameRow
                key={game.gameId}
                game={game}
                homeScore={scores[game.gameId]?.home ?? ''}
                awayScore={scores[game.gameId]?.away ?? ''}
                onHomeChange={v => handleScoreChange(game.gameId, 'home', v)}
                onAwayChange={v => handleScoreChange(game.gameId, 'away', v)}
                onComplete={() => handleMarkComplete(game)}
                completing={completing === game.gameId}
              />
            ))}
          </Box>
        )}
      </Box>

      <Snackbar
        open={!!feedback}
        autoHideDuration={5000}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setFeedback(null)} severity={feedback?.severity} sx={{ width: '100%' }}>
          {feedback?.message}
        </Alert>
      </Snackbar>
    </DashboardCard>
  );
}
