import { useEffect, useState } from 'react';
import {
  Box,
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
import { getUsers } from '../../apis/adminRequests';

export default function UsersSection() {
  const [users, setUsers] = useState<ProfileData[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Display Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Roles</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map(user => (
              <TableRow key={user.userId}>
                <TableCell>{user.displayName}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.roles.join(', ')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DashboardCard>
  );
}
