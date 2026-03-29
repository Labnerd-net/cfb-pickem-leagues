import { Box, Stack, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import type { AdminDbWeekDataWire } from '../../apis/adminRequests';
import { getCurrentSeason } from '../../utils/weekCalculation';

interface WeekSelectorProps {
  selectedYear: number;
  selectedWeek: number;
  weeks: AdminDbWeekDataWire[];
  onYearChange: (year: number) => void;
  onWeekChange: (week: number) => void;
  loading?: boolean;
}

export default function WeekSelector({
  selectedYear,
  onYearChange,
  weeks,
  selectedWeek,
  onWeekChange,
  loading = false,
}: WeekSelectorProps) {
  const currentSeason = getCurrentSeason();
  const yearOptions = [currentSeason - 2, currentSeason - 1, currentSeason];

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
          alignItems: 'center',
        }}
      >
        <FormControl fullWidth disabled={loading}>
          <InputLabel>Season</InputLabel>
          <Select
            value={selectedYear}
            label="Season"
            onChange={e => onYearChange(Number(e.target.value))}
          >
            {yearOptions
              .sort((a, b) => b - a)
              .map(year => (
                <MenuItem key={year} value={year}>
                  {year} Season
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        <FormControl fullWidth disabled={loading}>
          <InputLabel>Week</InputLabel>
          <Select
            value={selectedWeek}
            label="Week"
            onChange={e => onWeekChange(Number(e.target.value))}
          >
            {[...weeks]
              .sort((a, b) => a.weekNumber - b.weekNumber)
              .map(week => (
                <MenuItem key={week.weekNumber} value={week.weekNumber}>
                  Week {week.weekNumber}
                </MenuItem>
              ))}
          </Select>
        </FormControl>
      </Box>
    </Stack>
  );
}
