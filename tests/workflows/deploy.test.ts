import { describe, expect, it } from 'bun:test';
import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { z } from 'zod';

// actionlint already validates that a caller's `with:` names and types match the reusable
// workflow's declared inputs, so nothing here re-checks that. What it cannot check is the policy:
// that exactly one workflow deploys, that the release path forces and the refresh path does not,
// and that a deploy is gated on the feed actually changing.

const StepSchema = z.looseObject({
  name: z.string().optional(),
  id: z.string().optional(),
  if: z.string().optional(),
  uses: z.string().optional(),
  run: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  with: z.record(z.string(), z.unknown()).optional(),
});

const CallerJobSchema = z.looseObject({
  needs: z.union([z.string(), z.array(z.string())]).optional(),
  if: z.string().optional(),
  uses: z.string(),
  with: z.record(z.string(), z.unknown()),
  secrets: z.string(),
  permissions: z.record(z.string(), z.string()),
});

const DeployWorkflowSchema = z.looseObject({
  on: z.looseObject({
    workflow_call: z.looseObject({ inputs: z.record(z.string(), z.looseObject({})) }),
  }),
  concurrency: z.object({ group: z.string(), 'cancel-in-progress': z.boolean() }),
  jobs: z.looseObject({
    deploy: z.looseObject({
      'timeout-minutes': z.number(),
      permissions: z.record(z.string(), z.string()),
      steps: z.array(StepSchema),
    }),
  }),
});

const workflowsDir = join(import.meta.dir, '..', '..', '.github', 'workflows');
const read = async (file: string): Promise<unknown> =>
  load(await readFile(join(workflowsDir, file), 'utf8'));

const readDeploy = async (): Promise<z.infer<typeof DeployWorkflowSchema>> =>
  DeployWorkflowSchema.parse(await read('deploy.yml'));

const callerJob = async (file: string): Promise<z.infer<typeof CallerJobSchema>> => {
  const wf = z
    .looseObject({ jobs: z.looseObject({ deploy: CallerJobSchema }) })
    .parse(await read(file));
  return wf.jobs.deploy;
};

const namedStep = (
  steps: z.infer<typeof StepSchema>[],
  name: string
): z.infer<typeof StepSchema> => {
  const step = steps.find((candidate) => candidate.name === name);
  if (!step) throw new Error(`Workflow step not found: ${name}`);
  return step;
};

const CHANGE_GATE = "${{ steps.feed.outputs.changed == 'true' || inputs.force }}";

describe('deploy workflow contract', () => {
  // Two jobs deploying one Cloud Run service both advance _deployed.json, and whichever writes
  // last records a hash that is not live. Every workflow is scanned rather than a named list, so a
  // deploy added to a brand-new file is caught too.
  it('is the only workflow that deploys', async () => {
    const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.yml'));
    const deployers: string[] = [];
    for (const file of files) {
      const text = await readFile(join(workflowsDir, file), 'utf8');
      if (text.includes('make deploy-only') || text.includes('gcloud run deploy'))
        deployers.push(file);
    }
    expect(deployers).toEqual(['deploy.yml']);
  });

  // Inside a called workflow `${{ github.workflow }}` resolves to the CALLER's name, which would
  // file the release deploy and the refresh deploy under different groups — the race the group
  // exists to prevent — and can cancel the caller. It must stay a constant.
  it('serializes every deploy on one constant concurrency group', async () => {
    const deploy = await readDeploy();
    expect(deploy.concurrency).toEqual({
      group: 'cloud-run-deploy',
      'cancel-in-progress': false,
    });
    expect(deploy.concurrency.group).not.toContain('github.workflow');
  });

  it('is reached only through workflow_call, never a trigger of its own', async () => {
    const deploy = await readDeploy();
    expect(Object.keys(deploy.on)).toEqual(['workflow_call']);
    expect(Object.keys(deploy.on.workflow_call.inputs).sort()).toEqual([
      'expected_tag',
      'expected_version',
      'force',
      'ref',
    ]);
  });

  it.each(['release-please.yml', 'refresh.yml'])(
    'routes %s through the shared workflow with secrets and id-token',
    async (file) => {
      const job = await callerJob(file);
      expect(job.uses).toBe('./.github/workflows/deploy.yml');
      expect(job.secrets).toBe('inherit');
      // Callers can only downgrade the called workflow's permissions, so a caller that omits
      // id-token: write breaks Workload Identity auth at deploy time, not at lint time.
      expect(job.permissions).toEqual({ contents: 'read', 'id-token': 'write' });
    }
  );

  it('forces the release deploy and pins it to the released commit', async () => {
    const job = await callerJob('release-please.yml');
    expect(job.if).toBe("${{ needs.release-please.outputs.release_created == 'true' }}");
    expect(job.with).toEqual({
      ref: '${{ needs.release-please.outputs.release_sha }}',
      force: true,
      expected_version: '${{ needs.release-please.outputs.release_version }}',
      expected_tag: '${{ needs.release-please.outputs.release_tag }}',
    });
  });

  // force must stay false here or every quiet refresh redeploys, which is the cost the
  // _deployed.json marker exists to avoid.
  it('lets the refresh deploy only a feed that actually changed', async () => {
    const job = await callerJob('refresh.yml');
    expect(job.with).toEqual({ ref: '${{ github.sha }}', force: false });
    expect(job.with['expected_version']).toBeUndefined();
  });

  it('gates the deploying steps on a changed feed or an explicit force', async () => {
    const steps = (await readDeploy()).jobs.deploy.steps;

    for (const name of [
      'Authenticate to Google Cloud',
      'Setup Google Cloud CLI',
      'Deploy feed service',
      'Record deployed feed hash',
    ])
      expect(namedStep(steps, name).if).toBe(CHANGE_GATE);

    // Assembly must never be gated on its own output, and the version check runs off the release
    // inputs instead.
    expect(namedStep(steps, 'Assemble feed').if).toBeUndefined();
    expect(namedStep(steps, 'Assemble feed').run).toBe('make assemble-feed');
    expect(namedStep(steps, 'Verify released version').if).toBe(
      "${{ inputs.expected_version != '' }}"
    );
  });

  it('keeps deployment credentials scoped to the steps that consume them', async () => {
    const job = (await readDeploy()).jobs.deploy;
    expect(job).not.toHaveProperty('env');
    expect(job['timeout-minutes']).toBe(30);
    expect(job.permissions).toEqual({ contents: 'read', 'id-token': 'write' });

    expect(namedStep(job.steps, 'Assemble feed').env).toMatchObject({
      MBF_R2_ACCOUNT_ID: '${{ secrets.MBF_R2_ACCOUNT_ID }}',
      MBF_R2_SECRET_ACCESS_KEY: '${{ secrets.MBF_R2_SECRET_ACCESS_KEY }}',
    });
    expect(namedStep(job.steps, 'Record deployed feed hash').env).toMatchObject({
      FEED_HASH: '${{ steps.feed.outputs.hash }}',
      MBF_R2_ACCESS_KEY_ID: '${{ secrets.MBF_R2_ACCESS_KEY_ID }}',
    });
  });
});
