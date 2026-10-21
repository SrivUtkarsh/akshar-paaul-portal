import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const schemaPath = fileURLToPath(new URL('../../sql/schema.sql', import.meta.url));
try {
  // schema.sql uses CREATE IF NOT EXISTS so this command can safely be rerun.
  const schema = await readFile(schemaPath, 'utf8');
  await pool.query(schema);
  console.log('Database tables and indexes are ready.');
} catch (error) {
  console.error('Database setup failed:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
