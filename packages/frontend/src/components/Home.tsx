import { useNavigate } from 'react-router';
import {
  Container,
  Box,
  Typography,
  Button,
  Paper,
  Stack,
} from '@mui/material';
import SportsFootballIcon from '@mui/icons-material/SportsFootball';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';

export default function Home() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 8, mb: 4 }}>
        {/* Hero Section */}
        <Paper elevation={3} sx={{ p: 6, mb: 4, textAlign: 'center' }}>
          <SportsFootballIcon sx={{ fontSize: 80, mb: 2, color: 'primary.main' }} />
          <Typography variant="h2" component="h1" gutterBottom>
            College Football Pick'em
          </Typography>
          <Typography variant="h5" color="text.secondary" paragraph>
            Test your college football knowledge and compete with friends
          </Typography>
          <Stack direction="row" spacing={2} justifyContent="center" sx={{ mt: 4 }}>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/login')}
            >
              Login
            </Button>
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/register')}
            >
              Sign Up
            </Button>
          </Stack>
        </Paper>

        {/* Features Section */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
            gap: 3,
          }}
        >
          <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
            <SportsFootballIcon sx={{ fontSize: 60, mb: 2, color: 'primary.main' }} />
            <Typography variant="h6" gutterBottom>
              Weekly Picks
            </Typography>
            <Typography color="text.secondary">
              Make your predictions for the biggest college football games each week
            </Typography>
          </Paper>

          <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
            <EmojiEventsIcon sx={{ fontSize: 60, mb: 2, color: 'primary.main' }} />
            <Typography variant="h6" gutterBottom>
              Track Your Score
            </Typography>
            <Typography color="text.secondary">
              See how your picks perform and climb the leaderboard
            </Typography>
          </Paper>

          <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
            <GroupsIcon sx={{ fontSize: 60, mb: 2, color: 'primary.main' }} />
            <Typography variant="h6" gutterBottom>
              Compete with Friends
            </Typography>
            <Typography color="text.secondary">
              Challenge your friends and prove who knows college football best
            </Typography>
          </Paper>
        </Box>

        {/* Call to Action */}
        <Paper elevation={2} sx={{ p: 4, mt: 4, textAlign: 'center' }}>
          <Typography variant="h5" gutterBottom>
            Ready to get started?
          </Typography>
          <Typography color="text.secondary">
            Create your account today and start making picks!
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/register')}
          >
            Sign Up Now
          </Button>
        </Paper>
      </Box>
    </Container>
  );
}
