/// <reference types="@cloudflare/workers-types" />
import { app } from './index.js';
import { runCronTick } from './cron/cronTick.js';
import pinoLogger from './utils/logger.js';
import { reinitializeSecrets } from './utils/envVars.js';

interface Env {
  RATE_LIMIT_KV: KVNamespace;
  ASSETS: Fetcher;
  [key: string]: unknown;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    reinitializeSecrets(env as Record<string, string | undefined>);
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/') || pathname === '/health') {
      return app.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    reinitializeSecrets(env as Record<string, string | undefined>);
    await runCronTick().catch(err => pinoLogger.error(err, 'cron tick failed'));
  },
};
