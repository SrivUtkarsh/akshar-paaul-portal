import 'dotenv/config';
import app from './app.js';
import { pool } from './db.js';

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () => {
  console.log(`Akshar Paaul API is running at http://localhost:${port}`);
});

// Close open connections cleanly when stopped during local development.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  });
}
