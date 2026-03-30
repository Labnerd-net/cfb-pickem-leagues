import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

interface LockWarningDialogProps {
  open: boolean;
  unsavedCount: number;
  minutesUntilLock: number;
  onSubmit: () => void;
  onDismiss: () => void;
}

export default function LockWarningDialog({
  open,
  unsavedCount,
  minutesUntilLock,
  onSubmit,
  onDismiss,
}: LockWarningDialogProps) {
  return (
    <Dialog open={open} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: '0.5px', fontSize: '1.4rem' }}>
        Picks deadline approaching
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ fontFamily: '"Work Sans", sans-serif', fontSize: '0.95rem' }}>
          You have {unsavedCount} unsaved pick{unsavedCount !== 1 ? 's' : ''}. The first game locks
          in {minutesUntilLock} minute{minutesUntilLock !== 1 ? 's' : ''}.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onDismiss} sx={{ fontFamily: '"Work Sans", sans-serif' }}>
          Dismiss
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          sx={{ fontFamily: '"Bebas Neue", sans-serif', fontSize: '1rem', letterSpacing: '0.5px' }}
        >
          Submit Now
        </Button>
      </DialogActions>
    </Dialog>
  );
}
