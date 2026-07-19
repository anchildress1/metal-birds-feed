import { Database } from 'bun:sqlite';
import { createRateLimiter, makeRunQuery, serveRequest } from './serve-core.js';

// Cloud Run entrypoint (`bun run src/service/server.ts`). Opens the consolidated feed DB baked into
// the image (or MBF_FEED_DB_PATH locally) read-only and serves point lookups from it. Data is
// near-static, refreshed by a redeploy. No test imports this — it is the runtime shell, like the
// pipeline's CLI bootstrap.

const dbPath = process.env['MBF_FEED_DB_PATH']?.trim() ?? 'feed.sqlite';
const port = Number(process.env['PORT'] ?? 8080);
const token = process.env['FEED_TOKEN'];

const runQuery = makeRunQuery(new Database(dbPath, { readonly: true }));
const checkLimit = createRateLimiter(
  Number(process.env['FEED_RATE_LIMIT'] ?? 120),
  Number(process.env['FEED_RATE_WINDOW_MS'] ?? 60_000),
  Date.now
);

Bun.serve({ port, fetch: (request) => serveRequest(request, token, checkLimit, runQuery) });
console.log(`feed service listening on :${port}`);
