import { createFetch, type Env } from '../src/worker/serve.js';

// Thin Cloudflare-runtime shell. All orchestration lives in serve.ts (structural binding types,
// unit-tested); the runtime binds the real D1Database and RateLimit bindings, which satisfy Env.
export default {
  fetch: (request: Request, env: Env): Promise<Response> => createFetch(request, env),
};
