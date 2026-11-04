import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/utils/envVars.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../src/utils/envVars.js')>()),
  demoMode: false,
}));

import { resetDemo } from '../../../src/demo/resetDemo.js';
import { buildDemoSeed } from '../../../src/demo/seedData.js';
import { makeGameData } from './fixtures.js';
import { db } from '../../../src/db/index.js';
import { sql } from 'drizzle-orm';

describe('resetDemo without DEMO_MODE', () => {
  it('refuses to run and does not touch the database', async () => {
    await db.execute(sql`INSERT INTO "user".users (email, display_name, password_hash, roles) VALUES ('keep@example.com', 'Keep', 'x', ARRAY['user']::text[])`);
    await expect(resetDemo(buildDemoSeed(makeGameData()))).rejects.toThrow(/DEMO_MODE/);
    const rows = await db.execute(sql`SELECT COUNT(*)::int AS n FROM "user".users`);
    expect((rows as unknown as { rows: { n: number }[] }).rows[0].n).toBe(1);
  });
});
