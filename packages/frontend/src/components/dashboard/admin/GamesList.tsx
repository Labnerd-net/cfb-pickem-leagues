import { Box, Button, Typography, Stack, CircularProgress } from '@mui/material';
import type { AdminDbGameData } from '@shared/types/cfb-pickem-api';
import GameCard from './GameCard';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import SaveIcon from '@mui/icons-material/Save';

interface GamesListProps {
  games: AdminDbGameData[];
  selectedGameIds: number[];
  onGameSelect: (gameId: number, selected: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSaveSelection: () => void;
  loading?: boolean;
}

export default function GamesList({
  games,
  selectedGameIds,
  onGameSelect,
  onSelectAll,
  onDeselectAll,
  onSaveSelection,
  loading = false,
}: GamesListProps) {
  if (games.length === 0) {
    return (
      <Typography
        sx={{
          fontFamily: '"Work Sans", sans-serif',
          color: 'text.secondary',
          textAlign: 'center',
          py: 4,
          fontStyle: 'italic',
        }}
      >
        No games loaded. Select a week and click "Load Games" to begin.
      </Typography>
    );
  }

  return (
    <Box>
      {/* Selection Controls */}
      <Stack
        direction="row"
        spacing={2}
        sx={{
          mb: 3,
          pb: 2,
          borderBottom: 1,
          borderColor: 'divider',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" spacing={1}>
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
        </Stack>

        <Typography
          variant="body2"
          sx={{
            fontFamily: '"Work Sans", sans-serif',
            fontWeight: 600,
            color: 'text.secondary',
          }}
        >
          {selectedGameIds.length} of {games.length} games selected
        </Typography>
      </Stack>

      {/* Games Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        {games.map((game) => (
          <GameCard
            key={game.gameId}
            game={game}
            selected={selectedGameIds.includes(game.gameId)}
            onSelect={(selected) => onGameSelect(game.gameId, selected)}
          />
        ))}
      </Box>

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2 }}>
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
      </Box>
    </Box>
  );
}
