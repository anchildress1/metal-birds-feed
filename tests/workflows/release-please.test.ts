import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load } from 'js-yaml';
import { z } from 'zod';

const StepSchema = z.looseObject({
  name: z.string().optional(),
  id: z.string().optional(),
  if: z.string().optional(),
  uses: z.string().optional(),
  run: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  with: z.record(z.string(), z.unknown()).optional(),
});

const JobSchema = z.looseObject({
  needs: z.string().optional(),
  if: z.string().optional(),
  outputs: z.record(z.string(), z.string()).optional(),
  permissions: z.record(z.string(), z.string()),
  steps: z.array(StepSchema),
});

const WorkflowSchema = z.looseObject({
  concurrency: z.object({
    group: z.string(),
    'cancel-in-progress': z.boolean(),
  }),
  jobs: z.object({
    'release-please': JobSchema,
    'deploy-release': JobSchema,
  }),
});

const workflowPath = join(
  import.meta.dir,
  '..',
  '..',
  '.github',
  'workflows',
  'release-please.yml'
);

const readWorkflow = async (): Promise<z.infer<typeof WorkflowSchema>> =>
  WorkflowSchema.parse(load(await readFile(workflowPath, 'utf8')));

const namedStep = (
  steps: z.infer<typeof StepSchema>[],
  name: string
): z.infer<typeof StepSchema> => {
  const step = steps.find((candidate) => candidate.name === name);
  if (!step) throw new Error(`Workflow step not found: ${name}`);
  return step;
};

describe('Release Please deployment contract', () => {
  it('deploys only when Release Please creates a root release', async () => {
    const workflow = await readWorkflow();
    const releaseJob = workflow.jobs['release-please'];
    const deployJob = workflow.jobs['deploy-release'];
    const releaseStep = namedStep(releaseJob.steps, 'Create or update release');

    expect(releaseStep.id).toBe('release');
    expect(releaseJob.outputs).toEqual({
      release_created: '${{ steps.release.outputs.release_created }}',
      release_sha: '${{ steps.release.outputs.sha }}',
      release_tag: '${{ steps.release.outputs.tag_name }}',
      release_version: '${{ steps.release.outputs.version }}',
    });
    expect(deployJob.needs).toBe('release-please');
    expect(deployJob.if).toBe("${{ needs.release-please.outputs.release_created == 'true' }}");
  });

  it('checks out and validates the exact released version before deployment', async () => {
    const workflow = await readWorkflow();
    const steps = workflow.jobs['deploy-release'].steps;
    const checkout = namedStep(steps, 'Checkout released code');
    const verify = namedStep(steps, 'Verify released version');

    expect(checkout.with?.['ref']).toBe('${{ needs.release-please.outputs.release_sha }}');
    expect(verify.env).toEqual({
      RELEASE_TAG: '${{ needs.release-please.outputs.release_tag }}',
      RELEASE_VERSION: '${{ needs.release-please.outputs.release_version }}',
    });
    expect(verify.run).toContain('test "$package_version" = "$RELEASE_VERSION"');
    expect(verify.run).toContain('test "$RELEASE_TAG" = "v$RELEASE_VERSION"');
  });

  it('assembles, deploys, and records the feed without a feed-change condition', async () => {
    const workflow = await readWorkflow();
    const deployJob = workflow.jobs['deploy-release'];
    const assemble = namedStep(deployJob.steps, 'Assemble released feed');
    const deploy = namedStep(deployJob.steps, 'Deploy released feed service');
    const record = namedStep(deployJob.steps, 'Record deployed feed hash');

    expect(workflow.concurrency['cancel-in-progress']).toBe(false);
    expect(assemble.run).toBe('make assemble-feed');
    expect(assemble.if).toBeUndefined();
    expect(deploy.run).toBe('make deploy-only');
    expect(deploy.if).toBeUndefined();
    expect(record.run).toBe('bun run dist/mark-deployed.js "$FEED_HASH"');
    expect(record.if).toBeUndefined();
    expect(deployJob.permissions).toEqual({ contents: 'read', 'id-token': 'write' });
  });

  it('keeps deployment credentials scoped to the steps that consume them', async () => {
    const workflow = await readWorkflow();
    const deployJob = workflow.jobs['deploy-release'];
    const assemble = namedStep(deployJob.steps, 'Assemble released feed');
    const record = namedStep(deployJob.steps, 'Record deployed feed hash');

    expect(deployJob).not.toHaveProperty('env');
    expect(assemble.env).toMatchObject({
      MBF_R2_ACCOUNT_ID: '${{ secrets.MBF_R2_ACCOUNT_ID }}',
      MBF_R2_SECRET_ACCESS_KEY: '${{ secrets.MBF_R2_SECRET_ACCESS_KEY }}',
    });
    expect(record.env).toMatchObject({
      FEED_HASH: '${{ steps.feed.outputs.hash }}',
      MBF_R2_ACCESS_KEY_ID: '${{ secrets.MBF_R2_ACCESS_KEY_ID }}',
    });
  });
});
