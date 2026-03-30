import { Paper, RadioGroup, FormControlLabel, Radio, Box, Typography, Chip } from '@mui/material';
import type { AdminGameWire } from '../../apis/userRequests';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import { formatCountdown, isRedThreshold } from '../../utils/countdownFormat';

interface UserPicksGameCardProps {
  game: AdminGameWire;
  now: Date;
  selectedTeam?: 'home_team' | 'away_team';
  onPickChange: (gameId: number, pick: 'home_team' | 'away_team') => void;
  hasSavedPick?: boolean;
}

export default function UserPicksGameCard({
  game,
  now,
  selectedTeam,
  onPickChange,
  hasSavedPick,
}: UserPicksGameCardProps) {
  const ignoreDeadline = import.meta.env.VITE_IGNORE_PICK_DEADLINE === 'true';
  const isLocked =
    !ignoreDeadline && game.startTime !== null && now >= new Date(game.startTime);

  const msRemaining =
    !ignoreDeadline && !isLocked && game.startTime !== null
      ? new Date(game.startTime).getTime() - now.getTime()
      : 0;

  const countdownText = msRemaining > 0 ? formatCountdown(msRemaining) : null;
  const isRed = msRemaining > 0 && isRedThreshold(msRemaining);

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
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        border: 2,
        borderColor: isLocked
          ? 'grey.400'
          : isRed
            ? 'error.main'
            : selectedTeam
              ? 'primary.main'
              : 'transparent',
        transition: 'all 0.2s',
        opacity: isLocked ? 0.7 : 1,
        backgroundColor: hasSavedPick ? 'action.hover' : 'background.paper',
        '&:hover': {
          borderColor: isLocked
            ? 'grey.400'
            : isRed
              ? 'error.main'
              : selectedTeam
                ? 'primary.main'
                : 'grey.300',
        },
      }}
    >
      {/* Left: game info */}
      <Box sx={{ flex: 1 }}>
        <Typography
          variant="h6"
          sx={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '1.1rem',
            letterSpacing: '0.5px',
          }}
        >
          {game.awayTeam} @ {game.homeTeam}
        </Typography>
        <Typography
          variant="body2"
          sx={{ fontFamily: '"Work Sans", sans-serif', color: 'text.secondary', fontSize: '0.8rem' }}
        >
          {game.startTime ? new Date(game.startTime).toLocaleString() : 'Start time TBD'}
        </Typography>
        {countdownText !== null && (
          <Typography
            variant="caption"
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              color: isRed ? 'error.main' : 'text.secondary',
              fontWeight: isRed ? 600 : 400,
            }}
          >
            {countdownText}
          </Typography>
        )}
      </Box>

      {/* Right: pick controls + status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {isLocked ? (
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
        ) : hasSavedPick ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
            <CheckCircleIcon fontSize="small" />
            <Typography
              variant="caption"
              sx={{ fontFamily: '"Work Sans", sans-serif', fontWeight: 600 }}
            >
              SAVED
            </Typography>
          </Box>
        ) : null}

        <RadioGroup value={selectedTeam || ''} onChange={handleChange}>
          <FormControlLabel
            value="away_team"
            disabled={isLocked}
            control={<Radio size="small" />}
            label={
              <Typography
                sx={{
                  fontFamily: '"Work Sans", sans-serif',
                  fontSize: '0.875rem',
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
            control={<Radio size="small" />}
            label={
              <Typography
                sx={{
                  fontFamily: '"Work Sans", sans-serif',
                  fontSize: '0.875rem',
                  fontWeight: selectedTeam === 'home_team' ? 600 : 400,
                }}
              >
                {game.homeTeam}
              </Typography>
            }
          />
        </RadioGroup>
      </Box>
    </Paper>
  );
}
