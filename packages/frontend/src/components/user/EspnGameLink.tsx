import { Link } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface EspnGameLinkProps {
  cfbdGameId: number | null;
}

export default function EspnGameLink({ cfbdGameId }: EspnGameLinkProps) {
  if (cfbdGameId === null) return null;

  return (
    <Link
      href={`https://www.espn.com/college-football/game/_/gameId/${cfbdGameId}`}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        mt: 0.25,
        fontFamily: '"Work Sans", sans-serif',
        fontSize: '0.8rem',
      }}
    >
      ESPN
      <OpenInNewIcon sx={{ fontSize: '0.9rem' }} />
    </Link>
  );
}
