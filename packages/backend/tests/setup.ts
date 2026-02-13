import 'dotenv/config';
import { vi } from 'vitest';

// Override environment variables for test database
process.env.DB_NAME = 'cfb-pickem-test';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-do-not-use-in-production';

// Set global test timeout
vi.setConfig({ testTimeout: 10000 });
