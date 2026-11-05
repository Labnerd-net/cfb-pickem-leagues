import { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { IS_DEMO } from '../lib/demo';
import { getResetStatus, formatTimeUntil } from '../utils/nextReset';

function ResetCountdown() {
  // Real time on purpose — this is not the demo's pinned clock.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const { next, resetting } = getResetStatus(now);
  return <>{resetting ? 'Resetting…' : formatTimeUntil(next.getTime() - now.getTime())}</>;
}

export default function DemoBanner() {
  if (!IS_DEMO) return null;
  return (
    <Box
      role="region"
      aria-label="Demo notice"
      sx={{
        px: 2,
        py: 0.75,
        textAlign: 'center',
        bgcolor: 'warning.main',
        color: 'warning.contrastText',
      }}
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        Demo — the season is fixed to 2024 and all data resets at midnight Central. Next reset in{' '}
        <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }} data-testid="demo-reset-countdown">
          <ResetCountdown />
        </Box>
      </Typography>
    </Box>
  );
}
