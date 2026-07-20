import { markFeedDeployed } from './pipeline.js';

// CLI-only shell run after a successful Cloud Run deploy: records the deployed feed hash so the next
// scheduled run can skip a redundant redeploy. Validation lives in markFeedDeployed.
await markFeedDeployed(process.argv[2]);
