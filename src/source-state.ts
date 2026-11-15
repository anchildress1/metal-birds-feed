import { reportSourceState } from './state-report.js';

// CLI-only shell for `make state`. Validation lives in reportSourceState.
await reportSourceState(process.argv[2] ?? '');
