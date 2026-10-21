import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { asyncRoute, httpError } from '../utils.js';

const router = Router();
router.use(requireAuth);

router.get('/', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, u.name AS creator_name,
       (SELECT COUNT(*)::int FROM submissions s WHERE s.book_id = b.id) AS submission_count,
       (SELECT jsonb_build_object('id', gs.id, 'name', gs.name, 'version', gs.version,
          'total_marks', gs.total_marks, 'criteria', gs.criteria)
        FROM grading_standards gs WHERE gs.book_id = b.id ORDER BY gs.version DESC LIMIT 1) AS latest_standard
     FROM books b JOIN users u ON u.id = b.created_by ORDER BY b.updated_at DESC`,
  );
  res.json({ books: rows });
}));

router.post('/', requireRole('admin', 'faculty'), asyncRoute(async (req, res) => {
  const title = String(req.body.title || '').trim();
  const author = String(req.body.author || '').trim();
  const description = String(req.body.description || '').trim();
  if (!title) throw httpError(400, 'Enter the book title.');
  if (title.length > 220 || author.length > 180) throw httpError(400, 'The title or author is too long.');
  const { rows } = await pool.query(
    `INSERT INTO books (title, author, description, created_by)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [title, author, description, req.user.id],
  );
  res.status(201).json({ book: rows[0] });
}));

router.get('/:id', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.*, u.name AS creator_name,
       (SELECT jsonb_build_object('id', gs.id, 'name', gs.name, 'description', gs.description,
          'version', gs.version, 'total_marks', gs.total_marks, 'criteria', gs.criteria, 'created_at', gs.created_at)
        FROM grading_standards gs WHERE gs.book_id = b.id ORDER BY gs.version DESC LIMIT 1) AS latest_standard
     FROM books b JOIN users u ON u.id = b.created_by WHERE b.id = $1`,
    [req.params.id],
  );
  if (!rows[0]) throw httpError(404, 'Book not found.');
  res.json({ book: rows[0] });
}));

router.post('/:id/standards', requireRole('admin', 'faculty'), asyncRoute(async (req, res) => {
  const bookId = Number(req.params.id);
  const bookResult = await pool.query('SELECT id, created_by FROM books WHERE id = $1', [bookId]);
  const book = bookResult.rows[0];
  if (!book) throw httpError(404, 'Book not found.');
  // Any authenticated educator may define a standard for a selected book.
  // Each save creates a new version, so earlier submissions keep their own snapshot.

  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  const criteria = Array.isArray(req.body.criteria) ? req.body.criteria : [];
  if (!name || criteria.length < 1 || criteria.length > 20) {
    throw httpError(400, 'Add a standard name and between 1 and 20 criteria.');
  }
  const normalizedCriteria = criteria.map((item, index) => {
    const criterionName = String(item.name || '').trim();
    const criterionDescription = String(item.description || '').trim();
    const maxMarks = Number(item.maxMarks);
    if (!criterionName || !Number.isFinite(maxMarks) || maxMarks <= 0 || maxMarks > 1000) {
      throw httpError(400, `Criterion ${index + 1} needs a name and a positive maximum mark.`);
    }
    return { name: criterionName, description: criterionDescription, maxMarks: Math.round(maxMarks * 100) / 100 };
  });
  const totalMarks = normalizedCriteria.reduce((sum, item) => sum + item.maxMarks, 0);

  // Serialize version assignment by locking the book row to avoid duplicate versions.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM books WHERE id = $1 FOR UPDATE', [bookId]);
    const { rows: versionRows } = await client.query(
      'SELECT COALESCE(MAX(version), 0)::int + 1 AS next_version FROM grading_standards WHERE book_id = $1', [bookId]);
    const version = versionRows[0].next_version;
    const { rows } = await client.query(
      `INSERT INTO grading_standards (book_id, name, description, version, total_marks, criteria, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7) RETURNING *`,
      [bookId, name, description, version, totalMarks, JSON.stringify(normalizedCriteria), req.user.id],
    );
    await client.query('UPDATE books SET updated_at = NOW() WHERE id = $1', [bookId]);
    await client.query('COMMIT');
    res.status(201).json({ standard: rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

export default router;
