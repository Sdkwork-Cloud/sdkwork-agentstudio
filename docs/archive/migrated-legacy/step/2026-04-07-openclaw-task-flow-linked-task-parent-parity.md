# OpenClaw Task Flow Linked-Task Parent Parity

## Objective

- Continue the OpenClaw task-runtime audit with one narrow, verifiable loop.
- Re-check whether local Task Flow linked-task cards preserve the upstream task lineage semantics
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

1. `TaskRunView` publicly includes `parentTaskId`
2. upstream task detail output explicitly prints:
   - `ownerKey`
   - `childSessionKey`
   - `parentTaskId`
   - `agentId`
   - `runId`
3. this means task parentage is part of the public operational surface, not hidden implementation
   detail

That makes `parentTaskId` a real part of upstream task lineage semantics.

## Problem Found

Before this loop, the local architecture still had a presentation gap:

1. the linked-task gateway normalization already preserved `parentTaskId`
2. the shared Task Flow detail card still rendered no parent-task field at all
3. operators could therefore not see whether a linked task was rooted directly in the flow or was
   the descendant of another task

So the remaining issue was not at the infrastructure seam anymore. It was semantic loss in the
final shared UI surface.

## Design Decision

Keep this loop narrow:

1. do not touch gateway or core pass-through code because the field is already preserved
2. add one small shared helper to normalize blank parent ids
3. expose a compact `Parent task` field inside linked-task cards
4. keep the card layout stable and avoid building a larger task-graph visualizer in this pass

This restores truthful task lineage without over-expanding the overlay.

## TDD Record

### Red

Failing tests were added first in two places:

1. `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
   - expected a `getTaskFlowLinkedTaskParentTaskId()` helper
2. `scripts/sdkwork-tasks-contract.test.ts`
   - expected the shared manager to reference the new parent-task field label and helper

Fresh red evidence:

- `node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
  failed because `getTaskFlowLinkedTaskParentTaskId` did not exist
- `pnpm.cmd check:sdkwork-tasks`
  failed for the same missing export and therefore confirmed the shared linked-task surface still
  lacked parent-task parity

One intermediate contract assertion was too implementation-specific because it required the manager
source to mention `task.parentTaskId` directly. That was relaxed after the helper landed so the
contract now locks the behavior and shared seam rather than the exact inline implementation.

### Green

After the implementation:

- helper tests passed
- task contracts passed
- locale sync and i18n validation passed
- production build passed
- full workspace lint and parity automation passed

## Fix Landed

### 1. Shared linked-task meta now exposes parent-task lineage through one presentation seam

Updated:

- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.ts`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`

Changes:

1. added `getTaskFlowLinkedTaskParentTaskId()`
2. blank or missing parent ids now normalize to `-`

That keeps the lineage read path simple and avoids repeating trimming logic in the component.

### 2. Linked-task cards now show the upstream parent-task field

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

Changes:

1. linked-task cards now display `Parent task`
2. the value comes from the shared parent-task helper

This closes the remaining local gap where parent lineage existed in data but was invisible in the
shared UI.

### 3. Locale and task contracts now lock the parent-task field in place

Updated:

- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`
- `scripts/sdkwork-tasks-contract.test.ts`

Changes:

1. added `tasks.page.runtime.fields.parentTask`
2. extended the shared task contract so future refactors must keep using the parent-task label and
   helper

Note:

- `zh/tasks.json` was updated through a controlled JSON rewrite again because the file encoding
  remains unsafe for line-level patching

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

1. parent task lineage is no longer hidden in local Task Flow linked-task cards
2. the shared UI now reflects more of the upstream public `TaskRunView` surface
3. the fix is covered by helper, locale, contract, build, and full lint/parity verification

## Remaining Improvement Opportunities

The next narrow loop should still avoid broad refactoring. The strongest candidates now are:

1. review whether `cleanupAfter` should be surfaced now that it is already normalized and upstream
   prints it in task detail output
2. review whether `ownerKey` still needs explicit linked-task visibility or whether flow-level
   ownership is already sufficient
3. move to the next OpenClaw module outside task-runtime surfaces once the remaining linked-task
   semantics are exhausted

