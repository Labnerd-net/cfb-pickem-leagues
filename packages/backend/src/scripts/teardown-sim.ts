import 'dotenv/config';
import { db } from '../db/index.js';
import { adminWeeks, adminGames } from '../db/schema/admin.js';
import { notificationLog } from '../db/schema/users.js';
import { and, eq, inArray } from 'drizzle-orm';

// Removes all data inserted by seed-sim.ts (year=2025, weeks 1-5).
// User picks cascade-delete automatically when games are removed.

const SIM_YEAR = 2025;
const SIM_WEEKS = [1, 2, 3, 4, 5];

async function main() {
  console.log('teardown-sim: clearing notification logs…');
  await db
    .delete(notificationLog)
    .where(and(eq(notificationLog.year, SIM_YEAR), inArray(notificationLog.weekNumber, SIM_WEEKS)));

  console.log('teardown-sim: deleting games…');
  await db
    .delete(adminGames)
    .where(and(eq(adminGames.year, SIM_YEAR), inArray(adminGames.weekNumber, SIM_WEEKS)));

  console.log('teardown-sim: deleting weeks…');
  await db
    .delete(adminWeeks)
    .where(and(eq(adminWeeks.year, SIM_YEAR), inArray(adminWeeks.weekNumber, SIM_WEEKS)));

  console.log('teardown-sim: done.');
  process.exit(0);
}

main().catch(err => {
  console.error('teardown-sim failed:', err);
  process.exit(1);
});
