# OpenClaw Task Flow Requester-Origin Parity

## Objective

- Continue the OpenClaw task-runtime audit with one narrow, verifiable loop.
- Re-check whether the local Task Flow surface preserves the upstream `requesterOrigin` delivery
  context.
- Land the smallest truthful fix across `gateway -> core -> UI -> i18n` without reopening wider
  task-runtime refactors.

## Upstream Review Result

This loop re-read the bundled upstream sources instead of assuming the remaining gap was only a
render-test problem.

Primary upstream evidence:

- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`
- `.cache/bundled-components/upstreams/openclaw/src/tasks/task-domain-views.ts`
- `.cache/bundled-components/upstreams/openclaw/src/utils/delivery-context.ts`

What upstream currently establishes:

1. `TaskFlowView` includes `requesterOrigin?: DeliveryContext`
2. `TaskFlowDetail` inherits that same source-delivery context
3. `DeliveryContext` is a structured public shape:
   - `channel`
   - `to`
   - `accountId`
   - `threadId`

That means the latest public Task Flow surface does not only identify the owner/session. It also
preserves where the flow request came from in delivery terms.

## Problem Found

Before this loop, the local architecture still dropped that upstream semantic completely:

1. the upstream Task Flow surface carried `requesterOrigin`
2. the local gateway client kept it only inside `raw`
3. the normalized `OpenClawTaskFlowRecord` and `OpenClawTaskFlowDetailRecord` did not expose it
4. the shared task board and detail overlay therefore had no truthful way to show the flow source

So the remaining parity issue was not cosmetic. It was semantic loss at the infrastructure boundary.

## Design Decision

Keep this loop narrow:

1. preserve a typed `requesterOrigin` object in normalized Task Flow records
2. avoid dumping raw JSON directly into list cards
3. present a compact source summary in the shared UI:
   - `channel -> to`
   - optional `@accountId`
   - optional `#threadId`
4. add one localized field label instead of introducing a larger delivery-origin panel

That keeps the source truth visible without over-expanding the task board.

## TDD Record

### Red

Failing tests were added first in four places:

1. `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
   - expected `listTaskFlows()` and `getTaskFlowDetail()` to preserve normalized
     `requesterOrigin`
2. `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`
   - expected the shared overview/detail seam to continue surfacing `requesterOrigin`
3. `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
   - expected a new `formatTaskFlowRequesterOrigin()` helper
4. `scripts/sdkwork-tasks-contract.test.ts`
   - expected the shared manager and locale resources to reference
     `tasks.page.runtime.fields.requesterOrigin`

Fresh red evidence:

- `node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
  failed because `formatTaskFlowRequesterOrigin` did not exist
- `node scripts/run-sdkwork-foundation-check.mjs`
  failed because normalized Task Flow records still dropped `requesterOrigin`

The core test already passed structurally once the fixtures carried the field, which was also
useful evidence: the remaining defect lived in normalization/presentation rather than the core
pass-through seam.

### Green

After the implementation:

- helper tests passed
- foundation tests passed
- tasks contract and runtime-board checks passed
- i18n structure validation passed again after the locale source and compatibility aggregates were
  resynced

## Fix Landed

### 1. Gateway normalization now preserves requester-origin delivery context

Updated:

- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`

Changes:

1. added `OpenClawTaskFlowRequesterOriginRecord`
2. normalized `requesterOrigin.channel`
3. normalized `requesterOrigin.to`
4. normalized `requesterOrigin.accountId`
5. normalized `requesterOrigin.threadId`
6. preserved the same field for both list and detail Task Flow shapes

That closes the infrastructure semantic-loss gap while keeping the original `raw` payload intact.

### 2. Shared Task Flow presentation now exposes the delivery source compactly

Updated:

- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.ts`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

Changes:

1. added `formatTaskFlowRequesterOrigin()`
2. Task Flow cards now show a requester-origin summary
3. the Task Flow detail overlay now shows the same field explicitly

The summary stays compact and readable instead of expanding raw JSON in the list surface.

### 3. Locale and task contracts were extended for the new field

Updated:

- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`
- `scripts/sdkwork-tasks-contract.test.ts`

Notes:

1. `requesterOrigin` was added under `tasks.page.runtime.fields`
2. compatibility aggregates were resynced after the split-locale update
3. `zh/tasks.json` could not be patched safely with `apply_patch` because the existing file
   encoding made line-level matching unstable
4. to keep the rest of the locale file lossless, the file was updated through a controlled JSON
   parse/serialize rewrite that only inserted the new key
5. the first rewrite wrote `????` because of console codepage handling; a second rewrite using
   Unicode escapes restored a clean value without altering the legacy task copy unexpectedly

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
  still failed for the same external environment reason:
  - `ENOSPC: no space left on device`

Verification feedback:

- one intermediate `index.test.ts` failure was caused by running it in parallel with
  `sync:locales`, so it read stale compatibility JSON before the sync finished
- rerunning the same test serially after locale sync passed cleanly
- the build failure remains environmental and happened while pnpm was copying dependencies into
  `node_modules`

## Outcome

This loop closes another real Task Flow parity gap:

1. local Task Flow records no longer drop upstream `requesterOrigin`
2. the shared task board now exposes where the flow request came from, not only who owns it
3. the new source field is covered by helper, gateway, tasks-contract, and i18n verification
4. the locale source and compatibility aggregates are back in sync after the new field landing

## Remaining Improvement Opportunities

The next narrow loop should still avoid broad refactoring. The strongest candidates now are:

1. extend linked-task detail rendering toward more of the upstream `TaskRunView` semantics that are
   still normalized but not surfaced
2. add a non-fragile presentation seam for the Task Flow detail overlay if a render-level
   regression test becomes worthwhile
3. re-run full production build once disk space is available, because bundle verification is still
   blocked by `ENOSPC`
