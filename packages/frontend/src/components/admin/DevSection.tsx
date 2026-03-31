import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Chip,
  Divider,
  TextField,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestoreIcon from '@mui/icons-material/Restore';
import DashboardCard from '../dashboard/DashboardCard';
import { getActiveSimTime } from '../../utils/clock';

const LS_KEY = 'devCurrentTime';

/** Convert an ISO string to a value suitable for <input type="datetime-local"> (local time). */
function toInputValue(iso: string): string {
  const d = new Date(iso);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

/** Convert a datetime-local input value (local time) to an ISO string. */
function fromInputValue(value: string): string {
  return new Date(value).toISOString();
}

// ---------------------------------------------------------------------------
// Simulated Clock Card
// ---------------------------------------------------------------------------

function SimClockCard() {
  const activeIso = getActiveSimTime();
  const [inputValue, setInputValue] = useState(
    activeIso ? toInputValue(activeIso) : toInputValue(new Date().toISOString())
  );

  const handleApply = () => {
    if (!inputValue) return;
    const iso = fromInputValue(inputValue);
    if (isNaN(new Date(iso).getTime())) return;
    localStorage.setItem(LS_KEY, iso);
    window.location.reload();
  };

  const handleReset = () => {
    localStorage.removeItem(LS_KEY);
    window.location.reload();
  };

  const usingLocal = !!localStorage.getItem(LS_KEY);
  const usingEnv = !usingLocal && !!import.meta.env.VITE_DEV_CURRENT_TIME;

  return (
    <DashboardCard
      icon={<AccessTimeIcon sx={{ fontSize: 32, color: 'warning.main', mr: 2 }} />}
      title="Simulated Clock"
      accentColor="secondary"
    >
      <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" sx={{ fontFamily: '"Work Sans", sans-serif', color: 'text.secondary' }}>
            Active time:
          </Typography>
          {activeIso ? (
            <>
              <Chip
                label={new Date(activeIso).toLocaleString()}
                size="small"
                color="warning"
                variant="outlined"
                sx={{ fontFamily: '"Work Sans", sans-serif', fontWeight: 600 }}
              />
              <Chip
                label={usingLocal ? 'localStorage' : 'env var'}
                size="small"
                variant="outlined"
                sx={{ fontFamily: '"Work Sans", sans-serif', fontSize: '0.7rem' }}
              />
            </>
          ) : (
            <Chip
              label="Real clock"
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontFamily: '"Work Sans", sans-serif' }}
            />
          )}
        </Box>

        <Divider />

        {/* Input + buttons */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <TextField
            label="Set simulated time"
            type="datetime-local"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            sx={{ flexGrow: 1, minWidth: 220, fontFamily: '"Work Sans", sans-serif' }}
          />
          <Button variant="contained" onClick={handleApply} sx={{ whiteSpace: 'nowrap' }}>
            Apply &amp; Reload
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<RestoreIcon />}
            onClick={handleReset}
            disabled={!usingLocal}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Real Time
          </Button>
        </Box>

        {usingEnv && (
          <Alert severity="info" sx={{ fontFamily: '"Work Sans", sans-serif' }}>
            Time is pinned by <code>VITE_DEV_CURRENT_TIME</code>. Use the input above to override it
            via localStorage, or restart Vite without the env var to return to real time.
          </Alert>
        )}

        <Alert severity="warning" sx={{ fontFamily: '"Work Sans", sans-serif' }}>
          This controls the <strong>frontend</strong> lock state only. The backend deadline
          enforcement is separate — restart the backend with{' '}
          <code>DEV_CURRENT_TIME=&lt;iso&gt;</code> to match.
        </Alert>
      </Box>
    </DashboardCard>
  );
}

// ---------------------------------------------------------------------------
// DevSection — top-level export (dev-only; Simulated Clock only)
// ---------------------------------------------------------------------------

export default function DevSection() {
  return <SimClockCard />;
}
