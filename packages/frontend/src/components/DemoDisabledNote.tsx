import { Typography } from '@mui/material';
import { IS_DEMO, DEMO_DISABLED_NOTE } from '../lib/demo';

// A short explanation shown beside a control that the demo turns off. Renders nothing outside the demo.
export default function DemoDisabledNote({ text = DEMO_DISABLED_NOTE }: { text?: string }) {
  if (!IS_DEMO) return null;
  return (
    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
      {text}
    </Typography>
  );
}
