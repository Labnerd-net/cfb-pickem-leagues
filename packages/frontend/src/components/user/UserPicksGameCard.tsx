import { Paper, RadioGroup, FormControlLabel, Radio, Box, Typography, Chip } from '@mui/material';
import type { AdminDbGameData } from '@shared/types/cfb-pickem-api';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';

interface UserPicksGameCardProps {
  game: AdminDbGameData;
  selectedTeam?: 'home_team' | 'away_team';
  onPickChange: (gameId: number, pick: 'home_team' | 'away_team') => void;
  hasSavedPick?: boolean;
}

export default function UserPicksGameCard({
  game,
  selectedTeam,
  onPickChange,
  hasSavedPick,
}: UserPicksGameCardProps) {
  const ignoreDeadline = import.meta.env.VITE_IGNORE_PICK_DEADLINE === 'true';
  const isLocked =
    !ignoreDeadline && game.startTime !== null && new Date() >= new Date(game.startTime);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) return;
    const pick = event.target.value as 'home_team' | 'away_team';
    onPickChange(game.gameId, pick);
  };

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        border: 2,
        borderColor: isLocked ? 'grey.400' : selectedTeam ? 'primary.main' : 'transparent',
        transition: 'all 0.2s',
        position: 'relative',
        opacity: isLocked ? 0.7 : 1,
        backgroundColor: hasSavedPick ? 'action.hover' : 'background.paper',
        '&:hover': {
          borderColor: isLocked ? 'grey.400' : selectedTeam ? 'primary.main' : 'grey.300',
        },
      }}
    >
      {isLocked ? (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
          }}
        >
          <Chip
            icon={<LockIcon fontSize="small" />}
            label="LOCKED"
            size="small"
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              fontWeight: 600,
              fontSize: '0.7rem',
              backgroundColor: 'grey.300',
              color: 'text.secondary',
            }}
          />
        </Box>
      ) : hasSavedPick ? (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'success.main',
          }}
        >
          <CheckCircleIcon fontSize="small" />
          <Typography
            variant="caption"
            sx={{ fontFamily: '"Work Sans", sans-serif', fontWeight: 600 }}
          >
            SAVED
          </Typography>
        </Box>
      ) : null}

      <Box sx={{ mb: 2 }}>
        <Typography
          variant="h6"
          sx={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '1.25rem',
            letterSpacing: '0.5px',
            mb: 0.5,
          }}
        >
          {game.awayTeam} @ {game.homeTeam}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontFamily: '"Work Sans", sans-serif',
            color: 'text.secondary',
            fontSize: '0.875rem',
          }}
        >
          Week {game.weekNumber} • {game.seasonType}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontFamily: '"Work Sans", sans-serif',
            color: 'text.secondary',
            fontSize: '0.8rem',
            mt: 0.25,
          }}
        >
          {game.startTime ? new Date(game.startTime).toLocaleString() : 'Start time TBD'}
        </Typography>
        {game.completed && game.awayPoints !== null && game.homePoints !== null && (
          <Typography
            variant="body2"
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              color: 'primary.main',
              fontWeight: 600,
              mt: 0.5,
            }}
          >
            Final: {game.awayTeam} {game.awayPoints} - {game.homePoints} {game.homeTeam}
          </Typography>
        )}
      </Box>

      <RadioGroup value={selectedTeam || ''} onChange={handleChange} sx={{ gap: 1 }}>
        <FormControlLabel
          value="away_team"
          disabled={isLocked}
          control={<Radio />}
          label={
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                fontWeight: selectedTeam === 'away_team' ? 600 : 400,
              }}
            >
              {game.awayTeam}
            </Typography>
          }
        />
        <FormControlLabel
          value="home_team"
          disabled={isLocked}
          control={<Radio />}
          label={
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                fontWeight: selectedTeam === 'home_team' ? 600 : 400,
              }}
            >
              {game.homeTeam}
            </Typography>
          }
        />
      </RadioGroup>
    </Paper>
  );
}
