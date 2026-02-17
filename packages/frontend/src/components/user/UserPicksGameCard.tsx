import { Paper, RadioGroup, FormControlLabel, Radio, Box, Typography } from '@mui/material';
import type { AdminDbGameData } from '@shared/types/cfb-pickem-api';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

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
  hasSavedPick
}: UserPicksGameCardProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const pick = event.target.value as 'home_team' | 'away_team';
    onPickChange(game.gameId, pick);
  };

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        border: 2,
        borderColor: selectedTeam ? 'primary.main' : 'transparent',
        transition: 'all 0.2s',
        position: 'relative',
        backgroundColor: hasSavedPick ? 'action.hover' : 'background.paper',
        '&:hover': {
          borderColor: selectedTeam ? 'primary.main' : 'grey.300',
        },
      }}
    >
      {hasSavedPick && (
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
          <Typography variant="caption" sx={{ fontFamily: '"Work Sans", sans-serif', fontWeight: 600 }}>
            SAVED
          </Typography>
        </Box>
      )}

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
        {game.completed && (
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

      <RadioGroup
        value={selectedTeam || ''}
        onChange={handleChange}
        sx={{ gap: 1 }}
      >
        <FormControlLabel
          value="away_team"
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
