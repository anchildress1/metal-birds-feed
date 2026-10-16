import { backfillHistory } from './backfill.js';
import { requireEnv } from './env.js';

// CLI-only shell behind `make backfill-history`; the replay lives in backfillHistory().
await backfillHistory(requireEnv('BACKFILL_SOURCE'), process.env['DRY_RUN'] === 'true');
