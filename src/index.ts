/**
 * Code Guardian — entry point.
 * High-performance backend wrapping Trivy with stream-based processing.
 */

import express from 'express';
import scanRouter from './routers/scanRouter';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());
app.use(scanRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Code Guardian listening on http://localhost:${PORT}`);
});
