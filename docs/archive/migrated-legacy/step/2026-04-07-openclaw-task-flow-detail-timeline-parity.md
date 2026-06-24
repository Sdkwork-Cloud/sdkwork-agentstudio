# OpenClaw Task Flow Detail Timeline Parity

## Objective

- Continue the OpenClaw review loop after the Task Flow detail overlay was already introduced.
- Verify whether the local Task Flow detail surface exposes the lifecycle timing that upstream
  semantics make operationally relevant across flow and linked-task inspection.
- Land the smallest truthful UI and contract update so Task Flow inspection no longer compresses
  timeline state into a partial view.

## Upstream Evidence Reviewed

Primary upstream evidence re-checked in this loop:

- `.cache/bundled-components/upstreams/openclaw/src/commands/tasks.ts`
- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`

What this review established:

1. upstream task-run inspection treats lifecycle timestamps as first-class operator fields
2. linked tasks inside a Task Flow are still task runs, so the same timestamp expectations matter
   there
3. the local Task Flow detail overlay already loaded official linked-task data through
   `tasks.flow.show`, which means the missing surface was presentation, not transport

The important practical point was not inventing new flow-only semantics, but truthfully surfacing
the lifecycle data already present in the official detail payload.

## Problem Found

Before this loop, the Task Flow detail overlay still had two timing gaps:

1. the flow header did not expose `startedAt` and `finishedAt` explicitly
2. linked task cards inside the detail overlay did not expose the full task lifecycle trio:
   - `createdAt`
   - `startedAt`
   - `finishedAt`

That left operators with an under-specified timeline when inspecting orchestration behavior,
especially for flows that had already progressed across queued, running, and terminal phases.

## Design Decision

Keep the fix presentation-only and aligned with the existing local model:

1. use the timestamps already normalized by infrastructure
2. expose explicit lifecycle rows in the flow header grid
3. expose explicit lifecycle rows in each linked-task card
4. extend the contract gate so future cleanup cannot silently collapse the timeline again

Non-goals:

1. do not add speculative duration math or derived badges
2. do not rename local shared timestamp fields in this loop
3. do not refactor linked-task cards into separate components only for this parity step

## TDD Record

### Red

Failing expectations were added first in `scripts/sdkwork-tasks-contract.test.ts`:

1. the Task Flow detail header must reference:
   - `taskFlowDetail.startedAt`
   - `taskFlowDetail.finishedAt`
2. linked task cards must reference:
   - `task.createdAt`
   - `task.startedAt`
   - `task.finishedAt`
3. locale bundles must define the matching runtime field labels

Fresh red evidence:

```bash
pnpm.cmd check:sdkwork-tasks
```

Observed failure pattern:

1. the contract failed because the Task Flow detail UI still omitted part of the lifecycle surface
2. locale coverage failed because the shared runtime field labels were not yet locked for these
   rows

### Green

After the minimal UI and locale update:

1. Task Flow header now shows started and finished timestamps
2. linked task cards now show created, started, and finished timestamps
3. locale sync passed
4. task contract passed
5. i18n tests passed
6. full build passed
7. full lint/parity verification passed

## Fix Landed

### 1. Task Flow detail header now exposes lifecycle timing more completely

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

Changes:

1. added explicit header rows for:
   - `startedAt`
   - `finishedAt`
2. kept the existing latest-update row so operators can still see the last observed change

### 2. Linked task cards now mirror upstream task timing more faithfully

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

Changes:

1. each linked task card now shows:
   - `createdAt`
   - `startedAt`
   - `finishedAt`
2. the existing latest timestamp row remains in place through local `updatedAt` normalization
3. the patch reuses existing shared presentation helpers instead of adding new formatting layers

### 3. Locale and contract coverage now lock the Task Flow timeline surface

Updated:

- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`
- `scripts/sdkwork-tasks-contract.test.ts`

Changes:

1. reused the shared runtime field labels for created, started, and finished timestamps
2. required the Task Flow detail overlay to reference the new lifecycle rows directly

## Verification

Fresh commands run after landing the change:

```bash
pnpm.cmd --filter @sdkwork/claw-i18n sync:locales
pnpm.cmd check:sdkwork-tasks
node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts
pnpm.cmd build
pnpm.cmd lint
```

Results:

1. locale sync passed
2. task contract check passed
3. i18n tests passed
4. production build passed
5. lint passed

Verification feedback:

1. the full lint chain again covered workspace architecture checks and multi-mode release/runtime
   automation checks already embedded in this repo
2. no gateway or core changes were required because the detail data was already available through
   the official Task Flow detail path

## Outcome

This loop closes the remaining obvious timeline gap in Task Flow detail inspection:

1. flow-level lifecycle timing is now visible without inference
2. linked task cards expose the same core timing checkpoints operators expect from upstream task
   inspection
3. the change stays narrow, truthful, and fully guarded by locale and contract checks

## Remaining Improvement Opportunities

The next narrow follow-up should review timestamp semantics rather than add more rows. The strongest
candidate is:

1. audit whether local `updatedAt` labels on flow detail and linked-task cards should instead
   communicate upstream `lastEventAt` semantics more precisely
