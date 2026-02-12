import {
  Box,
  Stack,
  TextField,
  Select,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  CircularProgress,
} from '@mui/material';
import type { SeasonType } from '@shared/types/cfb-pickem-api';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';

interface WeekSelectorProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
  selectedSeasonType: SeasonType;
  onSeasonTypeChange: (seasonType: SeasonType) => void;
  selectedWeek: number;
  onWeekChange: (week: number) => void;
  onPopulateYear: () => void;
  onPopulateWeek: () => void;
  onLoadGames: () => void;
  loading?: boolean;
}

export default function WeekSelector({
  selectedYear,
  onYearChange,
  selectedSeasonType,
  onSeasonTypeChange,
  selectedWeek,
  onWeekChange,
  onPopulateYear,
  onPopulateWeek,
  onLoadGames,
  loading = false,
}: WeekSelectorProps) {
  const maxWeek = selectedSeasonType === 'postseason' ? 5 : 15;
  const weeks = Array.from({ length: maxWeek }, (_, i) => i + 1);

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
          slotProps={{ htmlInput: { min: 2020, max: 2030 } }}
        />
        <Button
          fullWidth
          variant="contained"
          color="primary"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
          onClick={onPopulateYear}
          disabled={loading}
          sx={{
            height: 56,
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '1.1rem',
            letterSpacing: '0.5px',
          }}
        >
          Populate Year
        </Button>
      </Box>

      {/* Week Controls */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2,
          alignItems: 'center',
        }}
      >
        <FormControl fullWidth disabled={loading}>
          <InputLabel>Season Type</InputLabel>
          <Select
            value={selectedSeasonType}
            label="Season Type"
            onChange={(e) => onSeasonTypeChange(e.target.value as SeasonType)}
          >
            <MenuItem value="regular">Regular Season</MenuItem>
            <MenuItem value="postseason">Postseason</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth disabled={loading}>
          <InputLabel>Week</InputLabel>
          <Select value={selectedWeek} label="Week" onChange={(e) => onWeekChange(Number(e.target.value))}>
            {weeks.map((week) => (
              <MenuItem key={week} value={week}>
                Week {week}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          fullWidth
          variant="contained"
          color="secondary"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={onPopulateWeek}
          disabled={loading}
          sx={{
            height: 56,
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '1.1rem',
            letterSpacing: '0.5px',
          }}
        >
          Populate Week
        </Button>
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <VisibilityIcon />}
          onClick={onLoadGames}
          disabled={loading}
          sx={{
            height: 56,
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '1.1rem',
            letterSpacing: '0.5px',
          }}
        >
          Load Games
        </Button>
      </Box>
    </Stack>
  );
}
