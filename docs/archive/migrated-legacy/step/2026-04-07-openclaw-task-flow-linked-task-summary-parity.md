# OpenClaw Task Flow Linked-Task Summary Parity

## Objective

- Continue the OpenClaw parity audit with one narrow, verifiable loop.
- Re-check whether local Task Flow detail cards preserve the real public semantics of upstream
  `TaskRunView`.
- Land the smallest truthful fix across `gateway -> core -> shared UI -> i18n` without reopening
  unrelated runtime-board refactors.

## Upstream Review Result

This loop re-read the bundled upstream sources instead of assuming the remaining problem was only a
presentation preference.

Primary upstream evidence:

- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`
- `.cache/bundled-components/upstreams/openclaw/src/tasks/task-domain-views.ts`
- `.cache/bundled-components/upstreams/openclaw/src/commands/tasks.ts`
- `.cache/bundled-components/upstreams/openclaw/src/auto-reply/reply/commands-subagents/action-info.ts`

What upstream currently establishes:

1. `TaskRunView` publicly includes:
   - `progressSummary`
   - `terminalSummary`
   - `terminalOutcome`
   - `cleanupAfter`
   - `deliveryStatus`
   - `notifyPolicy`
2. upstream task list formatting prefers summary text in this order:
   - `terminalSummary`
   - `progressSummary`
   - `label`
   - task title
3. upstream task detail output also treats `terminalOutcome`, `deliveryStatus`, and
   `notifyPolicy` as first-class fields rather than hidden raw payload
4. subagent/task reply surfaces also read `progressSummary`, `terminalSummary`, and
   `deliveryStatus` directly

That means upstream `TaskRunView` is not only an identifier/status shape. It carries current or
terminal human-readable task meaning.

## Problem Found

Before this loop, the local Task Flow detail surface still had a real parity gap:

1. linked-task normalization dropped:
   - `progressSummary`
   - `terminalSummary`
   - `terminalOutcome`
   - `cleanupAfter`
2. the shared linked-task card used only `task.title`
3. the shared linked-task card did not show delivery/result semantics even though upstream treats
   them as public runtime fields

So the remaining issue was not cosmetic. The local architecture still lost upstream task-run
meaning at the infrastructure boundary and then rendered a thinner task explanation than upstream.

## Design Decision

Keep this loop narrow:

1. preserve the missing linked-task fields in normalized gateway records
2. add one shared helper that matches upstream summary precedence:
   - `terminalSummary`
   - `progressSummary`
   - `label`
   - `title`
3. expose only the most valuable extra fields in the linked-task card:
   - summary text
   - delivery status
   - notify policy
   - result
4. avoid introducing a larger nested linked-task inspector panel in this pass

This keeps the OpenClaw semantics visible without over-expanding the detail overlay.

## TDD Record

### Red

Failing tests were added first in four places:

1. `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
   - expected new linked-task summary/result helpers
2. `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
   - expected `tasks.flow.show` normalization to preserve the missing linked-task fields
3. `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`
   - expected the shared core seam to keep the richer linked-task payload intact
4. `scripts/sdkwork-tasks-contract.test.ts`
   - expected the shared manager and locale resources to wire delivery/result labels and the new
     linked-task helpers

Fresh red evidence:

- `node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
  failed because `formatTaskFlowLinkedTaskResult` did not exist yet
- `pnpm.cmd check:sdkwork-tasks`
  failed for the same missing export and therefore confirmed the shared task surface was still
  missing the new linked-task semantics

### Green

After the implementation:

- helper tests passed
- gateway normalization tests passed through the foundation check
- core seam tests passed through the core check
- locale sync, i18n structure, task contracts, full build, and full lint all passed

## Fix Landed

### 1. Gateway normalization now preserves richer linked-task semantics

Updated:

- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`

Changes:

1. preserved `cleanupAfter`
2. preserved `progressSummary`
3. preserved `terminalSummary`
4. preserved `terminalOutcome`

That closes the infrastructure semantic-loss gap for linked tasks while keeping the original raw
payload intact.

### 2. Shared linked-task presentation now follows upstream summary precedence

Updated:

- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.ts`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

Changes:

1. added `getTaskFlowLinkedTaskSummary()`
2. added `formatTaskFlowLinkedTaskResult()`
3. linked-task cards now show the most truthful summary instead of always using `title`
4. when the task title differs from the higher-priority summary, it is still shown as secondary
   context
5. linked-task cards now expose:
   - delivery status
   - notify policy
   - result

This aligns the local linked-task cards more closely with the way OpenClaw itself explains task
state and outcome.

### 3. Locale and task contracts were extended for the extra linked-task fields

Updated:

- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`
- `scripts/sdkwork-tasks-contract.test.ts`

Changes:

1. added `tasks.page.runtime.fields.deliveryStatus`
2. added `tasks.page.runtime.fields.result`
3. extended the shared task contract to require the manager to use the new linked-task helpers and
   locale labels

Note:

- `zh/tasks.json` was updated through a controlled JSON rewrite again because the file encoding
  remains unsafe for line-level patching

## Verification

Fresh commands run in this loop:

```bash
node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts
node scripts/run-sdkwork-foundation-check.mjs
node scripts/run-sdkwork-core-check.mjs
pnpm.cmd --filter @sdkwork/claw-i18n sync:locales
pnpm.cmd check:sdkwork-tasks
node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts
pnpm.cmd build
pnpm.cmd lint
```

Results:

- `node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
  passed
- `node scripts/run-sdkwork-foundation-check.mjs`
  passed
- `node scripts/run-sdkwork-core-check.mjs`
  passed
- `pnpm.cmd --filter @sdkwork/claw-i18n sync:locales`
  passed
- `pnpm.cmd check:sdkwork-tasks`
  passed
- `node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts`
  passed
- `pnpm.cmd build`
  passed
- `pnpm.cmd lint`
  passed

Verification feedback:

1. the earlier environment-only `ENOSPC` build failure is no longer blocking this workspace
2. locale sync and i18n tests were kept serial to avoid stale aggregate reads during the same loop

## Outcome

This loop closes another real Task Flow parity gap:

1. local linked-task records no longer drop upstream summary/result semantics
2. Task Flow detail cards now explain what a linked task is doing or why it stopped, not only its
   static title
3. linked-task delivery and result metadata are now visible in the shared UI
4. the linked-task parity fix is covered by helper, gateway, core, i18n, contract, build, and lint
   verification

## Remaining Improvement Opportunities

The next narrow loop should still avoid broad refactoring. The strongest candidates now are:

1. review whether linked-task cards still under-surface cleanup timing or parent-task hierarchy
   compared with upstream task detail output
2. add a more direct render-level regression seam for Task Flow detail cards if presentation
   changes become more frequent
3. continue the upstream audit outside task-runtime surfaces, using the same small-loop method

