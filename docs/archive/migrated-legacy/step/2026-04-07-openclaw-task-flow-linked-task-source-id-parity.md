# OpenClaw Task Flow Linked-Task Source-ID Parity

## Objective

- Continue the OpenClaw task-runtime audit with one narrow, verifiable loop.
- Re-check whether local Task Flow linked-task cards preserve the upstream task provenance
  semantics already present in `TaskRunView`.
- Land the smallest truthful fix in the shared detail presentation layer without reopening broader
  Task Flow refactors.

## Upstream Review Result

This loop re-read the bundled upstream runtime task sources instead of assuming the remaining
linked-task fields were equally valuable.

Primary upstream evidence:

- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`
- `.cache/bundled-components/upstreams/openclaw/src/commands/tasks.ts`
- `.cache/bundled-components/upstreams/openclaw/src/tasks/task-registry.ts`
- `.cache/bundled-components/upstreams/openclaw/src/cron/service/ops.ts`
- `.cache/bundled-components/upstreams/openclaw/src/agents/acp-spawn.ts`

What upstream currently establishes:

1. `TaskRunView` publicly includes `sourceId`
2. upstream task detail output explicitly prints `sourceId` as a first-class field
3. upstream producers populate `sourceId` from multiple origins, including:
   - cron job ids
   - child run ids
   - gateway agent run ids
4. upstream task-registry flow linkage enforces owner consistency:
   - `Task ownerKey must match parent flow ownerKey.`

That means `sourceId` is real task provenance, while task-level `ownerKey` usually duplicates the
already visible flow owner inside linked-task cards.

## Problem Found

Before this loop, the local architecture still had a presentation gap:

1. linked-task gateway normalization already preserved `sourceId`
2. the shared linked-task helper seam did not include or normalize `sourceId`
3. the shared Task Flow detail card therefore hid upstream task provenance even though the field
   was already available in local data

So the remaining issue was not at the gateway or core boundary anymore. It was semantic loss in the
final shared UI surface.

## Design Decision

Keep this loop narrow:

1. do not touch gateway or core pass-through code because `sourceId` is already preserved
2. add one small shared helper to normalize blank source ids
3. expose a compact `Source ID` field inside linked-task cards
4. do not surface task-level `ownerKey` in this pass because upstream flow linkage keeps it aligned
   with the already visible flow owner for the common linked-task path

This restores truthful task provenance without adding redundant owner noise.

## TDD Record

### Red

Failing tests were added first in two places:

1. `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
   - expected a `getTaskFlowLinkedTaskSourceId()` helper
2. `scripts/sdkwork-tasks-contract.test.ts`
   - expected the shared manager to reference the new source-id field label and helper

Fresh red evidence:

- `node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
  failed because `getTaskFlowLinkedTaskSourceId` did not exist
- `pnpm.cmd check:sdkwork-tasks`
  failed for the same missing export and therefore confirmed the shared linked-task surface still
  lacked source-id parity

### Green

After the implementation:

- helper tests passed
- task contracts passed
- locale sync and i18n validation passed
- production build passed
- full workspace lint and parity automation passed

## Fix Landed

### 1. Shared linked-task meta now exposes task provenance through one presentation seam

Updated:

- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.ts`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`

Changes:

1. added `getTaskFlowLinkedTaskSourceId()`
2. blank or missing source ids now normalize to `-`

That keeps provenance formatting centralized and avoids repeating trimming logic in the component.

### 2. Linked-task cards now show the upstream source-id field

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

Changes:

1. linked-task cards now display `Source ID`
2. the value comes from the shared source-id helper

This closes the remaining local gap where task provenance existed in data but was invisible in the
shared UI.

### 3. Locale and task contracts now lock the source-id field in place

Updated:

- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`
- `scripts/sdkwork-tasks-contract.test.ts`

Changes:

1. added `tasks.page.runtime.fields.sourceId`
2. extended the shared task contract so future refactors must keep using the source-id label and
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

1. locale sync and i18n verification were kept serial to avoid stale aggregate reads
2. the full lint run again validated architecture boundaries, parity contracts, and multi-mode
   release automation checks for server, desktop, docker, and k8s flows
3. this loop reused the existing runtime-board architecture and did not require new gateway or core
   seams

## Outcome

This loop closes another real linked-task parity gap:

1. task provenance is no longer hidden in local Task Flow linked-task cards
2. the shared UI now reflects more of the upstream public `TaskRunView` surface
3. the `ownerKey` candidate was reviewed and intentionally not surfaced because it is usually
   redundant with the already visible flow owner in this path
4. the fix is covered by helper, locale, contract, build, and full lint/parity verification

## Remaining Improvement Opportunities

The next narrow loop should still avoid broad refactoring. The strongest candidates now are:

1. re-audit whether any remaining linked-task fields add non-redundant truth beyond the current
   surface, especially `scope`
2. if linked-task parity is now exhausted, move to the next OpenClaw module outside task-runtime
   surfaces using the same narrow-loop method
3. keep review notes evidence-driven so redundant fields do not get added only because they exist in
   the upstream type
