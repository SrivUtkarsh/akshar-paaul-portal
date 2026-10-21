import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

// Use this script once to create the first administrator. Choose credentials
// through environment variables rather than committing a default password.
try {
  const username = String(process.env.ADMIN_USERNAME || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Portal Administrator';
  if (!username || !password || password.length < 12) {
    throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD (at least 12 characters) in server/.env before seeding.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await pool.query(
    `INSERT INTO users (name, username, password_hash, role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (username) DO NOTHING`,
    [name, username, passwordHash],
  );
  console.log(`Administrator '${username}' is ready (existing accounts are not overwritten).`);
} catch (error) {
  console.error('Could not seed administrator:', error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
