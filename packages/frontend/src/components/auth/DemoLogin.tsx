import { Button, Stack, Typography } from '@mui/material';

interface DemoLoginProps {
  loading: boolean;
  onSelect: (account: 'user' | 'admin') => void;
}

// The demo has no registration or passwords: visitors pick one of two shared, seeded accounts.
export default function DemoLogin({ loading, onSelect }: DemoLoginProps) {
  return (
    <Stack spacing={2}>
      <Typography color="text.secondary">
        Explore a College Football Pick'em league mid-way through the 2024 season. No sign-up needed —
        choose how to look around.
      </Typography>
      <Button variant="contained" size="large" disabled={loading} onClick={() => onSelect('user')}>
        Sign in as a player
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ mt: '-8px !important' }}>
        Make picks, see the leaderboard and past weeks.
      </Typography>
      <Button variant="outlined" size="large" disabled={loading} onClick={() => onSelect('admin')}>
        Sign in as an admin
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ mt: '-8px !important' }}>
        Manage the league's game pool, correct scores, view users and logs. Destructive and outbound
        actions are turned off.
      </Typography>
    </Stack>
  );
}
