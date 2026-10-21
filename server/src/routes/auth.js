import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { asyncRoute, httpError } from '../utils.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/login', asyncRoute(async (req, res) => {
  const username = String(req.body.username || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!username || !password) throw httpError(400, 'Enter your username and password.');

  const { rows } = await pool.query(
    `SELECT id, name, username, email, password_hash, role, active
     FROM users WHERE LOWER(username) = $1 LIMIT 1`,
    [username],
  );
  const user = rows[0];
  // Use the same error message for unknown usernames and incorrect passwords.
  if (!user || !user.active || !(await bcrypt.compare(password, user.password_hash))) {
    throw httpError(401, 'The username or password is incorrect.');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw httpError(500, 'The server has not been configured securely. Ask an administrator for help.');
  }

  const token = jwt.sign({ sub: String(user.id) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  res.json({
    token,
    user: { id: user.id, name: user.name, username: user.username, email: user.email, role: user.role },
  });
}));

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
