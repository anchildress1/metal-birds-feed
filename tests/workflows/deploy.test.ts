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
  secrets: z.record(z.string(), z.string()),
  permissions: z.record(z.string(), z.string()),
});

const DeployWorkflowSchema = z.looseObject({
  on: z.looseObject({
    workflow_call: z.looseObject({
      inputs: z.record(z.string(), z.looseObject({})),
      secrets: z.record(z.string(), z.looseObject({ required: z.boolean() })),
    }),
  }),
  concurrency: z.object({
    group: z.string(),
    queue: z.literal('max'),
    'cancel-in-progress': z.boolean(),
  }),
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
const MUTABLE_ACTION_RULE =
  'yaml.github-actions.security.github-actions-mutable-action-tag.github-actions-mutable-action-tag';
const R2_SECRETS = {
  MBF_R2_ACCOUNT_ID: '${{ secrets.MBF_R2_ACCOUNT_ID }}',
  MBF_R2_ACCESS_KEY_ID: '${{ secrets.MBF_R2_ACCESS_KEY_ID }}',
  MBF_R2_SECRET_ACCESS_KEY: '${{ secrets.MBF_R2_SECRET_ACCESS_KEY }}',
  MBF_R2_BUCKET_NAME: '${{ secrets.MBF_R2_BUCKET_NAME }}',
};

describe('deploy workflow contract', () => {
  it('limits mutable-action suppressions to GitHub-owned major tags', async () => {
    const files = readdirSync(workflowsDir).filter((file) => /\.ya?ml$/.test(file));
    const workflows = await Promise.all(
      files.map(async (file) => ({ file, text: await readFile(join(workflowsDir, file), 'utf8') }))
    );
    const suppressions = workflows.flatMap(({ file, text }) =>
      text
        .split('\n')
        .map((line, index) => ({ file, line, number: index + 1 }))
        .filter(({ line }) => line.includes(`nosemgrep: ${MUTABLE_ACTION_RULE}`))
    );

    // Without this the test passes vacuously the moment the rule id drifts: semgrep renames the
    // rule, every suppression stops matching the filter, the loop iterates zero times and reports
    // green forever while unbounded suppressions sit in the workflows.
    expect(
      suppressions.length,
      'no mutable-action suppressions found — has the rule id drifted?'
    ).toBeGreaterThan(0);

    for (const suppression of suppressions) {
      expect(
        suppression.line,
        `${suppression.file}:${suppression.number} suppresses mutable-action detection outside the actions/* major-tag policy`
      ).toMatch(new RegExp(`uses: actions/[^@\\s]+@v\\d+ # nosemgrep: ${MUTABLE_ACTION_RULE}$`));
    }
  });

  // Two jobs deploying one Cloud Run service both advance _deployed.json, and whichever writes
  // last records a hash that is not live. Every workflow is scanned rather than a named list, so a
  // deploy added to a brand-new file is caught too.
  it('is the only workflow that deploys', async () => {
    // `.yaml` is as valid as `.yml` to Actions, and `make deploy` reaches Cloud Run just as
    // `make deploy-only` does — matching one of each pair would let a second deploy path in while
    // this test stayed green. `\bmake deploy\b` covers both targets and still rejects an unrelated
    // `make deployment-docs`.
    const files = readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f));
    const workflows = await Promise.all(
      files.map(async (file) => ({ file, text: await readFile(join(workflowsDir, file), 'utf8') }))
    );
    const deployers = workflows
      .filter(({ text }) => /\bmake deploy\b/.test(text) || text.includes('gcloud run deploy'))
      .map(({ file }) => file);

    expect(deployers).toEqual(['deploy.yml']);
  });

  // Inside a called workflow `${{ github.workflow }}` resolves to the CALLER's name, which would
  // file the release deploy and the refresh deploy under different groups — the race the group
  // exists to prevent — and can cancel the caller. It must stay a constant.
  it('serializes every deploy on one constant concurrency group', async () => {
    const deploy = await readDeploy();
    expect(deploy.concurrency).toEqual({
      group: 'cloud-run-deploy',
      queue: 'max',
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
    expect(deploy.on.workflow_call.secrets).toEqual(
      Object.fromEntries(Object.keys(R2_SECRETS).map((secret) => [secret, { required: true }]))
    );
  });

  it.each(['release-please.yml', 'refresh.yml'])(
    'routes %s through the shared workflow with secrets and id-token',
    async (file) => {
      const job = await callerJob(file);
      expect(job.uses).toBe('./.github/workflows/deploy.yml');
      expect(job.secrets).toEqual(R2_SECRETS);
      // Callers can only downgrade the called workflow's permissions, so a caller that omits
      // id-token: write breaks Workload Identity auth at deploy time, not at lint time.
      expect(job.permissions).toEqual({ contents: 'read', 'id-token': 'write' });
    }
  );

  it('forces the release deploy and pins it to the released commit', async () => {
    const job = await callerJob('release-please.yml');
    const steps = (await readDeploy()).jobs.deploy.steps;
    const checkout = namedStep(steps, 'Checkout code to deploy');
    const verify = namedStep(steps, 'Verify released version');

    expect(job.if).toBe("${{ needs.release-please.outputs.release_created == 'true' }}");
    expect(job.with).toEqual({
      ref: '${{ needs.release-please.outputs.release_sha }}',
      force: true,
      expected_version: '${{ needs.release-please.outputs.release_version }}',
      expected_tag: '${{ needs.release-please.outputs.release_tag }}',
    });
    expect(checkout.with?.['ref']).toBe('${{ inputs.ref }}');
    expect(verify.env).toEqual({
      RELEASE_TAG: '${{ inputs.expected_tag }}',
      RELEASE_VERSION: '${{ inputs.expected_version }}',
    });
    expect(verify.run).toContain('test "$package_version" = "$RELEASE_VERSION"');
    expect(verify.run).toContain('test "$RELEASE_TAG" = "v$RELEASE_VERSION"');
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

    // Fail-closed assembly is the design, so the recovery instructions are the deliverable. Scoped
    // to the assemble step's own outcome: a failed version check must not print refresh advice.
    const explain = namedStep(steps, 'Explain the assembly failure');
    expect(explain.if).toBe("${{ failure() && steps.feed.outcome == 'failure' }}");
    expect(explain.run).toContain('Registry Refresh');
    expect(explain.run).toContain('Re-run failed jobs');
    expect(explain.run).toContain('::error title=Feed assembly failed::');
    // Keyed on force, never on the version string being non-empty: the latter lets the check
    // switch itself off exactly when the upstream output breaks. The emptiness assertions below
    // are what turn a missing version into a failed release rather than a skipped one.
    const verify = namedStep(steps, 'Verify released version');
    expect(verify.if).toBe('${{ inputs.force }}');
    expect(verify.run).toContain('test -n "$RELEASE_VERSION"');
    expect(verify.run).toContain('test -n "$RELEASE_TAG"');
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
