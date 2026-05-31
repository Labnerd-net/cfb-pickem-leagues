import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;

async function runMigrations() {
  if (!process.env.PROD_DB) {
    console.error('❌ PROD_DB environment variable is not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.PROD_DB,
    max: 1,
  });

  const db = drizzle(pool);

  try {
    // Create schemas if they don't exist
    console.log('Creating database schemas...');
    await pool.query('CREATE SCHEMA IF NOT EXISTS admin');
    await pool.query('CREATE SCHEMA IF NOT EXISTS "user"');
    console.log('✅ Schemas ready');

    // Run migrations
    console.log('Starting database migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations completed successfully');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigrations();
