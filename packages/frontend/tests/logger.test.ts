import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../src/utils/logger';

describe('Frontend logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    // Default to off (unset)
    import.meta.env.VITE_LOG_LEVEL = undefined as unknown as string;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    import.meta.env.VITE_LOG_LEVEL = undefined as unknown as string;
  });

  it('is a no-op when VITE_LOG_LEVEL is unset', () => {
    logger.error('test error');
    logger.warn('test warn');
    logger.info('test info');
    logger.debug('test debug');
    expect(console.error).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.info).not.toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('calls console.error when VITE_LOG_LEVEL=error', () => {
    import.meta.env.VITE_LOG_LEVEL = 'error';
    logger.error('something failed');
    expect(console.error).toHaveBeenCalledWith('something failed');
  });

  it('does not call console.warn when VITE_LOG_LEVEL=error', () => {
    import.meta.env.VITE_LOG_LEVEL = 'error';
    logger.warn('a warning');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('respects level hierarchy: info level suppresses debug calls', () => {
    import.meta.env.VITE_LOG_LEVEL = 'info';
    logger.debug('debug message');
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('respects level hierarchy: info level allows info and error', () => {
    import.meta.env.VITE_LOG_LEVEL = 'info';
    logger.info('info message');
    logger.error('error message');
    expect(console.info).toHaveBeenCalledWith('info message');
    expect(console.error).toHaveBeenCalledWith('error message');
  });

  it('debug level enables all methods', () => {
    import.meta.env.VITE_LOG_LEVEL = 'debug';
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(console.debug).toHaveBeenCalledWith('d');
    expect(console.info).toHaveBeenCalledWith('i');
    expect(console.warn).toHaveBeenCalledWith('w');
    expect(console.error).toHaveBeenCalledWith('e');
  });
});
