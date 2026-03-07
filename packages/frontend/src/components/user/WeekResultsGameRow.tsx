import { Paper, Box, Typography, Chip } from '@mui/material';
import type { Team } from '@shared/types/cfb-pickem-api';

export interface WeekResultRow {
  gameId: number;
  homeTeam: string;
  awayTeam: string;
  homePoints: number | null;
  awayPoints: number | null;
  winningTeam: Team;
  completed: boolean;
  teamChosen: Team | null;
}

interface WeekResultsGameRowProps {
  row: WeekResultRow;
}

function ResultChip({ row }: { row: WeekResultRow }) {
  if (row.teamChosen === null) {
    return (
      <Chip
        label="No Pick"
        size="small"
        sx={{
          fontFamily: '"Work Sans", sans-serif',
          fontWeight: 600,
          fontSize: '0.7rem',
          backgroundColor: 'grey.600',
          color: '#fff',
        }}
      />
    );
  }
  if (row.winningTeam === 'pending') {
    return (
      <Chip
        label="Pending"
        size="small"
        sx={{
          fontFamily: '"Work Sans", sans-serif',
          fontWeight: 600,
          fontSize: '0.7rem',
          backgroundColor: 'grey.600',
          color: '#fff',
        }}
      />
    );
  }
  const correct = row.teamChosen === row.winningTeam;
  return (
    <Chip
      label={correct ? 'Correct' : 'Incorrect'}
      size="small"
      sx={{
        fontFamily: '"Work Sans", sans-serif',
        fontWeight: 600,
        fontSize: '0.7rem',
        backgroundColor: correct ? 'success.light' : 'error.light',
        color: correct ? 'success.contrastText' : 'error.contrastText',
      }}
    />
  );
}

export default function WeekResultsGameRow({ row }: WeekResultsGameRowProps) {
  const pickedTeamName =
    row.teamChosen === 'home_team'
      ? row.homeTeam
      : row.teamChosen === 'away_team'
        ? row.awayTeam
        : null;

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        gap: 1,
      }}
    >
      <Box sx={{ flex: 1 }}>
        <Typography
          variant="h6"
          sx={{
            fontFamily: '"Bebas Neue", sans-serif',
            fontSize: '1.1rem',
            letterSpacing: '0.5px',
          }}
        >
          {row.awayTeam} @ {row.homeTeam}
        </Typography>

        {row.completed && row.awayPoints !== null && row.homePoints !== null && (
          <Typography
            variant="body2"
            sx={{
              fontFamily: '"Work Sans", sans-serif',
              color: 'primary.main',
              fontWeight: 600,
              mt: 0.25,
            }}
          >
            Final: {row.awayTeam} {row.awayPoints} - {row.homePoints} {row.homeTeam}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
          <Typography
            variant="body2"
            sx={{ fontFamily: '"Work Sans", sans-serif', color: 'text.secondary' }}
          >
            Pick:
          </Typography>
          {pickedTeamName !== null ? (
            <Typography
              variant="body2"
              sx={{ fontFamily: '"Work Sans", sans-serif', fontWeight: 600 }}
            >
              {pickedTeamName}
            </Typography>
          ) : (
            <Typography
              variant="body2"
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                color: 'text.secondary',
                fontStyle: 'italic',
              }}
            >
              No pick made
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ flexShrink: 0 }}>
        <ResultChip row={row} />
      </Box>
    </Paper>
  );
}
