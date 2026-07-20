import { Database } from 'bun:sqlite';
import { loadServiceConfig } from './config.js';
import { createRateLimiter, makeRunQuery, serveRequest } from './serve-core.js';

// Cloud Run entrypoint (`bun run src/service/server.ts`). Opens the consolidated feed DB baked into
// the image (or MBF_FEED_DB_PATH locally) read-only and serves point lookups from it. Data is
// near-static, refreshed by a redeploy. No test imports this — it is the runtime shell, like the
// pipeline's CLI bootstrap.

const config = loadServiceConfig();

const runQuery = makeRunQuery(new Database(config.dbPath, { readonly: true }));
const checkLimit = createRateLimiter(config.rateLimit, config.rateWindowMs, Date.now);

Bun.serve({
  port: config.port,
  fetch: (request) => serveRequest(request, config.token, checkLimit, runQuery),
});
console.log(`feed service listening on :${config.port}`);
