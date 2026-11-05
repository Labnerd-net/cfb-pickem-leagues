// True only in the public demo build (`pnpm build:demo`). Inlined at build time, so the
// demo-only UI is dead code in the normal bundle.
export const IS_DEMO = import.meta.env.VITE_DEMO_MODE === 'true';

export const DEMO_DISABLED_NOTE = 'Disabled in the demo.';

// The public demo deployment. Linked from the production site so visitors can look around first.
export const DEMO_URL = 'https://cfbpickem-demo.labnerd.net/login';
