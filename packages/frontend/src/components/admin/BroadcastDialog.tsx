import { useState } from 'react';
import {
  Button,
  Checkbox,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { sendAdminBroadcast } from '../../apis/adminRequests';

interface BroadcastDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function BroadcastDialog({ open, onClose }: BroadcastDialogProps) {
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [overrideEmailPrefs, setOverrideEmailPrefs] = useState(false);
  const [sending, setSending] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastSuccess, setBroadcastSuccess] = useState(false);

  const broadcastFormValid = broadcastSubject.trim().length > 0 && broadcastMessage.trim().length > 0;

  const handleClose = () => {
    if (sending) return;
    setBroadcastSubject('');
    setBroadcastMessage('');
    setOverrideEmailPrefs(false);
    setBroadcastError(null);
    setBroadcastSuccess(false);
    onClose();
  };

  const handleSend = async () => {
    setSending(true);
    setBroadcastError(null);
    const result = await sendAdminBroadcast({
      subject: broadcastSubject,
      message: broadcastMessage,
      overrideEmailPreferences: overrideEmailPrefs,
    });
    if (result.success) {
      setBroadcastSuccess(true);
    } else {
      setBroadcastError(result.error || 'Failed to send broadcast');
    }
    setSending(false);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Send Notification to All Users</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {broadcastSuccess ? (
          <Alert severity="success">Notification sent successfully.</Alert>
        ) : (
          <>
            {broadcastError && <Alert severity="error">{broadcastError}</Alert>}
            <TextField
              label="Subject"
              value={broadcastSubject}
              onChange={e => setBroadcastSubject(e.target.value)}
              inputProps={{ maxLength: 100 }}
              helperText={`${broadcastSubject.length}/100`}
              disabled={sending}
              fullWidth
            />
            <TextField
              label="Message"
              value={broadcastMessage}
              onChange={e => setBroadcastMessage(e.target.value)}
              inputProps={{ maxLength: 1000 }}
              helperText={`${broadcastMessage.length}/1000`}
              multiline
              minRows={4}
              disabled={sending}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={overrideEmailPrefs}
                  onChange={e => setOverrideEmailPrefs(e.target.checked)}
                  disabled={sending}
                />
              }
              label="Override email preferences (send to all verified emails)"
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={sending}>
          {broadcastSuccess ? 'Close' : 'Cancel'}
        </Button>
        {!broadcastSuccess && (
          <Button
            variant="contained"
            disabled={sending || !broadcastFormValid}
            startIcon={sending ? <CircularProgress size={16} /> : <SendIcon />}
            onClick={handleSend}
          >
            {sending ? 'Sending...' : 'Send'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
