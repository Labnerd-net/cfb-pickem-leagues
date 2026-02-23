import { Box, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import type { AdminDbWeekData } from '@shared/types/cfb-pickem-api';
import { getCurrentSeason } from '../../utils/weekCalculation';

interface UserWeekSelectorProps {
  selectedYear: number;
  selectedWeek: number;
  weeks: AdminDbWeekData[];
  onYearChange: (year: number) => void;
  onWeekChange: (week: number) => void;
  loading: boolean;
}

export default function UserWeekSelector({
  selectedYear,
  selectedWeek,
  weeks,
  onYearChange,
  onWeekChange,
  loading,
}: UserWeekSelectorProps) {
  const currentSeason = getCurrentSeason();
  const yearOptions = [currentSeason - 2, currentSeason - 1, currentSeason, currentSeason + 1];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
        gap: 2,
        mb: 3,
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

      <FormControl fullWidth disabled={loading || weeks.length === 0}>
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
  );
}
