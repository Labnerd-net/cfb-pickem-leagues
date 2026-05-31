import { serve } from '@hono/node-server';
import cron from 'node-cron';
import { app } from './index.js';
import { runCronTick } from './cron/cronTick.js';
import { serverPort } from './utils/envVars.js';
import pinoLogger from './utils/logger.js';

serve(
  {
    fetch: app.fetch,
    hostname: '0.0.0.0',
    port: serverPort,
  },
  info => {
    pinoLogger.info({ port: info.port }, 'Server started');
    cron.schedule('*/15 * * * *', () => {
      runCronTick().catch(err => pinoLogger.error(err, 'cron tick failed'));
    });
  }
);
