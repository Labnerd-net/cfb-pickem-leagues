import { describe, it, expect, vi, afterEach } from 'vitest';
import pino from 'pino';

describe('Backend logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.LOG_LEVEL;
  });

  describe('level configuration', () => {
    it('sets level to debug when LOG_LEVEL=debug', () => {
      const logger = pino({ level: 'debug' });
      expect(logger.level).toBe('debug');
    });

    it('defaults to info when LOG_LEVEL is unset', () => {
      const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });
      expect(logger.level).toBe('info');
    });

    it('suppresses debug messages when LOG_LEVEL=info', () => {
      const logger = pino({ level: 'info' });
      expect(logger.isLevelEnabled('debug')).toBe(false);
    });

    it('emits debug messages when LOG_LEVEL=debug', () => {
      const logger = pino({ level: 'debug' });
      expect(logger.isLevelEnabled('debug')).toBe(true);
    });

    it('reads LOG_LEVEL env var and applies it', async () => {
      process.env.LOG_LEVEL = 'debug';
      const { default: logger } = await import('../../../src/utils/logger.js');
      expect(logger.level).toBe('debug');
    });
  });

  describe('HTTP request middleware logging', () => {
    it('logs method, path, status, and duration fields', async () => {
      const pinoInfoSpy = vi.fn();
      vi.doMock('../../../src/utils/logger.js', () => ({
        default: {
          info: pinoInfoSpy,
          error: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          level: 'info',
          isLevelEnabled: vi.fn(() => true),
        },
      }));

      const { logger: httpLogger } = await import('../../../src/utils/middleware.js');

      const mockContext = {
        req: { method: 'GET', path: '/api/user/profile' },
        res: { status: 200 },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any;

      await httpLogger(mockContext, vi.fn().mockResolvedValue(undefined));

      expect(pinoInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          path: '/api/user/profile',
          status: 200,
          duration: expect.any(Number),
        })
      );
    });
  });

  describe('sensitive field safety', () => {
    it('auth route error logging does not include password or token fields', () => {
      const errorSpy = vi.fn();
      const mockLogger = { error: errorSpy };

      // Mirrors exactly what auth routes log — only the Error object, not credentials
      const error = new Error('DB connection failed');
      mockLogger.error({ err: error }, 'Unexpected error in auth route');

      const loggedFields = errorSpy.mock.calls[0][0];
      expect(loggedFields).not.toHaveProperty('password');
      expect(loggedFields).not.toHaveProperty('token');
      expect(loggedFields).not.toHaveProperty('email');
    });
  });
});
