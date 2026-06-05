import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import type { LeagueMemberData } from '@shared/types/cfb-pickem-api.js';
import { getLeagueMembers, updateMemberRole, removeMember } from '../apis/leagueRequests';

interface LeagueMembersTableProps {
  leagueId: number;
  currentUserId?: number;
}

export default function LeagueMembersTable({ leagueId, currentUserId }: LeagueMembersTableProps) {
  const [members, setMembers] = useState<LeagueMemberData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getLeagueMembers(leagueId).then(result => {
      if (cancelled) return;
      if (result.success && result.data) {
        setMembers(result.data);
      } else {
        setError(result.error ?? 'Failed to load members');
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [leagueId]);

  async function handlePromote(userId: number) {
    setMutationError(null);
    const result = await updateMemberRole(leagueId, userId, 'admin');
    if (result.success) {
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: 'admin' } : m));
    } else {
      setMutationError(result.error ?? 'Failed to update role');
    }
  }

  async function handleDemote(userId: number) {
    setMutationError(null);
    const result = await updateMemberRole(leagueId, userId, 'member');
    if (result.success) {
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: 'member' } : m));
    } else {
      setMutationError(result.error ?? 'Failed to update role');
    }
  }

  async function handleRemove(userId: number) {
    setMutationError(null);
    const result = await removeMember(leagueId, userId);
    if (result.success) {
      setMembers(prev => prev.filter(m => m.userId !== userId));
    } else {
      setMutationError(result.error ?? 'Failed to remove member');
    }
  }

  return (
    <Box>
      <Typography variant="subtitle2" mb={1}>Members</Typography>
      {mutationError && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setMutationError(null)}>
          {mutationError}
        </Alert>
      )}
      {loading ? (
        <CircularProgress size={24} />
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Role</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {members.map(member => (
              <TableRow key={member.userId}>
                <TableCell>
                  {member.displayName}
                  {member.userId === currentUserId && (
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      (you)
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={member.role === 'admin' ? 'Admin' : 'Member'}
                    size="small"
                    color={member.role === 'admin' ? 'secondary' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  {member.userId !== currentUserId && (
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {member.role === 'member' ? (
                        <Button size="small" variant="outlined" onClick={() => handlePromote(member.userId)}>
                          Promote
                        </Button>
                      ) : (
                        <Button size="small" variant="outlined" color="warning" onClick={() => handleDemote(member.userId)}>
                          Demote
                        </Button>
                      )}
                      <Button size="small" variant="outlined" color="error" onClick={() => handleRemove(member.userId)}>
                        Remove
                      </Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
