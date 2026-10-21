import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import workRoutes from './routes/work.js';
import bookRoutes from './routes/books.js';
import submissionRoutes from './routes/submissions.js';
import userRoutes from './routes/users.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin(origin, callback) {
    // No Origin header is common for command-line tools and server-to-server health checks.
    const allowed = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
      .split(',').map((value) => value.trim());
    if (!origin || allowed.includes('*') || allowed.includes(origin)) return callback(null, true);
    return callback(new Error('This website is not allowed to access the API.'));
  },
  credentials: false,
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'akshar-paaul-api' }));
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', authRoutes);
app.use('/api/work', workRoutes);
app.use('/api/books', bookRoutes);
// AI evaluations make an external API call, so limit repeated attempts per IP.
app.use(['/api/submissions/:id/evaluate', '/api/submissions/:id/transcribe', '/api/submissions/:id/grade'], rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many AI review attempts. Please wait 15 minutes before trying again.' },
}));
app.use('/api/submissions', submissionRoutes);
app.use('/api/users', userRoutes);

app.use((_req, res) => res.status(404).json({ message: 'That page or API endpoint was not found.' }));

// A single error handler keeps API errors readable and prevents stack traces
// or database details from being returned to users.
app.use((error, _req, res, _next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ message: 'Please upload an image smaller than 4 MB.' });
  }
  if (error.message === 'Only JPG, PNG, and WEBP images are accepted.') {
    return res.status(400).json({ message: error.message });
  }
  if (error.message === 'This website is not allowed to access the API.') {
    return res.status(403).json({ message: error.message });
  }
  const status = Number(error.status) || 500;
  if (status >= 500) console.error('API error:', error.message);
  return res.status(status).json({ message: status >= 500 ? 'Something went wrong. Please try again.' : error.message });
});

export default app;