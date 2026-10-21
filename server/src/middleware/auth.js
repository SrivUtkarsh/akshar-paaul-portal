import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import { asyncRoute, httpError } from '../utils.js';

// A valid token identifies the user; the current database row determines the
// active account and role so disabling an account takes effect immediately.
export const requireAuth = asyncRoute(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw httpError(401, 'Please sign in to continue.');

  let payload;
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET is not configured safely.');
    }
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw httpError(401, 'Your session has expired. Please sign in again.');
  }

  const { rows } = await pool.query(
    'SELECT id, name, username, email, role, active FROM users WHERE id = $1',
    [payload.sub],
  );
  const user = rows[0];
  if (!user || !user.active) throw httpError(401, 'This account is not available.');
  req.user = user;
  next();
});

// Apply this after requireAuth to keep admin-only functions in one obvious place.
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(httpError(403, 'You do not have permission to do that.'));
  }
  next();
};
