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

  it('publishes a fresh database before deploying it', async () => {
    const bunx = await executable('fake-bunx', '#!/bin/sh\nexit 0\n');
    const bun = await executable(
      'fake-bun',
      '#!/bin/sh\necho publish >> "$TEST_LOG"\nprintf fresh > feed.sqlite\n'
    );
    await executable('gcloud', '#!/bin/sh\necho gcloud >> "$TEST_LOG"\n');

    const result = runDeploy(bun, bunx);

    expect(result.exitCode).toBe(0);
    expect(await readFile(logPath, 'utf8')).toBe('publish\ngcloud\n');
    expect(await readFile(join(workspace, 'feed.sqlite'), 'utf8')).toBe('fresh');
  });

  it('does not deploy when publication fails', async () => {
    const bunx = await executable('fake-bunx', '#!/bin/sh\nexit 0\n');
    const bun = await executable('fake-bun', '#!/bin/sh\necho publish >> "$TEST_LOG"\nexit 42\n');
    await executable('gcloud', '#!/bin/sh\necho gcloud >> "$TEST_LOG"\n');

    const result = runDeploy(bun, bunx);

    expect(result.exitCode).not.toBe(0);
    expect(await readFile(logPath, 'utf8')).toBe('publish\n');
  });

  it('removes a stale database before publication', async () => {
    const bunx = await executable('fake-bunx', '#!/bin/sh\nexit 0\n');
    const bun = await executable('fake-bun', '#!/bin/sh\necho publish >> "$TEST_LOG"\n');
    await executable('gcloud', '#!/bin/sh\necho gcloud >> "$TEST_LOG"\n');
    await writeFile(join(workspace, 'feed.sqlite'), 'stale');

    const result = runDeploy(bun, bunx);

    expect(result.exitCode).not.toBe(0);
    expect(await readFile(logPath, 'utf8')).toBe('publish\n');
    expect(await Bun.file(join(workspace, 'feed.sqlite')).exists()).toBe(false);
  });
});
