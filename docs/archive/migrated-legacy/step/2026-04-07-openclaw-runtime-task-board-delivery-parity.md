# OpenClaw Runtime Task Board Delivery Parity

## Objective

- Continue the OpenClaw parity audit with one narrow, verifiable loop.
- Re-check whether the runtime task board preserves the most operator-relevant fields from upstream
  `tasks.list`.
- Land the smallest truthful fix across `gateway -> core -> shared UI -> contract` without reopening
  broader runtime-board refactors.

## Candidate Review Result

This loop reviewed two nearby candidates before implementation:

1. `scope`
2. runtime-task `deliveryStatus`

Primary upstream evidence:

- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`
- `.cache/bundled-components/upstreams/openclaw/src/tasks/task-domain-views.ts`
- `.cache/bundled-components/upstreams/openclaw/src/tasks/task-registry.types.ts`
- `.cache/bundled-components/upstreams/openclaw/src/commands/tasks.ts`

What the review established:

1. upstream `TaskRunView` includes both `scope` and `deliveryStatus`
2. upstream `tasks.list` gives `Delivery` a first-line column in the summary table
3. upstream `tasks.show` prints:
   - `delivery`
   - `notify`
   - other operational fields
4. upstream does not print `scope` in the human-facing task detail output

Decision:

- reject `scope` for now because the upstream operator-facing surfaces do not currently elevate it
  enough to justify extra local UI noise
- accept `deliveryStatus` because upstream already treats it as core operational state

## Problem Found

Before this loop, the local runtime task board still had a real parity gap:

1. gateway normalization for `tasks.list` did not preserve `deliveryStatus`
2. the shared runtime task board card therefore had no way to display it
3. local operators could not see whether a detached runtime task was still pending delivery, had
   delivered, or had failed downstream

So the problem was not just a missing card row. The field was being dropped at the infrastructure
normalization seam first.

## Design Decision

Keep this loop narrow:

1. extend `OpenClawRuntimeTaskRecord` with `deliveryStatus`
2. preserve `deliveryStatus` inside `normalizeRuntimeTask()`
3. show a compact `Delivery` row in runtime task board cards
4. keep existing locale keys and status formatting behavior
5. do not add `scope` in the same pass

This closes a real operational gap without expanding the board into a full task inspector.

## TDD Record

### Red

Failing expectations were added first in three places:

1. `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
   - expected `listRuntimeTasks()` normalization to preserve `deliveryStatus`
2. `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`
   - expected the shared core seam to keep `deliveryStatus` intact
3. `scripts/sdkwork-tasks-contract.test.ts`
   - expected the shared runtime task board to reference `item.deliveryStatus`

Fresh red evidence:

- `pnpm.cmd check:sdkwork-tasks`
  failed because the shared runtime task board did not yet reference `item.deliveryStatus`

Notes:

1. the package-local infrastructure and core test files are authored in TypeScript but import
   workspace package aliases, so direct `node --experimental-strip-types <file>` execution is not a
   reliable standalone red runner in this workspace
2. the actual missing behavior was still unambiguous because:
   - the shared contract failed
   - `normalizeRuntimeTask()` did not read `deliveryStatus`
   - `OpenClawRuntimeTaskRecord` did not expose it

### Green

After the implementation:

- foundation checks passed
- core checks passed
- task contracts passed
- production build passed
- full workspace lint and parity automation passed

## Fix Landed

### 1. Gateway normalization now keeps runtime-task delivery state

Updated:

- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`

Changes:

1. added `deliveryStatus?: string` to `OpenClawRuntimeTaskRecord`
2. `normalizeRuntimeTask()` now reads and preserves `deliveryStatus`

That closes the infrastructure semantic-loss gap for runtime task board cards.

### 2. Core runtime overview tests now lock the field in the shared seam

Updated:

- `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`

Changes:

1. runtime-task fixtures now include `deliveryStatus`
2. the overview assertion now requires it to survive the shared core surface

### 3. Runtime task board cards now show delivery state

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`
- `scripts/sdkwork-tasks-contract.test.ts`

Changes:

1. runtime task board cards now display `Delivery`
2. the value is formatted with the existing shared status label formatter
3. the task contract now requires the manager to reference `item.deliveryStatus`

This aligns the local runtime task board more closely with the upstream `tasks.list` operator view.

## Verification

Fresh commands run in this loop:

```bash
node scripts/run-sdkwork-foundation-check.mjs
node scripts/run-sdkwork-core-check.mjs
pnpm.cmd check:sdkwork-tasks
pnpm.cmd build
pnpm.cmd lint
```

Results:

- `node scripts/run-sdkwork-foundation-check.mjs`
  passed
- `node scripts/run-sdkwork-core-check.mjs`
  passed
- `pnpm.cmd check:sdkwork-tasks`
  passed
- `pnpm.cmd build`
  passed
- `pnpm.cmd lint`
  passed

Verification feedback:

1. the full lint run again validated architecture boundaries, parity contracts, and multi-mode
   release automation checks for server, desktop, docker, and k8s flows
2. this loop touched only the runtime task board path and did not require locale regeneration

## Outcome

This loop closes another real OpenClaw parity gap:

1. runtime task board cards no longer hide delivery state
2. runtime-task delivery semantics now survive `gateway -> core -> UI`
3. `scope` was reviewed and intentionally rejected for now because the upstream operator-facing
   surfaces do not currently elevate it enough to justify local UI expansion

## Remaining Improvement Opportunities

The next narrow loop should still avoid broad refactoring. Strong candidates now are:

1. re-audit whether runtime task board cards still under-surface `notifyPolicy` or another
   upstream-promoted field compared with the latest OpenClaw task operator surfaces
2. if runtime board parity is exhausted, move to the next OpenClaw module outside task-runtime
   surfaces using the same evidence-driven loop
