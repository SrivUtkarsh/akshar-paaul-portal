
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute, httpError } from '../utils.js';

const router = Router();

// Only authenticated administrators can manage portal accounts.
router.use(requireAuth, requireRole('admin'));

// List accounts without ever returning password hashes.
router.get(
  '/',
  asyncRoute(async (_req, res) => {
    const { rows } = await pool.query(
      `SELECT id, name, username, email, role, active, created_at
       FROM users
       ORDER BY role, name`
    );

    res.json({ users: rows });
  })
);

// Create a new faculty account.
router.post(
  '/faculty',
  asyncRoute(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const username = String(req.body.username || '').trim().toLowerCase();
    const email = String(req.body.email || '').trim() || null;
    const password = String(req.body.password || '');

    if (!name || name.length > 120) {
      throw httpError(400, 'Enter a faculty name of up to 120 characters.');
    }

    if (!/^[a-zA-Z0-9]{3,80}$/.test(username)) {
      throw httpError(
        400,
        'Username must be 3–80 characters and contain only letters and numbers.'
      );
    }

    if (password.length < 12) {
      throw httpError(
        400,
        'Temporary password must contain at least 12 characters.'
      );
    }

    if (password.length > 128) {
      throw httpError(400, 'Password must not exceed 128 characters.');
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw httpError(400, 'Enter a valid email address, or leave it blank.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const { rows } = await pool.query(
        `INSERT INTO users
          (name, username, email, password_hash, role, created_by)
         VALUES ($1, $2, $3, $4, 'faculty', $5)
         RETURNING id, name, username, email, role, active, created_at`,
        [name, username, email, passwordHash, req.user.id]
      );

      res.status(201).json({ user: rows[0] });
    } catch (error) {
      if (error.code === '23505') {
        throw httpError(409, 'That username or email is already in use.');
      }

      throw error;
    }
  })
);

// Activate or deactivate an existing faculty account.
router.patch(
  '/:id/active',
  asyncRoute(async (req, res) => {
    const userId = Number(req.params.id);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw httpError(400, 'Invalid faculty account ID.');
    }

    if (typeof req.body.active !== 'boolean') {
      throw httpError(400, 'Account status must be true or false.');
    }

    const active = req.body.active;

    // Prevent an administrator from accidentally disabling their own account.
    if (userId === Number(req.user.id) && !active) {
      throw httpError(
        400,
        'You cannot deactivate your own administrator account.'
      );
    }

    const { rows } = await pool.query(
      `UPDATE users
       SET active = $1
       WHERE id = $2 AND role = 'faculty'
       RETURNING id, name, username, email, role, active, created_at`,
      [active, userId]
    );

    if (!rows[0]) {
      throw httpError(404, 'Faculty account not found.');
    }

    res.json({ user: rows[0] });
  })
);

export default router;
