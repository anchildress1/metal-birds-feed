import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '..');
const REQUIRED_ENV = {
  MBF_R2_ACCOUNT_ID: 'account',
  MBF_R2_ACCESS_KEY_ID: 'access',
  MBF_R2_SECRET_ACCESS_KEY: 'secret',
  MBF_R2_BUCKET_NAME: 'bucket',
  GCP_PROJECT_ID: 'project',
};

let workspace = '';
let binDir = '';
let logPath = '';

const executable = async (name: string, source: string): Promise<string> => {
  const path = join(binDir, name);
  await writeFile(path, source);
  await chmod(path, 0o755);
  return path;
};

const runDeploy = (bun: string, bunx: string) =>
  Bun.spawnSync({
    cmd: [
      'make',
      '-f',
      'Makefile',
      'deploy',
      'ENV_FILE=missing.env',
      `BUN=${bun}`,
      `BUNX=${bunx}`,
      'SERVICE_NAME=test-service',
      'REGION=test-region',
    ],
    cwd: workspace,
    env: {
      ...process.env,
      ...REQUIRED_ENV,
      PATH: `${binDir}:${process.env['PATH'] ?? ''}`,
      TEST_LOG: logPath,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

describe('Makefile deploy contract', () => {
  beforeEach(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'metal-birds-feed-deploy-'));
    binDir = join(workspace, 'bin');
    logPath = join(workspace, 'commands.log');
    await mkdir(binDir);
    await copyFile(join(REPO_ROOT, 'Makefile'), join(workspace, 'Makefile'));
  });

  afterEach(async () => {
    if (workspace) await rm(workspace, { force: true, recursive: true });
  });

  // Logs "$1 $2 $3" to tell the Cloud Run deploy call apart from the Artifact Registry cleanup
  // call, then — for the cleanup call only — validates the exact flags and policy content the
  // recipe is supposed to send, so a regression that sends the wrong repo, project, location, or
  // a malformed policy fails this fake rather than silently reporting success.
  const fakeGcloud = () =>
    executable(
      'gcloud',
      `#!/bin/sh
echo "gcloud $1 $2 $3" >> "$TEST_LOG"
if [ "$1 $2 $3" = "artifacts repositories set-cleanup-policies" ]; then
  fail() { echo "gcloud cleanup validation failed: $1" >> "$TEST_LOG"; exit 1; }
  [ "$4" = "cloud-run-source-deploy" ] || fail "repo=$4"
  [ "$5" = "--project" ] && [ "$6" = "project" ] || fail "project flag"
  [ "$7" = "--location=test-region" ] || fail "location=$7"
  case "$8" in
    --policy=*) policy_file=$\{8#--policy=} ;;
    *) fail "policy flag" ;;
  esac
  [ -f "$policy_file" ] || fail "policy file missing"
  grep -q '"keepCount":5}' "$policy_file" || fail "keepCount"
  grep -q '"olderThan":"90d"' "$policy_file" || fail "olderThan"
  grep -q '"tagState":"any"' "$policy_file" || fail "tagState"
  [ "$9" = "--no-dry-run" ] || fail "no-dry-run flag"
fi
`
    );

  it('publishes a fresh database, deploys it, then prunes stale Artifact Registry images', async () => {
    const bunx = await executable('fake-bunx', '#!/bin/sh\nexit 0\n');
    const bun = await executable(
      'fake-bun',
      '#!/bin/sh\necho publish >> "$TEST_LOG"\nprintf fresh > feed.sqlite\n'
    );
    await fakeGcloud();

    const result = runDeploy(bun, bunx);

    expect(result.exitCode).toBe(0);
    expect(await readFile(logPath, 'utf8')).toBe(
      'publish\ngcloud run deploy test-service\ngcloud artifacts repositories set-cleanup-policies\n'
    );
    expect(await readFile(join(workspace, 'feed.sqlite'), 'utf8')).toBe('fresh');
  });

  it('still reports success when the Artifact Registry cleanup policy cannot be set', async () => {
    const bunx = await executable('fake-bunx', '#!/bin/sh\nexit 0\n');
    const bun = await executable(
      'fake-bun',
      '#!/bin/sh\necho publish >> "$TEST_LOG"\nprintf fresh > feed.sqlite\n'
    );
    await executable(
      'gcloud',
      '#!/bin/sh\necho "gcloud $1 $2 $3" >> "$TEST_LOG"\ncase "$1 $2" in\n  "artifacts repositories") exit 9 ;;\nesac\n'
    );

    const result = runDeploy(bun, bunx);

    expect(result.exitCode).toBe(0);
    expect(await readFile(logPath, 'utf8')).toBe(
      'publish\ngcloud run deploy test-service\ngcloud artifacts repositories set-cleanup-policies\n'
    );
    expect(result.stderr.toString('utf8')).toContain(
      'warning: could not set the Artifact Registry cleanup policy'
    );
  });

  it('does not deploy when publication fails', async () => {
    const bunx = await executable('fake-bunx', '#!/bin/sh\nexit 0\n');
    const bun = await executable('fake-bun', '#!/bin/sh\necho publish >> "$TEST_LOG"\nexit 42\n');
    await fakeGcloud();

    const result = runDeploy(bun, bunx);

    expect(result.exitCode).not.toBe(0);
    expect(await readFile(logPath, 'utf8')).toBe('publish\n');
  });

  it('removes a stale database before publication', async () => {
    const bunx = await executable('fake-bunx', '#!/bin/sh\nexit 0\n');
    const bun = await executable('fake-bun', '#!/bin/sh\necho publish >> "$TEST_LOG"\n');
    await fakeGcloud();
    await writeFile(join(workspace, 'feed.sqlite'), 'stale');

    const result = runDeploy(bun, bunx);

    expect(result.exitCode).not.toBe(0);
    expect(await readFile(logPath, 'utf8')).toBe('publish\n');
    expect(await Bun.file(join(workspace, 'feed.sqlite')).exists()).toBe(false);
  });
});
