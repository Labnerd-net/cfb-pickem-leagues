import {
  Box,
  Stack,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import type { AdminDbWeekData } from '@shared/types/cfb-pickem-api';

interface WeekSelectorProps {
  currentYear: number;
  selectedYear: number;
  onYearChange: (year: number) => void;
  weeks: AdminDbWeekData[];
  selectedWeek: number;
  onWeekChange: (week: number) => void;
  loading?: boolean;
}

export default function WeekSelector({
  currentYear,
  selectedYear,
  onYearChange,
  weeks,
  selectedWeek,
  onWeekChange,
  loading = false,
}: WeekSelectorProps) {

  return (
    <Stack spacing={3}>
      {/* Year Controls */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
          gap: 2,
          alignItems: 'center',
        }}
      >
        <TextField
          fullWidth
          type="number"
          label="Year"
          value={selectedYear}
          onChange={(e) => onYearChange(parseInt(e.target.value))}
          disabled={loading}
          slotProps={{ htmlInput: { min: currentYear - 5, max: currentYear } }}
        />

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
