import { publishFeed, resolveAllSources } from './pipeline.js';

// CLI-only deployment shell: publication logic and failure handling stay in pipeline.ts, where
// the unit suite exercises them. This avoids downloading every upstream registry a second time.
await publishFeed(resolveAllSources(), false);
