import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { evaluateHandwriting } from '../services/groq.js';
import { asyncRoute, httpError } from '../utils.js';

const router = Router();
router.use(requireAuth);

function requireNumericId(value) {
  if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw httpError(400, 'Invalid ID.');
  }
  return Number(value);
}

// Images are stored in PostgreSQL as BYTEA, not on the server's local disk.
// That makes uploads compatible with short-lived Vercel functions and avoids
// leaving student photos in an unprotected public uploads folder.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Only JPG, PNG, and WEBP images are accepted.'));
    }
    callback(null, true);
  },
});

router.get('/', asyncRoute(async (req, res) => {
  const values = [];
  const conditions = [];
  if (req.query.bookId) {
    const bookId = Number(req.query.bookId);
    if (!Number.isInteger(bookId) || bookId < 1) throw httpError(400, 'Invalid book filter.');
    values.push(bookId);
    conditions.push(`s.book_id = $${values.length}`);
  }
  if (['uploaded', 'ai_reviewed', 'reviewed'].includes(String(req.query.status || ''))) {
    values.push(String(req.query.status));
    conditions.push(`s.status = $${values.length}`);
  }
  if (String(req.query.student || '').trim()) {
    values.push(`%${String(req.query.student).trim().slice(0, 160)}%`);
    conditions.push(`s.student_name ILIKE $${values.length}`);
  }
  if (req.query.facultyId) {
    const facultyId = Number(req.query.facultyId);
    if (!Number.isInteger(facultyId) || facultyId < 1) throw httpError(400, 'Invalid faculty filter.');
    values.push(facultyId);
    conditions.push(`s.submitted_by = $${values.length}`);
  }
  for (const field of ['from', 'to']) {
    if (req.query[field]) {
      const date = String(req.query[field]);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
        throw httpError(400, `Invalid ${field} date filter.`);
      }
      values.push(date);
      conditions.push(field === 'from'
        ? `s.created_at >= $${values.length}::date`
        : `s.created_at < ($${values.length}::date + INTERVAL '1 day')`);
    }
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT s.id, s.book_id, s.student_name, s.student_class, s.student_section,
       s.extracted_text, s.detected_language, s.ai_score, s.ai_feedback,
       s.final_score, s.final_feedback, s.status, s.created_at, s.reviewed_at,
       b.title AS book_title, u.name AS submitted_by_name
     FROM submissions s JOIN books b ON b.id = s.book_id
     JOIN users u ON u.id = s.submitted_by
     ${where} ORDER BY s.created_at DESC LIMIT 300`, values,
  );
  res.json({ submissions: rows });
}));

router.post('/for-book/:bookId', upload.single('image'), asyncRoute(async (req, res) => {
  const bookId = requireNumericId(req.params.bookId);
  const studentName = String(req.body.studentName || '').trim();
  const studentClass = String(req.body.studentClass || '').trim();
  const studentSection = String(req.body.studentSection || '').trim();
  if (!req.file) throw httpError(400, 'Choose a photo of the handwritten summary.');
  if (!studentName) throw httpError(400, 'Enter the student name.');
  if (studentName.length > 160) throw httpError(400, 'The student name is too long.');

  const { rows: standardRows } = await pool.query(
    `SELECT gs.* FROM grading_standards gs
     WHERE gs.book_id = $1 ORDER BY gs.version DESC LIMIT 1`, [bookId]);
  const standard = standardRows[0];
  if (!standard) throw httpError(409, 'This book does not have a grading standard yet. Add a standard before uploading student work.');

  // Freeze the standard used by this submission; later rubric changes won't
  // alter how this historic submission is interpreted.
  const standardSnapshot = {
    id: standard.id,
    name: standard.name,
    description: standard.description,
    version: standard.version,
    totalMarks: Number(standard.total_marks),
    criteria: standard.criteria,
  };
  const { rows } = await pool.query(
    `INSERT INTO submissions (
       book_id, standard_id, standard_snapshot, student_name, student_class, student_section,
       image_bytes, image_mime, image_filename, submitted_by
     ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, book_id, student_name, student_class, student_section, status, created_at`,
    [bookId, standard.id, JSON.stringify(standardSnapshot), studentName, studentClass,
      studentSection, req.file.buffer, req.file.mimetype, req.file.originalname.slice(0, 255), req.user.id],
  );
  res.status(201).json({ submission: rows[0], message: 'Photo saved. Run AI review when you are ready.' });
}));

router.get('/:id/image', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT image_bytes, image_mime, image_filename FROM submissions WHERE id = $1', [requireNumericId(req.params.id)]);
  if (!rows[0]) throw httpError(404, 'Submission not found.');
  // No public cache: student pages are private school records.
  res.set({
    'Content-Type': rows[0].image_mime,
    'Content-Disposition': `inline; filename="${rows[0].image_filename.replace(/["\\\r\n]/g, '_')}"`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(rows[0].image_bytes);
}));

