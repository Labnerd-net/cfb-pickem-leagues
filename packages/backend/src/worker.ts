/// <reference types="@cloudflare/workers-types" />
import { app } from './index.js';
import { runCronTick } from './cron/cronTick.js';
import pinoLogger from './utils/logger.js';
import { reinitializeSecrets } from './utils/envVars.js';
import { syncDbEnv } from './db/index.js';

interface Env {
  AUTH_RATE_LIMITER: RateLimit;
  API_RATE_LIMITER: RateLimit;
  ASSETS: Fetcher;
  CRON_CACHE?: KVNamespace;
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    reinitializeSecrets(env as Record<string, string | undefined>);
    syncDbEnv(env as Record<string, string | undefined>);
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/') || pathname === '/health') {
      return app.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    reinitializeSecrets(env as Record<string, string | undefined>);
    syncDbEnv(env as Record<string, string | undefined>);
    await runCronTick(env.CRON_CACHE).catch(err => pinoLogger.error(err, 'cron tick failed'));
  },
};
