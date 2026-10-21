import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute, httpError } from '../utils.js';

const router = Router();

// Only authenticated administrators can manage portal accounts.
// This applies to every route below, so no route can forget the check.
router.use(requireAuth, requireRole('admin'));

// Turn the :id URL part into a safe positive integer, or reject the request.
// Without this, a value like "abc" would reach PostgreSQL and cause a 500 error.
function parseUserId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw httpError(400, 'Invalid account ID.');
  }
  return id;
}

// Shared password rule: used when resetting a password.
function validatePassword(password) {
  if (password.length < 12) {
    throw httpError(400, 'Password must contain at least 12 characters.');
  }
  if (password.length > 128) {
    throw httpError(400, 'Password must not exceed 128 characters.');
  }
}

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

    validatePassword(password);

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
    const userId = parseUserId(req.params.id);

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

// Reset a faculty member's password (admin sets a new temporary password).
// Only faculty accounts can be reset here, never administrator accounts.
router.patch(
  '/:id/password',
  asyncRoute(async (req, res) => {
    const userId = parseUserId(req.params.id);
    const password = String(req.body.password || '');

    validatePassword(password);

    const passwordHash = await bcrypt.hash(password, 12);

    const { rows } = await pool.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2 AND role = 'faculty'
       RETURNING id, name, username`,
      [passwordHash, userId]
    );

    if (!rows[0]) {
      throw httpError(404, 'Faculty account not found.');
    }

    res.json({
      message: `Password reset for ${rows[0].name}. Share the new password privately.`,
    });
  })
);

// Permanently delete a faculty account, but ONLY if nothing refers to it.
// If the account owns any records (work, books, rubrics, submissions, reviews),
// we refuse and suggest deactivating instead, so history is never lost.
router.delete(
  '/:id',
  asyncRoute(async (req, res) => {
    const userId = parseUserId(req.params.id);

    if (userId === Number(req.user.id)) {
      throw httpError(400, 'You cannot delete your own account.');
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Lock the row so nobody can add records for this user while we check.
      const { rows: targetRows } = await client.query(
        'SELECT id, role FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      const target = targetRows[0];

      if (!target) {
        throw httpError(404, 'Account not found.');
      }

      if (target.role !== 'faculty') {
        throw httpError(403, 'Only faculty accounts can be deleted.');
      }

      // Every column in schema.sql that points at users(id).
      const { rows: usage } = await client.query(
        `SELECT
           EXISTS (SELECT 1 FROM faculty_work WHERE faculty_id = $1)
             OR EXISTS (SELECT 1 FROM faculty_work_revisions WHERE saved_by = $1)
             OR EXISTS (SELECT 1 FROM work_reviews WHERE admin_id = $1)
             OR EXISTS (SELECT 1 FROM books WHERE created_by = $1)
             OR EXISTS (SELECT 1 FROM grading_standards WHERE created_by = $1)
             OR EXISTS (SELECT 1 FROM submissions WHERE submitted_by = $1 OR reviewed_by = $1)
             OR EXISTS (SELECT 1 FROM users WHERE created_by = $1)
           AS has_records`,
        [userId]
      );

      if (usage[0].has_records) {
        throw httpError(
          409,
          'This account has saved work or records, so it cannot be deleted. Deactivate it instead to keep the history.'
        );
      }

      await client.query('DELETE FROM users WHERE id = $1', [userId]);
      await client.query('COMMIT');

      res.json({ message: 'Faculty account deleted.' });
    } catch (error) {
      await client.query('ROLLBACK');

      // Safety net: if a future table references users, PostgreSQL itself
      // refuses the delete, and we turn that into a friendly message.
      if (error.code === '23503') {
        throw httpError(
          409,
          'This account is linked to other records, so it cannot be deleted. Deactivate it instead.'
        );
      }

      throw error;
    } finally {
      client.release();
    }
  })
);

export default router;