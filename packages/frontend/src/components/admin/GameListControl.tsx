import { Button, Typography, Stack, CircularProgress, ToggleButton } from '@mui/material';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import SaveIcon from '@mui/icons-material/Save';
import FilterListIcon from '@mui/icons-material/FilterList';

interface GamesListControlProps {
  numOfGames: number;
  selectedGameIds: number[];
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSaveSelection: () => void;
  pickedFirst: boolean;
  onTogglePickedFirst: () => void;
  loading?: boolean;
}

export default function GameListControl({
  numOfGames,
  selectedGameIds,
  onSelectAll,
  onDeselectAll,
  onSaveSelection,
  pickedFirst,
  onTogglePickedFirst,
  loading = false,
}: GamesListControlProps) {
  return (
    <Stack
      sx={{
        mb: 3,
        pb: 2,
        borderBottom: 1,
        borderColor: 'divider',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        alignItems: 'center',
        gap: 2,
      }}
    >
      {/* Left: Selection Controls */}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-start' }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<CheckBoxIcon />}
          onClick={onSelectAll}
          disabled={loading}
        >
          Select All
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<CheckBoxOutlineBlankIcon />}
          onClick={onDeselectAll}
          disabled={loading}
        >
          Deselect All
        </Button>
        <ToggleButton
          value="pickedFirst"
          selected={pickedFirst}
          onChange={onTogglePickedFirst}
          size="small"
          disabled={loading}
        >
          <FilterListIcon fontSize="small" sx={{ mr: 0.5 }} />
          Picked First
        </ToggleButton>
      </Stack>

      {/* Center: Save Button */}
      <Stack sx={{ justifyContent: 'center', alignItems: 'center' }}>
        <Button
          variant="contained"
          size="large"
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={onSaveSelection}
          disabled={loading || selectedGameIds.length === 0}
          sx={{
            px: 4,
            py: 1.5,
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '1.25rem',
            letterSpacing: '1px',
          }}
        >
          {loading ? 'Saving...' : 'Save Picked Games'}
        </Button>
      </Stack>

      {/* Right: Count Typography */}
      <Stack sx={{ justifyContent: 'flex-end', alignItems: 'flex-end' }}>
        <Typography
          variant="body2"
          sx={{
            fontFamily: '"Work Sans", sans-serif',
            fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          {selectedGameIds.length} of {numOfGames} games selected
        </Typography>
      </Stack>
    </Stack>
  );
}
