# OpenClaw Task Flow Linked-Task Cleanup-After Parity

## Objective

- Continue the OpenClaw task-runtime audit with one narrow, verifiable loop.
- Re-check whether local Task Flow linked-task cards preserve the upstream task-retention semantics
  already present in `TaskRunView`.
- Land the smallest truthful fix in the shared detail presentation layer without reopening broader
  Task Flow refactors.

## Upstream Review Result

This loop re-read the bundled upstream runtime task sources instead of assuming the remaining
linked-task gaps were only cosmetic.

Primary upstream evidence:

- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`
- `.cache/bundled-components/upstreams/openclaw/src/commands/tasks.ts`

What upstream currently establishes:

1. `TaskRunView` publicly includes `cleanupAfter`
2. upstream task detail output explicitly prints:
   - `sourceId`
   - `ownerKey`
   - `childSessionKey`
   - `parentTaskId`
   - `cleanupAfter`
3. upstream formats `cleanupAfter` as a first-class operational timestamp rather than burying it in
   raw payload

That makes task cleanup timing part of the public retention and maintenance surface, not hidden
internal state.

## Problem Found

Before this loop, the local architecture still had a presentation gap:

1. linked-task gateway normalization already preserved `cleanupAfter`
2. the shared Task Flow detail card still rendered no cleanup-timing field at all
3. operators therefore could not see when a finished linked task was scheduled to age out

So the remaining issue was not in transport or core pass-through anymore. It was semantic loss in
the final shared UI surface.

## Design Decision

Keep this loop narrow:

1. do not touch gateway or core pass-through code because the field is already preserved
2. add one small shared helper to normalize blank cleanup timestamps
3. expose a compact `Cleanup after` field inside linked-task cards
4. keep the card layout stable and avoid building a larger retention inspector in this pass

This restores truthful task-retention visibility without over-expanding the overlay.

## TDD Record

### Red

Failing tests were added first in two places:

1. `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
   - expected a `formatTaskFlowLinkedTaskCleanupAfter()` helper
2. `scripts/sdkwork-tasks-contract.test.ts`
   - expected the shared manager to reference the new cleanup-after field label and helper

Fresh red evidence:

- `node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
  failed because `formatTaskFlowLinkedTaskCleanupAfter` did not exist
- `pnpm.cmd check:sdkwork-tasks`
  failed for the same missing export and therefore confirmed the shared linked-task surface still
  lacked cleanup-after parity

### Green

After the implementation:

- helper tests passed
- task contracts passed
- locale sync and i18n validation passed
- production build passed
- full workspace lint and parity automation passed

## Fix Landed

### 1. Shared linked-task meta now exposes cleanup timing through one presentation seam

Updated:

- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.ts`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`

Changes:

1. added `formatTaskFlowLinkedTaskCleanupAfter()`
2. blank or missing cleanup timestamps now normalize to `-`

That keeps retention timing readable without repeating trimming logic in the component.

### 2. Linked-task cards now show the upstream cleanup-after field

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

Changes:

1. linked-task cards now display `Cleanup after`
2. the value comes from the shared cleanup-after helper

This closes the remaining local gap where cleanup timing existed in data but was invisible in the
shared UI.

### 3. Locale and task contracts now lock the cleanup-after field in place

Updated:

- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`
- `scripts/sdkwork-tasks-contract.test.ts`

Changes:

1. added `tasks.page.runtime.fields.cleanupAfter`
2. extended the shared task contract so future refactors must keep using the cleanup-after label and
   helper

Note:

- `zh/tasks.json` was updated through a controlled JSON rewrite because the file encoding remains
  unsafe for line-level patching

## Verification

Fresh commands run in this loop:

```bash
node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts
pnpm.cmd --filter @sdkwork/claw-i18n sync:locales
pnpm.cmd check:sdkwork-tasks
node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts
pnpm.cmd build
pnpm.cmd lint
```

Results:

- `node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
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

1. this loop reused the existing runtime-board architecture and did not require new gateway or core
   seams
2. locale sync and i18n verification were kept serial to avoid stale aggregate reads
3. the full lint run again validated architecture boundaries, parity contracts, and multi-mode
   release automation checks for server, desktop, docker, and k8s flows

## Outcome

This loop closes another real linked-task parity gap:

1. cleanup timing is no longer hidden in local Task Flow linked-task cards
2. the shared UI now reflects more of the upstream public `TaskRunView` surface
3. the fix is covered by helper, locale, contract, build, and full lint/parity verification

## Remaining Improvement Opportunities

The next narrow loop should still avoid broad refactoring. The strongest candidates after this loop
were:

1. review whether linked-task cards still under-surface `sourceId` compared with upstream task
   detail output
2. review whether task-level `ownerKey` adds any truth beyond flow-level ownership before exposing
   it
3. move to the next OpenClaw module outside task-runtime surfaces once the remaining linked-task
   semantics are exhausted
