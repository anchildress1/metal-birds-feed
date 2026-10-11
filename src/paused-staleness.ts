import { evaluatePausedStaleness } from './pipeline.js';

// CLI-only shell: the evaluation lives in pipeline.ts where the unit suite exercises it.
await evaluatePausedStaleness();
