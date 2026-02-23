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
  Typography,
} from '@mui/material';
import type { LeaderboardEntry } from '@shared/types/cfb-pickem-api.js';
import { useAuth } from '../../contexts/auth/AuthContext';
import { getLeaderboard } from '../../apis/leaderboardRequests';
import { getCurrentSeason } from '../../utils/weekCalculation';

export default function LeaderboardSection() {
  const { user } = useAuth();
  const [year, setYear] = useState(() => getCurrentSeason());
  const currentSeason = getCurrentSeason();
  const yearOptions = [currentSeason, currentSeason - 1, currentSeason - 2];
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      const result = await getLeaderboard(year);
      if (result.success && result.data) {
        setEntries(result.data);
      } else {
        setError(result.error ?? 'Failed to load leaderboard');
      }
      setLoading(false);
    };
    load();
  }, [year]);

  return (
    <Box>
      <FormControl size="small" sx={{ mb: 2, minWidth: 140 }}>
        <InputLabel>Season</InputLabel>
        <Select
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
    </Box>
  );
}
