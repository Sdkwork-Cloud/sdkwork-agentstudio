# OpenClaw Runtime Task Timeline Parity

## Objective

- Continue the OpenClaw parity review with one narrow, operator-visible loop.
- Re-check whether the local detached runtime-task detail overlay exposes the lifecycle timestamps
  that upstream `tasks.show` prints explicitly.
- Land the smallest truthful UI and locale update without reopening the runtime-task detail bridge
  that was already completed in the previous loop.

## Upstream Evidence Reviewed

Primary upstream evidence re-checked for this loop:

- `.cache/bundled-components/upstreams/openclaw/src/commands/tasks.ts`
- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`

What upstream currently establishes:

1. `tasks.show` is the operator-facing detached runtime-task inspection surface.
2. upstream prints lifecycle timestamps explicitly instead of hiding them inside a generic
   "latest update" concept:
   - `createdAt`
   - `startedAt`
   - `endedAt`
   - `lastEventAt`
3. `TaskRunDetail = TaskRunView`, so those fields are part of the official task detail shape, not
   a CLI-only presentation invention.

Relevant upstream lines from `tasks.ts`:

```ts
`createdAt: ${new Date(task.createdAt).toISOString()}`,
`startedAt: ${task.startedAt ? new Date(task.startedAt).toISOString() : "n/a"}`,
`endedAt: ${task.endedAt ? new Date(task.endedAt).toISOString() : "n/a"}`,
`lastEventAt: ${task.lastEventAt ? new Date(task.lastEventAt).toISOString() : "n/a"}`,
```

## Problem Found

Before this loop, the detached runtime-task detail overlay already existed, but it still
under-surfaced upstream lifecycle timing:

1. the overlay showed a generic latest timestamp path through local `updatedAt`
2. it did not show the full lifecycle breakdown that upstream operators see
3. operators therefore could not distinguish:
   - when a task was created
   - when it actually started
   - when it finished

That was a real parity loss because upstream treats those timestamps as first-class operator
signals in `tasks.show`.

## Design Decision

Keep the loop narrow and semantic:

1. keep local normalization unchanged because gateway/core already map upstream `endedAt` and
   `lastEventAt` into the local record shape
2. improve only the detached runtime-task detail overlay presentation
3. add only the locale keys that are required for explicit timeline labels
4. extend the static task contract so the UI cannot silently regress back to a single
   "updated/latest" timestamp

Non-goals:

1. do not rename the shared normalized `updatedAt` field in this loop
2. do not refactor runtime-task detail state or fetch orchestration
3. do not broaden this pass into Task Flow detail

## TDD Record

### Red

Focused red expectations were added first in `scripts/sdkwork-tasks-contract.test.ts`:

1. the runtime-task detail overlay must reference:
   - `runtimeTaskDetail.createdAt`
   - `runtimeTaskDetail.startedAt`
   - `runtimeTaskDetail.finishedAt`
2. both locale bundles must define:
   - `tasks.page.runtime.fields.createdAt`
   - `tasks.page.runtime.fields.startedAt`
   - `tasks.page.runtime.fields.finishedAt`

Fresh red evidence for the narrow contract gap:

```bash
pnpm.cmd check:sdkwork-tasks
```

Observed failure pattern:

1. the shared manager contract failed because the overlay still lacked explicit runtime timeline
   references
2. locale coverage failed because the new timeline labels were not yet required end to end

### Green

After the minimal UI and locale update:

1. runtime-task detail overlay now shows created, started, and finished timestamps explicitly
2. locale sync passed
3. tasks contract passed
4. i18n tests passed
5. full build passed
6. full lint/parity verification passed

## Fix Landed

### 1. Detached runtime-task detail now shows the full lifecycle trio

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

Changes:

1. added explicit detail rows for:
   - `createdAt`
   - `startedAt`
   - `finishedAt`
2. kept the generic latest timestamp row through existing local `updatedAt` normalization for
   continuity
3. preserved the rest of the detached detail overlay structure from the prior loop

### 2. Locale coverage now locks the timeline labels

Updated:

- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`

Changes:

1. added runtime-field labels for created, started, and finished timestamps
2. synced the aggregate locale files so the shared app bundle and contract tests read the same
   truth

### 3. Static contract coverage now guards the operator surface

Updated:

- `scripts/sdkwork-tasks-contract.test.ts`

Changes:

1. required the runtime-task detail overlay to reference the three lifecycle fields directly
2. required English and Chinese locale coverage for the corresponding labels

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

1. the full lint chain again exercised architecture and packaging checks already used in this
   workspace for browser, desktop, release, and runtime automation surfaces
2. this loop did not require any backend or platform contract changes because the data was already
   present and normalized upstream-to-local

## Outcome

This loop closes a real operator-visible parity gap:

1. detached runtime-task inspection now mirrors upstream lifecycle timing more faithfully
2. operators can distinguish creation, start, and finish moments instead of inferring them from a
   single latest timestamp
3. the improvement stays narrowly scoped to truthful presentation rather than speculative
   refactoring

## Remaining Improvement Opportunities

The next narrow runtime-task candidate should remain evidence-driven. The best follow-up is:

1. audit whether local `updatedAt` labeling should be tightened toward upstream `lastEventAt`
   semantics so the final timestamp row is not semantically blurrier than upstream
