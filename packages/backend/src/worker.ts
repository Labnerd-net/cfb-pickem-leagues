/// <reference types="@cloudflare/workers-types" />
import { app } from './index.js';
import { runCronTick } from './cron/cronTick.js';
import pinoLogger from './utils/logger.js';

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, _env: unknown, _ctx: ExecutionContext) {
    await runCronTick().catch(err => pinoLogger.error(err, 'cron tick failed'));
  },
};
