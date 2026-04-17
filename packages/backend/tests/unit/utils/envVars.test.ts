import { describe, it, expect } from 'vitest';
import { validateEnv } from '../../../src/utils/envVars.js';

const minimalValid = {
  JWT_SECRET: 'supersecret',
  CFBD_API_KEY: 'testkey',
} as NodeJS.ProcessEnv;

describe('validateEnv', () => {
  it('passes with minimal valid config', () => {
    expect(() => validateEnv(minimalValid)).not.toThrow();
  });

  it('throws when JWT_SECRET is missing', () => {
    expect(() => validateEnv({ CFBD_API_KEY: 'testkey' } as NodeJS.ProcessEnv)).toThrow('FATAL');
  });

  it('throws when JWT_SECRET is empty string', () => {
    expect(() => validateEnv({ JWT_SECRET: '', CFBD_API_KEY: 'testkey' } as NodeJS.ProcessEnv)).toThrow('FATAL');
  });

  it('throws when CFBD_API_KEY is missing', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: 'secret' } as NodeJS.ProcessEnv)
    ).toThrow('CFBD_API_KEY');
  });

  it('throws when CFBD_API_KEY is empty string', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: 'secret', CFBD_API_KEY: '' } as NodeJS.ProcessEnv)
    ).toThrow('CFBD_API_KEY');
  });

  it('passes when CFBD_API_KEY is provided', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: 'secret', CFBD_API_KEY: 'mykey' } as NodeJS.ProcessEnv)
    ).not.toThrow();
  });

  it('uses default SERVER_PORT of 3000 when not set', () => {
    const result = validateEnv(minimalValid);
    expect(result.SERVER_PORT).toBe(3000);
  });

  it('coerces SERVER_PORT from string to number', () => {
    const result = validateEnv({ ...minimalValid, SERVER_PORT: '4000' } as NodeJS.ProcessEnv);
    expect(result.SERVER_PORT).toBe(4000);
  });
});
