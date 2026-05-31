import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import { clientURLs } from './utils/envVars.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/user.js';
import leaderboardRoutes from './routes/leaderboard.js';
import leaguesRoute from './routes/leagues.js';
import adminLeaguesRoute from './routes/adminLeagues.js';
import { logger } from './utils/middleware.js';
import pinoLogger from './utils/logger.js';

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

type Bindings = { RATE_LIMIT_KV: KVNamespace };

const app = new Hono<{ Bindings: Bindings }>();

app.use(
  '*',
  cors({
    origin: clientURLs,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT'],
    exposeHeaders: ['Content-Length', 'Set-Cookie'],
    maxAge: 600,
    credentials: true,
  })
);
app.use(prettyJSON());
app.use(logger);

app.get('/', c => c.text('Welcome to the CFB Pickem!'));
app.notFound(c => c.json({ message: 'Not Found' }, 404));
app.get('/health', c => c.json({ status: 'UP' }));

// Typed sub-app for AppType inference — keep route() chained for type propagation
const routes = new Hono()
  .route('/api/auth', authRoutes)
  .route('/api/leagues', leaguesRoute)
  .route('/api/admin', adminRoutes)
  .route('/api/admin/leagues', adminLeaguesRoute)
  .route('/api/user', userRoutes)
  .route('/api/leaderboard', leaderboardRoutes);

app.route('', routes);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  pinoLogger.error(err);
  return c.json({ error: 'An unexpected error occurred' }, 500);
});

export { app };
export type AppType = typeof routes;
