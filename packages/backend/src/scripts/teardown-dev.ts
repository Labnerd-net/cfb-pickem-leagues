import 'dotenv/config';
import { db } from '../db/index.js';
import { adminWeeks, adminGames } from '../db/schema/admin.js';
import { notificationLog } from '../db/schema/users.js';
import { and, eq, inArray } from 'drizzle-orm';

if (process.env.NODE_ENV === 'production') {
  console.error('teardown-dev: refused to run in production');
  process.exit(1);
}

const SEED_YEAR = 2024;
const SEED_WEEKS = [1, 2, 3];

async function main() {
  console.log('teardown-dev: clearing notification logs…');
  await db
    .delete(notificationLog)
    .where(and(eq(notificationLog.year, SEED_YEAR), inArray(notificationLog.weekNumber, SEED_WEEKS)));

  console.log('teardown-dev: deleting games…');
  await db
    .delete(adminGames)
    .where(and(eq(adminGames.year, SEED_YEAR), inArray(adminGames.weekNumber, SEED_WEEKS)));

  console.log('teardown-dev: deleting weeks…');
  await db
    .delete(adminWeeks)
    .where(and(eq(adminWeeks.year, SEED_YEAR), inArray(adminWeeks.weekNumber, SEED_WEEKS)));

  console.log('teardown-dev: done.');
  process.exit(0);
}

main().catch(err => {
  console.error('teardown-dev failed:', err);
  process.exit(1);
});
