import { describe, it, expect } from 'vitest';
import { validateEnv } from '../../../src/utils/envVars.js';

const minimalValid = {
  JWT_SECRET: 'supersecret',
  DATA_SOURCE: 'ncaa',
} as NodeJS.ProcessEnv;

describe('validateEnv', () => {
  it('passes with minimal valid config', () => {
    expect(() => validateEnv(minimalValid)).not.toThrow();
  });

  it('throws when JWT_SECRET is missing', () => {
    expect(() => validateEnv({ DATA_SOURCE: 'ncaa' } as NodeJS.ProcessEnv)).toThrow('FATAL');
  });

  it('throws when JWT_SECRET is empty string', () => {
    expect(() => validateEnv({ JWT_SECRET: '', DATA_SOURCE: 'ncaa' } as NodeJS.ProcessEnv)).toThrow('FATAL');
  });

  it('throws when DATA_SOURCE=cfbd and CFBD_API_KEY is missing', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: 'secret', DATA_SOURCE: 'cfbd' } as NodeJS.ProcessEnv)
    ).toThrow('CFBD_API_KEY');
  });

  it('passes when DATA_SOURCE=ncaa and CFBD_API_KEY is missing', () => {
    expect(() => validateEnv({ JWT_SECRET: 'secret', DATA_SOURCE: 'ncaa' } as NodeJS.ProcessEnv)).not.toThrow();
  });

  it('passes when DATA_SOURCE=cfbd and CFBD_API_KEY is provided', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: 'secret', DATA_SOURCE: 'cfbd', CFBD_API_KEY: 'mykey' } as NodeJS.ProcessEnv)
    ).not.toThrow();
  });

  it('throws when DATA_SOURCE is an invalid value', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: 'secret', DATA_SOURCE: 'invalid' } as NodeJS.ProcessEnv)
    ).toThrow('FATAL');
  });

  it('throws when SMTP_PORT is a non-numeric string', () => {
    expect(() =>
      validateEnv({ ...minimalValid, SMTP_PORT: 'abc' } as NodeJS.ProcessEnv)
    ).toThrow('FATAL');
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
