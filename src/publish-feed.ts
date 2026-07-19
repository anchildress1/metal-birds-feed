import { appendFileSync } from 'node:fs';
import { publishFeedForDeploy, resolveAllSources } from './pipeline.js';

// CLI-only deployment shell: publication, fail-closed handling, and the change decision stay in
// pipeline.ts where the unit suite exercises them. Emits `changed`/`hash` to $GITHUB_OUTPUT so the
// workflow deploys only on an actual feed update; falls back to stdout for local runs.
const { changed, hash } = await publishFeedForDeploy(resolveAllSources());
const line = `changed=${changed}\nhash=${hash ?? ''}\n`;
const githubOutput = process.env['GITHUB_OUTPUT'];
if (githubOutput) appendFileSync(githubOutput, line);
else process.stdout.write(line);
