import { useState } from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { sendLeagueBroadcast } from '../apis/leagueRequests';

interface LeagueBroadcastFormProps {
  leagueId: number;
}

export default function LeagueBroadcastForm({ leagueId }: LeagueBroadcastFormProps) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [override, setOverride] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleSend() {
    if (!subject.trim() || !message.trim()) return;
    setSending(true);
    setResult(null);
    const res = await sendLeagueBroadcast(leagueId, {
      subject,
      message,
      overrideEmailPreferences: override,
    });
    setResult({ success: res.success, message: res.success ? 'Message sent.' : (res.error ?? 'Failed to send') });
    if (res.success) {
      setSubject('');
      setMessage('');
      setOverride(false);
    }
    setSending(false);
  }

  return (
    <Box>
      <Typography variant="h6" mb={1}>Send Message to League</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Send a message to league members via email and any configured notification channels.
      </Typography>
      <Stack spacing={2}>
        <TextField label="Subject" size="small" fullWidth value={subject} onChange={e => setSubject(e.target.value)} inputProps={{ maxLength: 100 }} />
        <TextField label="Message" size="small" fullWidth multiline minRows={3} value={message} onChange={e => setMessage(e.target.value)} inputProps={{ maxLength: 1000 }} />
        <FormControlLabel
          control={<Checkbox checked={override} onChange={e => setOverride(e.target.checked)} size="small" />}
          label={<Typography variant="body2">Send to all members regardless of notification preferences</Typography>}
        />
        {result && <Alert severity={result.success ? 'success' : 'error'}>{result.message}</Alert>}
        <Box>
          <Button
            variant="contained"
            size="small"
            disabled={sending || !subject.trim() || !message.trim()}
            startIcon={sending ? <CircularProgress size={16} /> : undefined}
            onClick={handleSend}
          >
            {sending ? 'Sending...' : 'Send Message'}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
