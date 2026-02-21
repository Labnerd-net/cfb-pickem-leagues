import { hc } from 'hono/client';
import type { AppType } from '@backend/index.js';

export const client = hc<AppType>(
  import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  { init: { credentials: 'include' } }
);
