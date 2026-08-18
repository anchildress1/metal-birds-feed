# Cloud Run image for the feed service. Bun runtime — bun:sqlite is built in and the service graph
# has no external dependencies, so there is no install step. The consolidated feed DB is baked in;
# data refreshes by rebuilding + redeploying (registry cadence is monthly).
FROM oven/bun:1.3.14-slim

WORKDIR /app

COPY src/service ./src/service
COPY src/feed-row.ts ./src/feed-row.ts
COPY src/registration.ts ./src/registration.ts
COPY feed.sqlite ./feed.sqlite

ENV PORT=8080 MBF_FEED_DB_PATH=/app/feed.sqlite
EXPOSE 8080

# FEED_TOKEN (a UUID) gates every request — set it as a Cloud Run secret/env var.
USER bun
CMD ["bun", "run", "src/service/server.ts"]
