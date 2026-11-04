import 'dotenv/config';
import { resetDemo } from '../demo/resetDemo.js';
import { buildDemoSeed } from '../demo/seedData.js';
import { demoGameData } from '../demo/demoGameData.js';

// Wipes the connected database and loads the demo seed. DESTRUCTIVE.
//
// Usage (point DEV_DB at the Neon *demo* branch connection string):
//   DEMO_MODE=true DEV_DB=postgres://... pnpm seed:demo --wipe-host=<host of that connection string>
//
// The --wipe-host argument must match the host in DEV_DB exactly. Typing the host is the
// confirmation that you are pointing at the database you intend to erase.

function hostOf(connectionString: string): string {
  try {
    return new URL(connectionString).hostname;
  } catch {
    return '';
  }
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('seed-demo: refused to run with NODE_ENV=production');
    process.exit(1);
  }
  if (process.env.DEMO_MODE !== 'true') {
    console.error('seed-demo: DEMO_MODE=true is required');
    process.exit(1);
  }
  const dbUrl = process.env.DEV_DB ?? '';
  const host = hostOf(dbUrl);
  if (!host) {
    console.error('seed-demo: DEV_DB must be set to the demo database connection string');
    process.exit(1);
  }
  const arg = process.argv.find(a => a.startsWith('--wipe-host='));
  if (arg?.slice('--wipe-host='.length) !== host) {
    console.error(`seed-demo: this erases ALL data in the database at host "${host}".`);
    console.error(`Re-run with --wipe-host=${host} to confirm that is the demo database.`);
    process.exit(1);
  }

  console.log(`seed-demo: resetting ${host}…`);
  await resetDemo(buildDemoSeed(demoGameData));
  console.log('seed-demo: done.');
  process.exit(0);
}

main().catch(err => {
  console.error('seed-demo failed:', err);
  process.exit(1);
});
