import { Link } from '@mui/material';
import { IS_DEMO, DEMO_URL } from '../lib/demo';

// Points visitors of the real site at the demo. Not shown inside the demo itself.
export default function DemoLink({ align = 'left' }: { align?: 'left' | 'center' }) {
  if (IS_DEMO) return null;
  return (
    <Link
      href={DEMO_URL}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      sx={{
        display: 'block',
        textAlign: align,
        fontFamily: '"Work Sans", sans-serif',
        fontWeight: 600,
        color: 'secondary.main',
      }}
    >
      Just looking? Try the live demo →
    </Link>
  );
}
