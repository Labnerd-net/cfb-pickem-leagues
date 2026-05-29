import { useEffect, useState } from 'react';
import {
  Box,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Tabs,
  Tab,
  Typography,
} from '@mui/material';
import type { LeaderboardEntry, WeekScoresEntry, AdminWeekData } from '@shared/types/cfb-pickem-api.js';
import { useAuth } from '../../contexts/auth/AuthContext';
import { useLeague } from '../../contexts/LeagueContext';
import { getLeaderboard, getWeekScores } from '../../apis/leaderboardRequests';
import { getWeeksForYear } from '../../apis/userRequests';
import { getCurrentSeason } from '../../utils/weekCalculation';

export default function LeaderboardSection() {
  const { user } = useAuth();
  const { activeLeague } = useLeague();
  const leagueId = activeLeague?.leagueId ?? 1;
  const currentSeason = getCurrentSeason();
  const yearOptions = [currentSeason, currentSeason - 1, currentSeason - 2];

  // Season view state
  const [view, setView] = useState<'season' | 'week'>('season');
  const [year, setYear] = useState(() => getCurrentSeason());
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Week view state
  const [weekYear, setWeekYear] = useState(() => getCurrentSeason());
  const [weeks, setWeeks] = useState<AdminWeekData[]>([]);
  const [weekNumber, setWeekNumber] = useState<number | null>(null);
  const [weekEntries, setWeekEntries] = useState<WeekScoresEntry[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);
  const [weekError, setWeekError] = useState<string | null>(null);

  // Season effect
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await getLeaderboard(year, leagueId);
      if (result.success && result.data) {
        setEntries(result.data);
      } else {
        setError(result.error ?? 'Failed to load leaderboard');
      }
      setLoading(false);
    };
    load();
  }, [year, leagueId]);

  // Week view — load weeks when weekYear or view changes
  useEffect(() => {
    if (view !== 'week') return;

    let cancelled = false;

    const loadWeeks = async () => {
      setWeekLoading(true);
      setWeekError(null);
      setWeeks([]);
      setWeekNumber(null);
      setWeekEntries([]);

      const result = await getWeeksForYear(weekYear);
      if (cancelled) return;

      if (result.success && result.data) {
        const weeksData = result.data.weeks;
        setWeeks(weeksData);
        if (weeksData.length > 0) {
          const latest = [...weeksData].sort((a, b) => b.weekNumber - a.weekNumber)[0];
          setWeekNumber(latest.weekNumber);
        } else {
          setWeekLoading(false);
        }
      } else {
        setWeekError(result.error ?? 'Failed to load weeks');
        setWeekLoading(false);
      }
    };

    loadWeeks();
    return () => { cancelled = true; };
  }, [view, weekYear]);

  // Week view — load scores when weekNumber changes
  useEffect(() => {
    if (view !== 'week' || weekNumber === null) return;

    let cancelled = false;

    const loadScores = async () => {
      setWeekLoading(true);
      setWeekError(null);

      const result = await getWeekScores(weekYear, weekNumber, leagueId);
      if (cancelled) return;

      if (result.success && result.data) {
        const sorted = [...result.data].sort((a, b) =>
          b.correct !== a.correct ? b.correct - a.correct : a.incorrect - b.incorrect
        );
        setWeekEntries(sorted);
      } else {
        setWeekError(result.error ?? 'Failed to load week scores');
      }
      setWeekLoading(false);
    };

    loadScores();
    return () => { cancelled = true; };
  }, [view, weekYear, weekNumber, leagueId]);

  return (
    <Box>
      <Tabs
        value={view}
        onChange={(_, v) => setView(v)}
        sx={{ mb: 2 }}
      >
        <Tab label="Season" value="season" />
        <Tab label="Week" value="week" />
      </Tabs>

      {view === 'season' && (
        <>
          <FormControl size="small" sx={{ mb: 2, minWidth: 140 }}>
            <InputLabel id="leaderboard-season-label">Season</InputLabel>
            <Select
              labelId="leaderboard-season-label"
              id="leaderboard-season-select"
              value={year}
              label="Season"
              onChange={e => setYear(Number(e.target.value))}
              disabled={loading}
            >
              {yearOptions.map(y => (
                <MenuItem key={y} value={y}>
                  {y} Season
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : error ? (
            <Typography sx={{ color: 'error.main' }}>{error}</Typography>
          ) : entries.length === 0 ? (
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                color: 'text.secondary',
                textAlign: 'center',
                py: 4,
                fontStyle: 'italic',
              }}
            >
              No standings yet for this season.
            </Typography>
          ) : (
            <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Correct</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entries.map((entry, index) => (
                    <TableRow
                      key={entry.userId}
                      sx={
                        entry.userId === user?.userId
                          ? { backgroundColor: 'action.selected' }
                          : undefined
                      }
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{entry.displayName}</TableCell>
                      <TableCell>{entry.correct}</TableCell>
                      <TableCell>{entry.total}</TableCell>
                      <TableCell>
                        {entry.percentage !== null ? Math.round(entry.percentage * 100) + '%' : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </>
      )}

      {view === 'week' && (
        <>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="leaderboard-week-year-label">Season</InputLabel>
              <Select
                labelId="leaderboard-week-year-label"
                id="leaderboard-week-year-select"
                value={weekYear}
                label="Season"
                onChange={e => setWeekYear(Number(e.target.value))}
                disabled={weekLoading}
              >
                {yearOptions.map(y => (
                  <MenuItem key={y} value={y}>
                    {y} Season
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="leaderboard-week-label">Week</InputLabel>
              <Select
                labelId="leaderboard-week-label"
                id="leaderboard-week-select"
                value={weekNumber ?? ''}
                label="Week"
                onChange={e => setWeekNumber(Number(e.target.value))}
                disabled={weekLoading || weeks.length === 0}
              >
                {weeks.map(w => (
                  <MenuItem key={w.weekNumber} value={w.weekNumber}>
                    Week {w.weekNumber}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {weekLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : weekError ? (
            <Typography sx={{ color: 'error.main' }}>{weekError}</Typography>
          ) : weekEntries.length === 0 ? (
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                color: 'text.secondary',
                textAlign: 'center',
                py: 4,
                fontStyle: 'italic',
              }}
            >
              No results for this week yet.
            </Typography>
          ) : (
            <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Correct</TableCell>
                    <TableCell>Incorrect</TableCell>
                    <TableCell>Pending</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>%</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {weekEntries.map((entry, index) => (
                    <TableRow
                      key={entry.userId}
                      sx={
                        entry.userId === user?.userId
                          ? { backgroundColor: 'action.selected' }
                          : undefined
                      }
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{entry.displayName}</TableCell>
                      <TableCell>{entry.correct}</TableCell>
                      <TableCell>{entry.incorrect}</TableCell>
                      <TableCell>{entry.pending}</TableCell>
                      <TableCell>{entry.total}</TableCell>
                      <TableCell>
                        {entry.total > 0 ? Math.round((entry.correct / entry.total) * 100) + '%' : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
