import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { lstat, mkdtemp, readlink, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
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

const deployBlockFrom = (text: string): string => {
  const services = text.indexOf('gcloud services enable run.googleapis.com');
  const blockStart = text.lastIndexOf('\n(\n', services);
  const deploy = text.indexOf('make deploy', services);
  const blockEnd = text.indexOf('\n)\n', deploy);

  if (services < 0 || blockStart < 0 || deploy < 0 || blockEnd < 0)
    throw new Error('complete fail-closed deploy block not found');

  return text.slice(blockStart + 1, blockEnd + 2);
};

const recoveryBlockFrom = (text: string): string => {
  const heading = text.indexOf('Recover an interrupted first deploy');
  const blockStart = text.indexOf('\n```bash\n', heading);
  const blockEnd = text.indexOf('\n```', blockStart + 8);

  if (heading < 0 || blockStart < 0 || blockEnd < 0)
    throw new Error('complete first-deploy recovery block not found');

  return text.slice(blockStart + 8, blockEnd);
};

const runDeployBlock = async (
  block: string,
  failAt: string,
  opensslOutput = '0123456789abcdef0123456789abcdef'
): Promise<{ log: string; status: number | null }> => {
  const sandbox = await mkdtemp(join(tmpdir(), 'metal-birds-onboarding-'));
  const logPath = join(sandbox, 'commands.log');
  const fakeCommand = `#!/bin/sh
set -eu
command_name=\${0##*/}
stage="$command_name \${1-} \${2-}"
printf '%s\\n' "$stage" >> "$COMMAND_LOG"
if [ "$stage" = "$FAIL_AT" ]; then exit 42; fi
if [ "$stage" = "gcloud projects describe" ]; then printf '123456\\n'; fi
if [ "$stage" = "openssl rand -hex" ]; then printf '%s\\n' "$OPENSSL_OUTPUT"; fi
`;

  try {
    for (const command of ['gcloud', 'openssl', 'make']) {
      const path = join(sandbox, command);
      await writeFile(path, fakeCommand, { mode: 0o755 });
    }

    const result = spawnSync('bash', ['-c', block], {
      encoding: 'utf8',
      env: {
        ...process.env,
        COMMAND_LOG: logPath,
        FAIL_AT: failAt,
        OPENSSL_OUTPUT: opensslOutput,
        PATH: `${sandbox}:${process.env.PATH ?? ''}`,
      },
    });

    return { log: await readFile(logPath, 'utf8'), status: result.status };
  } finally {
    await rm(sandbox, { force: true, recursive: true });
  }
};

describe('onboarding contract', () => {
  // Claude Code scans only .claude/skills; Codex scans .agents/skills. One tracked symlink lets
  // both reach the single real copy. If it is ever committed as a regular file there are silently
  // two skills to keep in sync, which is exactly the drift this suite exists to prevent.
  it('ships .claude/skills as a symlink to the real .agents copy', async () => {
    const link = join(root, '.claude/skills/setup-metal-birds-feed');

    expect((await lstat(link)).isSymbolicLink()).toBe(true);
    expect(await readlink(link)).toBe('../../.agents/skills/setup-metal-birds-feed');
    await expect(readFile(join(link, 'SKILL.md'), 'utf8')).resolves.toContain(
      'name: setup-metal-birds-feed'
    );
  });

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

  // The invoice is the supported fact: the operator's first data load incurred about $6.50. Object
  // counts do not establish which R2 billing dimension caused it, so the docs preserve the observed
  // amount without turning it into either a guaranteed quote or a speculative causal story.
  it.each<Surface>(['manual', 'assistant', 'skill', 'readme'])(
    'records the observed first-load R2 charge without inventing its cause on %s',
    async (surface) => {
      const text = await readSurface(surface);
      const compactText = text.replace(/\s+/g, ' ');

      expect(compactText).toMatch(/first data load[^.]*\*{0,2}\$6\.50/i);
      expect(compactText).toMatch(/observed bill/i);
      expect(compactText).toMatch(/not a guaranteed quote/i);
      expect(compactText).toMatch(/not a .*claim about which billing dimension caused/i);
    }
  );

  it('documents current Codex plan access', async () => {
    const assistant = await readSurface('assistant');

    expect(assistant).toContain('including Free and Go');
    expect(assistant).toContain('usage limits vary by plan');
    expect(assistant).not.toContain('Requires a paid ChatGPT plan');
  });

  it('uses Codex repository-local skill discovery without global setup', async () => {
    const assistant = await readSurface('assistant');

    expect(assistant).toContain('Codex scans repository-local `.agents/skills`');
    expect(assistant).toContain('Start it from the repository you just cloned');
    expect(assistant).toContain('Codex discovers the checked-in skill automatically');
    expect(assistant).not.toContain('~/.agents/skills');
  });

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
    'provisions every first-deploy dependency in one fail-closed shell on %s',
    async (surface) => {
      const text = await readSurface(surface);
      const deployBlock = deployBlockFrom(text);
      const commandText = deployBlock.replace(/\\\n\s*/g, ' ').replace(/\s+/g, ' ');
      const commands = [
        'gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com iam.googleapis.com --project="$GCP_PROJECT_ID"',
        'PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT_ID" --format=\'value(projectNumber)\')',
        'gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" --role="roles/run.builder"',
        'gcloud iam service-accounts create metal-birds-feed-run --display-name="metal-birds-feed runtime" --project="$GCP_PROJECT_ID"',
        'FEED_TOKEN=$(openssl rand -hex 16)',
        'test "${#FEED_TOKEN}" -ge 16',
        'printf \'%s\' "$FEED_TOKEN" | gcloud secrets create feed-token --data-file=- --project="$GCP_PROJECT_ID"',
        'gcloud secrets add-iam-policy-binding feed-token --member="serviceAccount:metal-birds-feed-run@${GCP_PROJECT_ID}.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor" --project="$GCP_PROJECT_ID"',
        'make deploy',
      ];

      expect(deployBlock.indexOf('set -eu')).toBeGreaterThan(-1);
      expect(deployBlock.indexOf('set -eu')).toBeLessThan(
        deployBlock.indexOf('gcloud services enable')
      );

      let prior = -1;
      for (const command of commands) {
        const index = commandText.indexOf(command);
        expect(index).toBeGreaterThan(prior);
        prior = index;
      }

      expect(text).toContain('do not rerun the whole block');
    }
  );

  it.each<Surface>(['manual', 'skill'])(
    'keeps interrupted first-deploy recovery scoped and fail-closed on %s',
    async (surface) => {
      const text = await readSurface(surface);
      const recoveryBlock = recoveryBlockFrom(text);
      const commandText = recoveryBlock.replace(/\\\n\s*/g, ' ').replace(/\s+/g, ' ');

      expect(recoveryBlock).toContain('set -eu');
      expect(recoveryBlock).toContain('export GCP_PROJECT_ID=the-confirmed-project-id');
      expect(commandText).toContain(
        'gcloud iam service-accounts list --filter="email=$SERVICE_ACCOUNT"'
      );
      expect(commandText).toContain('gcloud iam service-accounts create');
      expect(commandText).toContain("gcloud secrets list --filter='name=feed-token'");
      expect(commandText).toContain(
        "gcloud secrets versions list feed-token --filter='state=ENABLED'"
      );
      expect(commandText).toContain('gcloud secrets versions add feed-token --data-file=-');
      expect(commandText).toContain('gcloud secrets add-iam-policy-binding feed-token');
      expect(commandText.trim().endsWith('make deploy )')).toBe(true);

      const retrieval = text.indexOf('FEED_TOKEN=$(gcloud secrets versions access latest');
      const validation = text.indexOf('test "${#FEED_TOKEN}" -ge 16', retrieval);
      const exportToken = text.indexOf('export FEED_TOKEN', validation);
      const unsetToken = text.indexOf('unset FEED_TOKEN', exportToken);

      expect(
        text.lastIndexOf('export GCP_PROJECT_ID=the-confirmed-project-id', retrieval)
      ).toBeGreaterThan(-1);
      expect(validation).toBeGreaterThan(retrieval);
      expect(exportToken).toBeGreaterThan(validation);
      expect(unsetToken).toBeGreaterThan(exportToken);
      expect(text.slice(retrieval, unsetToken)).not.toContain('set -eu');

      const success = await runDeployBlock(recoveryBlock, 'never');
      expect(success.status).toBe(0);
      expect(success.log.trim().endsWith('make deploy')).toBe(true);

      for (const failure of ['gcloud iam service-accounts', 'gcloud secrets list']) {
        const result = await runDeployBlock(recoveryBlock, failure);

        expect(result.status).toBe(42);
        expect(result.log).not.toContain('make deploy');
      }
    }
  );

  it.each<Surface>(['manual', 'skill'])(
    'never deploys after a provisioning failure on %s',
    async (surface) => {
      const block = deployBlockFrom(await readSurface(surface));
      const success = await runDeployBlock(block, 'never');

      expect(success.status).toBe(0);
      expect(success.log.trim().endsWith('make deploy')).toBe(true);

      for (const failure of [
        'gcloud services enable',
        'gcloud projects describe',
        'gcloud projects add-iam-policy-binding',
        'gcloud iam service-accounts',
        'openssl rand -hex',
        'gcloud secrets create',
        'gcloud secrets add-iam-policy-binding',
      ]) {
        const result = await runDeployBlock(block, failure);

        expect(result.status).toBe(42);
        expect(result.log).not.toContain('make deploy');
      }

      const shortToken = await runDeployBlock(block, 'never', 'short');

      expect(shortToken.status).not.toBe(0);
      expect(shortToken.log).toContain('openssl rand -hex');
      expect(shortToken.log).not.toContain('gcloud secrets create');
      expect(shortToken.log).not.toContain('make deploy');
    }
  );
});