router.get('/:id', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.id, s.book_id, s.standard_id, s.standard_snapshot, s.student_name,
       s.student_class, s.student_section, s.extracted_text, s.detected_language,
       s.ai_score, s.ai_feedback, s.ai_criteria, s.final_score, s.final_feedback,
       s.final_criteria, s.status, s.created_at, s.updated_at, s.reviewed_at,
       b.title AS book_title, b.author AS book_author, u.name AS submitted_by_name,
       reviewer.name AS reviewed_by_name
     FROM submissions s JOIN books b ON b.id = s.book_id
     JOIN users u ON u.id = s.submitted_by
     LEFT JOIN users reviewer ON reviewer.id = s.reviewed_by
     WHERE s.id = $1`, [requireNumericId(req.params.id)]);
  if (!rows[0]) throw httpError(404, 'Submission not found.');
  res.json({ submission: rows[0] });
}));

router.post('/:id/evaluate', asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, student_name, image_bytes, image_mime, standard_snapshot, status
     FROM submissions WHERE id = $1`, [requireNumericId(req.params.id)]);
  const submission = rows[0];
  if (!submission) throw httpError(404, 'Submission not found.');
  if (submission.status === 'reviewed' && req.body.force !== true) {
    throw httpError(409, 'This submission has a final teacher decision. Reopen it before running AI again.');
  }

  const assessment = await evaluateHandwriting({
    imageBytes: submission.image_bytes,
    mimeType: submission.image_mime,
    rubric: submission.standard_snapshot,
    studentName: submission.student_name,
  });
  const { rows: updatedRows } = await pool.query(
    `UPDATE submissions SET extracted_text = $1, detected_language = $2, ai_score = $3,
       ai_feedback = $4, ai_criteria = $5::jsonb, status = 'ai_reviewed',
       updated_at = NOW() WHERE id = $6
     RETURNING id, extracted_text, detected_language, ai_score, ai_feedback, ai_criteria, status`,
    [assessment.extractedText, assessment.detectedLanguage, assessment.totalScore,
      `${assessment.overallFeedback}${assessment.uncertaintyNotes ? `\n\nReading notes: ${assessment.uncertaintyNotes}` : ''}`,
      JSON.stringify(assessment.criteria), submission.id],
  );
  res.json({ submission: updatedRows[0], model: assessment.model, message: 'AI suggestions are ready. Please verify the text and marks before saving a final decision.' });
}));

router.patch('/:id/final', asyncRoute(async (req, res) => {
  const extractedText = String(req.body.extractedText || '').trim();
  const finalFeedback = String(req.body.finalFeedback || '').trim();
  const finalCriteria = Array.isArray(req.body.finalCriteria) ? req.body.finalCriteria : [];
  const finalScoreRaw = Number(req.body.finalScore);
  const { rows: existingRows } = await pool.query(
    'SELECT id, standard_snapshot, status FROM submissions WHERE id = $1', [requireNumericId(req.params.id)]);
  const existing = existingRows[0];
  if (!existing) throw httpError(404, 'Submission not found.');

  const totalMarks = Number(existing.standard_snapshot.totalMarks ?? existing.standard_snapshot.total_marks);
  if (!Number.isFinite(finalScoreRaw) || finalScoreRaw < 0 || finalScoreRaw > totalMarks) {
    throw httpError(400, `Final marks must be between 0 and ${totalMarks}.`);
  }
  if (!extractedText) throw httpError(400, 'Review the extracted text or enter a verified transcription before saving.');
  if (extractedText.length > 30000 || finalFeedback.length > 5000) {
    throw httpError(400, 'The transcription or feedback is too long.');
  }
  // When criterion-level scores are supplied, enforce the teacher rubric's max marks.
  const rubricCriteria = Array.isArray(existing.standard_snapshot.criteria) ? existing.standard_snapshot.criteria : [];
  const normalized = rubricCriteria.map((criterion, index) => {
    const item = finalCriteria[index] || {};
    const maxMarks = Number(criterion.maxMarks ?? criterion.max_marks ?? 0);
    const marks = Number(item.marks);
    if (!Number.isFinite(marks) || marks < 0 || marks > maxMarks) {
      throw httpError(400, `Marks for "${criterion.name}" must be between 0 and ${maxMarks}.`);
    }
    return {
      name: criterion.name,
      maxMarks,
      marks: Math.round(marks * 100) / 100,
      evidence: String(item.evidence || '').slice(0, 1200),
      feedback: String(item.feedback || '').slice(0, 1200),
    };
  });

  const criteriaTotal = Math.round(normalized.reduce((sum, item) => sum + item.marks, 0) * 100) / 100;
  if (Math.abs(criteriaTotal - finalScoreRaw) > 0.01) {
    throw httpError(400, `Final marks (${finalScoreRaw}) must equal the total of criterion marks (${criteriaTotal}).`);
  }

  const { rows } = await pool.query(
    `UPDATE submissions SET extracted_text = $1, final_score = $2, final_feedback = $3,
       final_criteria = $4::jsonb, status = 'reviewed', reviewed_by = $5,
       reviewed_at = NOW(), updated_at = NOW()
     WHERE id = $6
     RETURNING id, extracted_text, final_score, final_feedback, final_criteria, status, reviewed_at`,
    [extractedText, finalScoreRaw, finalFeedback, JSON.stringify(normalized), req.user.id, existing.id],
  );
  res.json({ submission: rows[0], message: 'Final assessment saved.' });
}));

export default router;