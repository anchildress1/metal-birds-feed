import { recordExtraction } from './pdf/record.js';

// CLI-only shell for `make record-extraction`. Validation lives in recordExtraction.
for (const path of await recordExtraction(process.argv[2] ?? '')) console.log(path);
