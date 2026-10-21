import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

// One shared pool is reused by all routes so the app does not open a new
// PostgreSQL connection for every request (important in serverless hosting too).
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : undefined,
  max: Number(process.env.PG_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on('error', (error) => {
  // A pool error should be visible to operators, but never leak secrets to users.
  console.error('Unexpected PostgreSQL pool error:', error.message);
});
