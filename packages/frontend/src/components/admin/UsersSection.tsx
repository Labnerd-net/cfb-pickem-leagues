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
import type { ProfileData } from '@shared/types/cfb-pickem-api';
import DashboardCard from '../dashboard/DashboardCard';
import { getUsers, updateUserRoles } from '../../apis/adminRequests';
import { useAuth } from '../../contexts/auth/AuthContext';

export default function UsersSection() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

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
      ) : users.length === 0 ? (
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
        <>
          {updateError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {updateError}
            </Alert>
          )}
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
                        <Button
                          size="small"
                          variant="outlined"
                          color={isAdmin ? 'warning' : 'primary'}
                          disabled={updatingId === user.userId}
                          onClick={() => handleRoleToggle(user)}
                        >
                          {updatingId === user.userId ? (
                            <CircularProgress size={16} />
                          ) : isAdmin ? (
                            'Remove Admin'
                          ) : (
                            'Make Admin'
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
    </DashboardCard>
  );
}
