import {
  Box,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import type { AdminDbWeekData } from '@shared/types/cfb-pickem-api';

interface WeekSelectorProps {
  selectedYear: number;
  selectedWeek: number;
  weeks: AdminDbWeekData[];
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
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear];

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
          <InputLabel>Year</InputLabel>
          <Select value={selectedYear} label="Year" onChange={(e) => onYearChange(Number(e.target.value))}>
            {yearOptions.sort((a, b) => b - a).map(year => (
              <MenuItem key={year} value={year}>{year}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth disabled={loading}>
          <InputLabel>Week</InputLabel>
          <Select value={selectedWeek} label="Week" onChange={(e) => onWeekChange(Number(e.target.value))}>
            {[...weeks].sort((a, b) => a.weekNumber - b.weekNumber).map(week => (
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
