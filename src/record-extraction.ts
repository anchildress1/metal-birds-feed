import { recordExtraction } from './pdf/record.js';

// CLI-only shell for `make record-extraction`. Validation lives in recordExtraction.
await recordExtraction(process.argv[2] ?? '');
