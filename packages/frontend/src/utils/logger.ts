type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

const levels: LogLevel[] = ['off', 'error', 'warn', 'info', 'debug'];

function getConfiguredLevel(): LogLevel {
  const raw = import.meta.env.VITE_LOG_LEVEL as string | undefined;
  if (raw && levels.includes(raw as LogLevel)) {
    return raw as LogLevel;
  }
  return 'off';
}

function isEnabled(messageLevel: LogLevel): boolean {
  const configured = getConfiguredLevel();
  if (configured === 'off') return false;
  return levels.indexOf(messageLevel) <= levels.indexOf(configured);
}

export const logger = {
  error: (...args: unknown[]) => { if (isEnabled('error')) console.error(...args); },
  warn:  (...args: unknown[]) => { if (isEnabled('warn'))  console.warn(...args); },
  info:  (...args: unknown[]) => { if (isEnabled('info'))  console.info(...args); },
  debug: (...args: unknown[]) => { if (isEnabled('debug')) console.debug(...args); },
};
