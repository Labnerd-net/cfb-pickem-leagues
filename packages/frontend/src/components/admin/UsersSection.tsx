import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import DownloadIcon from '@mui/icons-material/Download';
import SendIcon from '@mui/icons-material/Send';
import type { ProfileData } from '@shared/types/cfb-pickem-api';
import DashboardCard from '../dashboard/DashboardCard';
import { getUsers, updateUserRoles, getAdminExport } from '../../apis/adminRequests';
import { useAuth } from '../../contexts/auth/AuthContext';
import { downloadCsv } from '../../lib/exportCsv';
import BroadcastDialog from './BroadcastDialog';
import ResetPasswordDialog from './ResetPasswordDialog';

export default function UsersSection() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Broadcast dialog state
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // Reset password state
  const [resetTarget, setResetTarget] = useState<ProfileData | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      setLoading(true);
      const result = await getUsers();
      if (result.success && result.data) {
        setUsers(result.data);
      } else {
        setErrorMessage(result.error || 'Failed to load users');
      }
      setLoading(false);
    };
    loadUsers();
  }, []);

  const handleRoleToggle = async (user: ProfileData) => {
    setUpdatingId(user.userId);
    setUpdateError(null);
    const isAdmin = user.roles.includes('admin');
    const newRoles: ProfileData['roles'] = isAdmin ? ['user'] : ['user', 'admin'];
    const result = await updateUserRoles(user.userId, newRoles);
    if (result.success && result.data) {
      setUsers(prev => prev.map(u => (u.userId === user.userId ? result.data! : u)));
    } else {
      setUpdateError(result.error || 'Failed to update roles');
    }
    setUpdatingId(null);
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    const result = await getAdminExport();
    if (!result.success || !result.data) {
      setExportError(result.error || 'Export failed');
      setExporting(false);
      return;
    }
    const rows = result.data;
    const header = 'Display Name,Email,Roles,Total Picks,Correct Picks,Accuracy';
    const csvRows = rows.map(r => {
      const accuracy = (r.accuracy * 100).toFixed(1) + '%';
      const displayName = `"${r.displayName.replace(/"/g, '""')}"`;
      const email = `"${r.email.replace(/"/g, '""')}"`;
      return [displayName, email, r.roles.join(';'), r.total, r.correct, accuracy].join(',');
    });
    const csv = [header, ...csvRows].join('\n');
    const filename = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(csv, filename);
    setExporting(false);
  };

  return (
    <DashboardCard
      icon={<PeopleIcon sx={{ fontSize: 32, color: 'secondary.main', mr: 2 }} />}
      title="Users"
      accentColor="secondary"
    >
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : errorMessage ? (
        <Alert severity="error">{errorMessage}</Alert>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={exporting ? <CircularProgress size={16} /> : <DownloadIcon />}
              disabled={loading || exporting || users.length === 0}
              onClick={handleExport}
            >
              Export CSV
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<SendIcon />}
              onClick={() => setBroadcastOpen(true)}
            >
              Send Notification
            </Button>
          </Box>
          {exportError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {exportError}
            </Alert>
          )}
          {updateError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {updateError}
            </Alert>
          )}
          {resetSuccess && (
            <Alert severity="success" sx={{ mb: 1 }} onClose={() => setResetSuccess(null)}>
              {resetSuccess}
            </Alert>
          )}
          {users.length === 0 ? (
            <Typography
              sx={{
                fontFamily: '"Work Sans", sans-serif',
                color: 'text.secondary',
                textAlign: 'center',
                py: 4,
                fontStyle: 'italic',
              }}
            >
              No users found
            </Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Display Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Roles</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map(user => {
                  const isCurrentUser = user.userId === currentUser?.userId;
                  const isAdmin = user.roles.includes('admin');
                  return (
                    <TableRow key={user.userId}>
                      <TableCell>{user.displayName}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.roles.join(', ')}</TableCell>
                      <TableCell align="right">
                        {!isCurrentUser && (
                          <>
                            <Button
                              size="small"
                              variant="outlined"
                              color={isAdmin ? 'warning' : 'primary'}
                              disabled={updatingId === user.userId}
                              onClick={() => handleRoleToggle(user)}
                              sx={{ mr: 1 }}
                            >
                              {updatingId === user.userId ? (
                                <CircularProgress size={16} />
                              ) : isAdmin ? (
                                'Remove Admin'
                              ) : (
                                'Make Admin'
                              )}
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="secondary"
                              onClick={() => { setResetSuccess(null); setResetTarget(user); }}
                            >
                              Reset Password
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </>
      )}

      <BroadcastDialog open={broadcastOpen} onClose={() => setBroadcastOpen(false)} />

      {resetTarget && (
        <ResetPasswordDialog
          open={!!resetTarget}
          userId={resetTarget.userId}
          displayName={resetTarget.displayName}
          onClose={() => setResetTarget(null)}
          onSuccess={() => {
            setResetSuccess(`Password reset for ${resetTarget.displayName}.`);
            setResetTarget(null);
          }}
        />
      )}
    </DashboardCard>
  );
}
