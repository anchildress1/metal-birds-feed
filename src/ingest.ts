import { ingest } from './manual-drop.js';
import { requireEnv } from './env.js';

// CLI-only shell behind `make ingest`; validation lives in ingest().
await ingest(
  requireEnv('INGEST_SOURCE'),
  requireEnv('INGEST_FILE'),
  process.env['DRY_RUN'] === 'true'
);
