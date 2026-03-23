import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Pagination,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { NotificationChannel, NotificationLogEntry, NotificationType } from '@shared/types/cfb-pickem-api';
import DashboardCard from '../dashboard/DashboardCard';
import { getNotificationLogs } from '../../apis/adminRequests';

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  games_ready: 'Games Ready',
  picks_reminder: 'Picks Reminder',
  rankings_updated: 'Rankings Updated',
  admin_broadcast: 'Admin Broadcast',
};

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'Email',
  ntfy: 'Ntfy',
  telegram: 'Telegram',
  discord: 'Discord',
};

const PAGE_SIZE = 50;

export default function NotificationLogSection() {
  const [entries, setEntries] = useState<NotificationLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | ''>('');
  const [typeFilter, setTypeFilter] = useState<NotificationType | ''>('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const loadLogs = async () => {
      setLoading(true);
      setError(null);
      const result = await getNotificationLogs({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        channel: channelFilter || undefined,
        notificationType: typeFilter || undefined,
      });
      if (result.success && result.data) {
        setEntries(result.data.entries);
        setTotal(result.data.total);
      } else {
        setError(result.error || 'Failed to load notification log');
      }
      setLoading(false);
    };
    loadLogs();
  }, [refreshKey, page, channelFilter, typeFilter]);

  return (
    <DashboardCard
      icon={<NotificationsIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />}
      title="Notification Log"
      accentColor="primary"
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Channel</InputLabel>
          <Select
            value={channelFilter}
            label="Channel"
            onChange={e => { setChannelFilter(e.target.value as NotificationChannel | ''); setPage(1); }}
          >
            <MenuItem value="">All</MenuItem>
            {(Object.keys(CHANNEL_LABELS) as NotificationChannel[]).map(ch => (
              <MenuItem key={ch} value={ch}>
                {CHANNEL_LABELS[ch]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={typeFilter}
            label="Type"
            onChange={e => { setTypeFilter(e.target.value as NotificationType | ''); setPage(1); }}
          >
            <MenuItem value="">All</MenuItem>
            {(Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]).map(t => (
              <MenuItem key={t} value={t}>
                {NOTIFICATION_TYPE_LABELS[t]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={() => { setPage(1); setRefreshKey(k => k + 1); }}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {total > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {total} total entr{total === 1 ? 'y' : 'ies'}
          </Typography>
          {total > PAGE_SIZE && (
            <Pagination
              count={Math.ceil(total / PAGE_SIZE)}
              page={page}
              onChange={(_e, value) => setPage(value)}
              size="small"
              disabled={loading}
            />
          )}
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : entries.length === 0 ? (
        <Typography
          sx={{
            fontFamily: '"Work Sans", sans-serif',
            color: 'text.secondary',
            textAlign: 'center',
            py: 4,
            fontStyle: 'italic',
          }}
        >
          No notifications have been sent yet.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date/Time</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Week</TableCell>
              <TableCell>Recipient</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map(entry => (
              <TableRow key={entry.id}>
                <TableCell>{new Date(entry.sentAt).toLocaleString()}</TableCell>
                <TableCell>
                  {NOTIFICATION_TYPE_LABELS[entry.notificationType] ?? entry.notificationType}
                </TableCell>
                <TableCell>{CHANNEL_LABELS[entry.channel] ?? entry.channel}</TableCell>
                <TableCell>
                  {entry.year === 0 && entry.weekNumber === 0
                    ? '–'
                    : entry.weekNumber === 0
                      ? `${entry.year} Pre-season`
                      : `${entry.year} W${entry.weekNumber}`}
                </TableCell>
                <TableCell>{entry.recipient}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DashboardCard>
  );
}
