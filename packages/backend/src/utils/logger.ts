import pino from 'pino';
import { logLevel } from './envVars.js';

const logger = pino({
  level: logLevel,
});

export default logger;
