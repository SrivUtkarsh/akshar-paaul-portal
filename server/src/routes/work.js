import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute, httpError } from '../utils.js';

const router = Router();
router.use(requireAuth);

function requireNumericId(value) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw httpError(400, 'Invalid ID.');
  }
  return Number(value);
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// Admins see all activities; faculty see only the records they submitted.
router.get('/', asyncRoute(async (req, res) => {
  const status = String(req.query.status || '').trim();
  const params = [];
  let where = '';
  if (req.user.role !== 'admin') {
    params.push(req.user.id);
    where = 'WHERE w.faculty_id = $1';
  }
  if (['pending', 'approved', 'changes_requested'].includes(status)) {
    params.push(status);
    where += `${where ? ' AND' : ' WHERE'} w.status = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT w.*, u.name AS faculty_name, u.username AS faculty_username
     FROM faculty_work w JOIN users u ON u.id = w.faculty_id
     ${where} ORDER BY w.work_date DESC, w.submitted_at DESC`,
    params,
  );
  res.json({ work: rows });
}));

router.post('/', requireRole('faculty'), asyncRoute(async (req, res) => {
  const title = String(req.body.title || '').trim();
  const details = String(req.body.details || '').trim();
  const workDate = String(req.body.workDate || '').trim();
  if (!title || !details || !workDate) throw httpError(400, 'Add a title, date, and activity details.');
  if (title.length > 180 || details.length > 12000) throw httpError(400, 'The title or activity details are too long.');
  if (!isValidDate(workDate)) throw httpError(400, 'Enter a valid activity date.');

  const { rows } = await pool.query(
    `INSERT INTO faculty_work (faculty_id, work_date, title, details)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.id, workDate, title, details],
  );
  res.status(201).json({ work: rows[0] });
}));

router.patch('/:id', requireRole('faculty'), asyncRoute(async (req, res) => {
  const id = requireNumericId(req.params.id);
  const { rows: existingRows } = await pool.query('SELECT * FROM faculty_work WHERE id = $1', [id]);
  const existing = existingRows[0];
  if (!existing || existing.faculty_id !== req.user.id) throw httpError(404, 'Activity not found.');
  if (existing.status !== 'changes_requested') {
    throw httpError(409, 'You can edit an activity after the administrator requests changes.');
  }

  const title = String(req.body.title || '').trim();
  const details = String(req.body.details || '').trim();
  const workDate = String(req.body.workDate || '').trim();
  if (!title || !details || !workDate) throw httpError(400, 'Add a title, date, and activity details.');
  if (title.length > 180 || details.length > 12000) throw httpError(400, 'The title or activity details are too long.');
  if (!isValidDate(workDate)) throw httpError(400, 'Enter a valid activity date.');

  // Preserve the previous version before saving the faculty member's revision.
  await pool.query(
    `INSERT INTO faculty_work_revisions (work_id, saved_by, work_date, title, details, prior_status)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, req.user.id, existing.work_date, existing.title, existing.details, existing.status],
  );
  const { rows } = await pool.query(
    `UPDATE faculty_work SET work_date = $1, title = $2, details = $3,
       status = 'pending', latest_feedback = NULL, submitted_at = NOW(), updated_at = NOW(), reviewed_at = NULL
     WHERE id = $4 RETURNING *`,
    [workDate, title, details, id],
  );
  res.json({ work: rows[0] });
}));

router.post('/:id/review', requireRole('admin'), asyncRoute(async (req, res) => {
  const id = requireNumericId(req.params.id);
  const action = String(req.body.action || '');
  const feedback = String(req.body.feedback || '').trim();
  if (!['approved', 'changes_requested'].includes(action)) {
    throw httpError(400, 'Choose approve or request changes.');
  }
  if (action === 'changes_requested' && !feedback) {
    throw httpError(400, 'Add a comment explaining what needs to change.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query('SELECT id FROM faculty_work WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw httpError(404, 'Activity not found.');
    await client.query(
      `UPDATE faculty_work SET status = $1, latest_feedback = $2,
       reviewed_at = NOW(), updated_at = NOW() WHERE id = $3`,
      [action, feedback, id],
    );
    await client.query(
      `INSERT INTO work_reviews (work_id, admin_id, action, feedback)
       VALUES ($1, $2, $3, $4)`, [id, req.user.id, action, feedback],
    );
    await client.query('COMMIT');
    res.json({ message: action === 'approved' ? 'Activity approved.' : 'Changes requested.' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.get('/:id/history', asyncRoute(async (req, res) => {
  const id = requireNumericId(req.params.id);
  const { rows: workRows } = await pool.query('SELECT faculty_id FROM faculty_work WHERE id = $1', [id]);
  if (!workRows[0] || (req.user.role !== 'admin' && workRows[0].faculty_id !== req.user.id)) {
    throw httpError(404, 'Activity not found.');
  }
  const [revisions, reviews] = await Promise.all([
    pool.query(
      `SELECT r.*, u.name AS saved_by_name FROM faculty_work_revisions r
       JOIN users u ON u.id = r.saved_by WHERE r.work_id = $1 ORDER BY r.saved_at DESC`, [id]),
    pool.query(
      `SELECT r.*, u.name AS admin_name FROM work_reviews r
       JOIN users u ON u.id = r.admin_id WHERE r.work_id = $1 ORDER BY r.created_at DESC`, [id]),
  ]);
  res.json({ revisions: revisions.rows, reviews: reviews.rows });
}));

export default router;