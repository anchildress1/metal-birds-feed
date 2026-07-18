import { route, type EnrichmentRecord, type RunQuery } from '../src/worker/handler.js';

export interface Env {
  DB: D1Database;
  ENRICH_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const runQuery: RunQuery = async (sql, params) => {
      const { results } = await env.DB.prepare(sql)
        .bind(...params)
        .all<EnrichmentRecord>();
      return results;
    };

    let body: unknown;
    if (request.method === 'POST') {
      try {
        body = await request.json();
      } catch {
        body = undefined;
      }
    }

    const result = await route(
      request.method,
      new URL(request.url).pathname,
      request.headers.get('authorization'),
      env.ENRICH_TOKEN,
      body,
      runQuery
    );
    return Response.json(result.body, { status: result.status });
  },
};
