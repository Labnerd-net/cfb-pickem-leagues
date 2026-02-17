import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pkg from 'pg';
const { Pool } = pkg;

async function runMigrations() {
  const pgUser = process.env.DB_USER || 'postgres';
  const pgPassword = process.env.DB_PASSWORD || 'postgres';
  const pgHost = process.env.DB_HOST || 'localhost';
  const pgPort = process.env.DB_PORT || '5432';
  const pgName = process.env.DB_NAME || 'cfb-pickem';

  // Set DB_SSL=true to enable SSL (e.g. for external managed databases with self-signed certs)
  const sslConfig = process.env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: false } } : {};

  const pool = new Pool({
    user: pgUser,
    password: pgPassword,
    host: pgHost,
    port: Number(pgPort),
    database: pgName,
    max: 1, // Limit connections during migration
    ...sslConfig,
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
