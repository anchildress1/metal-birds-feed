import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(import.meta.dir, '..');
const paths = {
  manual: 'docs/getting-started.md',
  assistant: 'docs/getting-started-with-ai.md',
  skill: '.agents/skills/setup-metal-birds-feed/SKILL.md',
  readme: 'README.md',
} as const;

type Surface = keyof typeof paths;

const readSurface = async (surface: Surface): Promise<string> =>
  readFile(join(root, paths[surface]), 'utf8');

describe('onboarding contract', () => {
  it('keeps the local server and proof request in one shell', async () => {
    const [manual, skill] = await Promise.all([readSurface('manual'), readSurface('skill')]);

    for (const text of [manual, skill]) {
      const serve = text.indexOf('bun run src/service/server.ts &');
      const token = text.indexOf('FEED_TOKEN=$(openssl rand -hex 16)');
      const tokenLength = text.indexOf('test "${#FEED_TOKEN}" -ge 16', token);
      const exportToken = text.indexOf('export FEED_TOKEN', tokenLength);
      const capturePid = text.indexOf('SERVER_PID=$!');
      const readiness = text.indexOf('test "$READY" = true');
      const request = text.indexOf(
        'RESPONSE=$(curl --fail-with-body -sS http://localhost:8080/feed/registration'
      );
      const semanticCheck = text.indexOf('Object.hasOwn(body, mark)');
      const stop = text.lastIndexOf('kill "$SERVER_PID"');
      const commandText = text.replace(/\\\n\s*/g, ' ').replace(/\s+/g, ' ');

      expect(serve).toBeGreaterThan(-1);
      expect(tokenLength).toBeGreaterThan(token);
      expect(exportToken).toBeGreaterThan(tokenLength);
      expect(serve).toBeGreaterThan(exportToken);
      expect(capturePid).toBeGreaterThan(serve);
      expect(readiness).toBeGreaterThan(capturePid);
      expect(request).toBeGreaterThan(readiness);
      expect(semanticCheck).toBeGreaterThan(request);
      expect(stop).toBeGreaterThan(semanticCheck);
      expect(text).toContain('trap \'kill "$SERVER_PID" 2>/dev/null || true\' EXIT');
      expect(text).toContain('for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20');
      expect(commandText).toContain(
        'Object.hasOwn(body, mark) || typeof body[mark] !== "object" || body[mark] === null'
      );
      expect(text).not.toContain('kill %1');
    }
    expect(manual).not.toContain('Stop the server with `Ctrl+C`');
  });

  it.each<Surface>(['manual', 'assistant', 'skill'])(
    'uses runtime data instead of invented aircraft identifiers on %s',
    async (surface) => {
      const text = await readSurface(surface);

      expect(text).not.toMatch(/"hexes"\s*:\s*\[\s*"[0-9a-f]{6}"/i);
      expect(text).not.toMatch(/"registrations"\s*:\s*\[\s*"(?![<$])[^"\\]+"/i);
    }
  );

  // Both absolutes are wrong and this wording has swung between them twice. The pipeline writes a
  // handful of objects per source (one PutObjectCommand site, `src/writer.ts`) plus ~1 cache object
  // per 200 strings (`MAX_BATCH_ITEMS`), which alone sits inside R2's free allowance — so "you will
  // be charged" overpromises. But the allowance is account-wide and this operator has seen a real
  // sub-$6 bill, so "it fits the free tier" underwarns. The honest frame is conditional, and that
  // is what these assertions pin.
  it.each<Surface>(['manual', 'assistant', 'skill', 'readme'])(
    'frames the R2 charge as account-conditional on %s',
    async (surface) => {
      const text = await readSurface(surface);

      expect(text).toMatch(/account-wide|shared/i);
      expect(text).not.toMatch(/expected to fit the standard free tier/i);
      expect(text).not.toMatch(
        /triggers a \*\*?one-time R2 charge|carries a one-time|will be billed/i
      );
    }
  );

  // `/feed/registration` only accepts keys matching /^[A-Z0-9]{2,10}$/ (`src/service/handler.ts`).
  // The feed table permits any nonblank registration, so an unbounded pick can select a row the
  // endpoint is guaranteed to reject — turning the proof request into a false negative.
  it.each<Surface>(['manual', 'skill'])(
    'restricts the proof lookup to keys the endpoint accepts on %s',
    async (surface) => {
      const text = await readSurface(surface);

      expect(text).toContain('length(registration_key) BETWEEN 2 AND 10');
    }
  );

  // Phase 6 and Phase 7 both call `openssl rand`. Without it in preflight every check passes and
  // the failure lands after the user may already have run a full refresh.
  it('checks for openssl before anything depends on it', async () => {
    const skill = await readSurface('skill');

    expect(skill).toContain('openssl version');
    expect(skill.indexOf('openssl version')).toBeLessThan(
      skill.indexOf('FEED_TOKEN=$(openssl rand -hex 16)')
    );
  });

  it.each<Surface>(['manual', 'assistant', 'skill'])(
    'defines completeness from configured sources on %s',
    async (surface) => {
      const text = await readSurface(surface);

      expect(text).toMatch(
        /every (registry still configured|source still configured|configured source)/i
      );
      expect(text).not.toMatch(/needs all 15|requires[^\n]*all 15/i);
    }
  );

  it.each<Surface>(['manual', 'assistant', 'skill'])(
    'derives translation requirements from source configuration on %s',
    async (surface) => {
      const text = await readSurface(surface);

      expect(text).not.toMatch(/ten of the fifteen|other five|5 of 15/i);
      expect(text).not.toMatch(/es-aesa[^\n]*needs a Gemini key/i);
    }
  );

  it.each<Surface>(['manual', 'skill'])(
    'provisions every first-deploy dependency on %s',
    async (surface) => {
      const text = await readSurface(surface);
      const commandText = text.replace(/\\\n\s*/g, ' ').replace(/\s+/g, ' ');

      for (const command of [
        'gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com iam.googleapis.com --project="$GCP_PROJECT_ID"',
        'PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format=\'value(projectNumber)\')',
        'gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role="roles/run.builder"',
        'gcloud iam service-accounts create metal-birds-feed-run --display-name="metal-birds-feed runtime" --project="$GCP_PROJECT_ID"',
        'FEED_TOKEN=$(openssl rand -hex 16) && test "${#FEED_TOKEN}" -ge 16 && printf \'%s\' "$FEED_TOKEN" | gcloud secrets create feed-token --data-file=- --project="$GCP_PROJECT_ID"',
        'gcloud secrets add-iam-policy-binding feed-token --member="serviceAccount:metal-birds-feed-run@${GCP_PROJECT_ID}.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor" --project="$GCP_PROJECT_ID"',
        'make deploy',
      ]) {
        expect(commandText).toContain(command);
      }
    }
  );
});
