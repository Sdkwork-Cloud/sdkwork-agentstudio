# OpenClaw Runtime Last-Event Label Parity

## Objective

- Continue the OpenClaw parity review with one narrow semantic loop.
- Re-check whether the local runtime UI distinguishes task-run timing from Task Flow timing the
  same way upstream does.
- Land the smallest truthful fix so runtime tasks and linked tasks no longer present upstream
  `lastEventAt` as if it were the flow-level `updatedAt`.

## Upstream Evidence Reviewed

Primary upstream evidence re-checked in this loop:

- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`
- `.cache/bundled-components/upstreams/openclaw/src/commands/tasks.ts`
- `.cache/bundled-components/upstreams/openclaw/src/commands/flows.ts`

What upstream currently establishes:

1. `TaskRunView` exposes task lifecycle timing as:
   - `createdAt`
   - `startedAt`
   - `endedAt`
   - `lastEventAt`
2. `TaskFlowView` uses different semantics:
   - `createdAt`
   - `updatedAt`
   - `endedAt`
3. upstream CLI presentation keeps those names distinct:
   - `tasks.show` prints `lastEventAt`
   - `flows show` prints `updatedAt`

Relevant upstream lines:

```ts
// task-domain-types.ts
lastEventAt?: number;
updatedAt: number;

// tasks.ts
`lastEventAt: ${task.lastEventAt ? new Date(task.lastEventAt).toISOString() : "n/a"}`,

// flows.ts
`updatedAt: ${new Date(flow.updatedAt).toISOString()}`,
```

## Problem Found

Before this loop, local normalization was already technically correct, but the UI still blurred the
two semantics:

1. runtime task cards showed the task-run latest event time under an `updatedAt` label
2. detached runtime task detail showed the same task-run timestamp under `updatedAt`
3. linked task cards inside Task Flow detail also showed task-run latest event time under
   `updatedAt`
4. Task Flow surfaces used `updatedAt` too, which is correct upstream for flows

The result was a semantic mismatch:

1. task runs and flows looked like they exposed the same timing field
2. operators could not tell from the UI whether a timestamp meant:
   - last task event
   - flow update time

That is a real parity issue because upstream treats those as different concepts.

## Design Decision

Keep the fix narrow and presentation-focused:

1. preserve the existing local normalized `updatedAt` data field for task runs
2. change only the user-facing label on task-run surfaces to `lastEventAt`
3. keep `updatedAt` on Task Flow cards and Task Flow detail, because that matches upstream
4. extend the contract and locale checks so the distinction cannot regress silently

Non-goals:

1. do not rename the shared normalized data field in infrastructure or core
2. do not refactor runtime/task-flow models
3. do not broaden this pass into other task detail fields unless upstream evidence shows another
   concrete gap

## TDD Record

### Red

Focused red expectations were added first in `scripts/sdkwork-tasks-contract.test.ts`:

1. the runtime UI must reference `tasks.page.runtime.fields.lastEventAt`
2. English and Chinese runtime locale bundles must define `lastEventAt`
3. existing Task Flow `updatedAt` coverage stays in place

Fresh red evidence:

```bash
pnpm.cmd check:sdkwork-tasks
```

Observed failure:

1. contract verification failed because `CronTasksManager.tsx` still referenced only
   `tasks.page.runtime.fields.updatedAt`
2. the failure was exactly the intended gap, proving the test was checking missing behavior rather
   than an unrelated error

### Green

After the minimal UI and locale update:

1. runtime task cards now label the latest task-run event as `lastEventAt`
2. detached runtime task detail now labels the latest task-run event as `lastEventAt`
3. linked task cards inside Task Flow detail now label the latest task-run event as `lastEventAt`
4. Task Flow surfaces continue to use `updatedAt`
5. locale sync passed
6. task contract passed
7. i18n tests passed
8. production build passed
9. full lint/parity/automation verification passed

## Fix Landed

### 1. Task-run surfaces now use the correct operator label

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`

Changes:

1. runtime task board cards now render task-run latest timestamps under
   `tasks.page.runtime.fields.lastEventAt`
2. detached runtime task detail overlay now uses the same `lastEventAt` label
3. linked task cards inside Task Flow detail now also use the same `lastEventAt` label
4. flow cards and flow detail continue using `updatedAt`, preserving upstream semantics

### 2. Locale coverage now distinguishes task-run and flow timing explicitly

Updated:

- `packages/sdkwork-claw-i18n/src/locales/en/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/zh/tasks.json`
- `packages/sdkwork-claw-i18n/src/locales/en.json`
- `packages/sdkwork-claw-i18n/src/locales/zh.json`

Changes:

1. added `tasks.page.runtime.fields.lastEventAt`
2. kept `tasks.page.runtime.fields.updatedAt` for Task Flow surfaces

Implementation note:

1. `zh/tasks.json` required a controlled edit because terminal encoding could corrupt direct
   Unicode insertion
2. the first write path produced `??????`, which was immediately caught by the existing readable-zh
   contract
3. the final fix rewrote the affected value safely and re-synced aggregate locale bundles

### 3. Contract coverage now locks the semantic split

Updated:

- `scripts/sdkwork-tasks-contract.test.ts`

Changes:

1. required the runtime UI to reference `lastEventAt`
2. required English and Chinese runtime locale bundles to define the new field label
3. retained existing Task Flow checks so both sides of the semantic split are covered

## Verification

Fresh commands run in this loop:

```bash
pnpm.cmd check:sdkwork-tasks
pnpm.cmd --filter @sdkwork/claw-i18n sync:locales
pnpm.cmd check:sdkwork-tasks
node --experimental-strip-types packages/sdkwork-claw-i18n/src/index.test.ts
pnpm.cmd build
pnpm.cmd lint
```

Results:

1. first `check:sdkwork-tasks` failed red on the missing `lastEventAt` label
2. locale sync passed
3. second `check:sdkwork-tasks` passed green
4. i18n tests passed
5. production build passed
6. lint passed

Verification feedback:

1. the existing readable-Chinese locale contract caught the transient `??????` regression
   immediately
2. the final `lint` run again exercised architecture, parity, automation, server, desktop,
   docker, and k8s related checks embedded in this workspace

## Outcome

This loop closes a real semantic parity gap without widening the architecture:

1. task runs now communicate upstream `lastEventAt` truthfully
2. Task Flows still communicate upstream `updatedAt` truthfully
3. the runtime UI no longer collapses two different timing concepts into one misleading label

## Remaining Improvement Opportunities

A quick re-scan after this fix did not reveal another equally clear, operator-visible runtime gap
with the same confidence level. The best next candidate, if another loop is needed, is:

1. review whether detached runtime task detail should surface any remaining upstream detail fields
   as dedicated rows beyond the existing summary/title presentation, but only if the field adds
   operational value rather than duplicate noise
