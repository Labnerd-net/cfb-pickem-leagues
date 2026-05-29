import { Select, MenuItem, Typography, FormControl, useTheme, alpha } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useLeague } from '../contexts/LeagueContext';

export default function LeagueSwitcher() {
  const { leagues, activeLeague, setActiveLeague } = useLeague();
  const theme = useTheme();

  if (leagues.length === 0 || !activeLeague) return null;

  if (leagues.length === 1) {
    return (
      <Typography
        sx={{
          fontFamily: '"Work Sans", sans-serif',
          fontWeight: 600,
          fontSize: '0.85rem',
          color: 'text.secondary',
          px: 1.5,
          py: 0.5,
          border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
          borderRadius: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {activeLeague.name}
      </Typography>
    );
  }

  function handleChange(e: SelectChangeEvent<number>) {
    const selected = leagues.find(l => l.leagueId === Number(e.target.value));
    if (selected) setActiveLeague(selected);
  }

  return (
    <FormControl size="small" sx={{ minWidth: 140 }}>
      <Select
        value={activeLeague.leagueId}
        onChange={handleChange}
        displayEmpty
        sx={{
          fontFamily: '"Work Sans", sans-serif',
          fontWeight: 600,
          fontSize: '0.85rem',
          color: 'text.secondary',
          '.MuiOutlinedInput-notchedOutline': {
            borderColor: alpha(theme.palette.divider, 0.5),
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: theme.palette.secondary.main,
          },
        }}
      >
        {leagues.map(league => (
          <MenuItem key={league.leagueId} value={league.leagueId}>
            {league.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
