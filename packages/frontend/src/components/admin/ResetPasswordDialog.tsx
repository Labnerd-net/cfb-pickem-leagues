import { useState } from 'react';
import {
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from '@mui/material';
import LockResetIcon from '@mui/icons-material/LockReset';
import { resetUserPassword } from '../../apis/adminRequests';

interface ResetPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: number;
  displayName: string;
}

export default function ResetPasswordDialog({
  open,
  onClose,
  onSuccess,
  userId,
  displayName,
}: ResetPasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;
  const valid = password.length >= 8 && password.length <= 72 && password === confirm;

  const handleClose = () => {
    if (submitting) return;
    setPassword('');
    setConfirm('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await resetUserPassword(userId, password);
    if (result.success) {
      setPassword('');
      setConfirm('');
      onSuccess();
    } else {
      setError(result.error || 'Failed to reset password');
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Reset Password — {displayName}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          label="New Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          disabled={submitting}
          fullWidth
          autoComplete="new-password"
        />
        <TextField
          label="Confirm Password"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          disabled={submitting}
          fullWidth
          error={mismatch}
          helperText={mismatch ? 'Passwords do not match' : ''}
          autoComplete="new-password"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={submitting || !valid}
          startIcon={submitting ? <CircularProgress size={16} /> : <LockResetIcon />}
          onClick={handleSubmit}
        >
          {submitting ? 'Saving...' : 'Reset Password'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
