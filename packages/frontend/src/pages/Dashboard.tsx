import { Container, Box, Paper, Typography } from '@mui/material';
import { useAuth } from '../contexts/auth/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4, mb: 4 }}>
        {/* Welcome Section */}
        <Paper elevation={3} sx={{ p: 4, mb: 3 }}>
          <Typography variant="h4" gutterBottom>
            Welcome, {user?.displayName}!
          </Typography>
          <Typography color="text.secondary">
            Ready to make your picks for this week?
          </Typography>
        </Paper>

        {/* Placeholder Sections */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 3,
          }}
        >
          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Your Picks
            </Typography>
            <Typography color="text.secondary">Coming soon...</Typography>
          </Paper>

          <Paper elevation={2} sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Leaderboard
            </Typography>
            <Typography color="text.secondary">Coming soon...</Typography>
          </Paper>

          <Paper elevation={2} sx={{ p: 3, gridColumn: { xs: '1', md: 'span 2' } }}>
            <Typography variant="h6" gutterBottom>
              This Week's Games
            </Typography>
            <Typography color="text.secondary">Coming soon...</Typography>
          </Paper>
        </Box>
      </Box>
    </Container>
  );
}
