import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { prettyJSON } from 'hono/pretty-json';
import cron from 'node-cron';
import { clientURLs, serverPort } from './utils/envVars.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import userRoutes from './routes/user.js';
import leaderboardRoutes from './routes/leaderboard.js';
import { logger } from './utils/middleware.js';
import pinoLogger from './utils/logger.js';
import { runCronTick } from './cron/cronTick.js';

const app = new Hono();

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
  .route('/api/admin', adminRoutes)
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

serve(
  {
    fetch: app.fetch,
    hostname: '0.0.0.0', // Listen on all network interfaces
    port: serverPort,
  },
  info => {
    pinoLogger.info(
      { port: info.port, dbHost: process.env.DB_HOST ?? 'localhost' },
      'Server started'
    );
    cron.schedule('*/15 * * * *', () => {
      runCronTick().catch(err => pinoLogger.error(err, 'cron tick failed'));
    });
  }
);

export type AppType = typeof routes;
