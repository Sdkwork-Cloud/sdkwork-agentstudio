# OpenClaw Task Flow Detail-Surface Parity

## Objective

- Continue the OpenClaw upgrade review with one narrow, verifiable loop.
- Compare the current Studio task runtime board against the latest upstream `tasks.flow.show`
  surface.
- Land the smallest real fix that exposes official Task Flow detail data in Studio without
  inventing unsupported fields from `tasks.flow.list`.

## Upstream Review Result

This loop rechecked the bundled upstream sources instead of inferring the detail shape from the
existing list board.

Primary upstream evidence:

- `.cache/bundled-components/upstreams/openclaw/src/tasks/task-domain-views.ts`
- `.cache/bundled-components/upstreams/openclaw/src/commands/flows.ts`
- `.cache/bundled-components/upstreams/openclaw/src/plugins/runtime/task-domain-types.ts`

What upstream currently establishes:

1. `tasks.flow.list` is the canonical list surface and maps to `TaskFlowView`
2. `tasks.flow.show` / `flows show` returns the richer `TaskFlowDetail`
3. `TaskFlowDetail` extends the list view with:
   - `state`
   - `wait`
   - `blocked`
   - linked `tasks`
   - `taskSummary`
4. CLI inspection resolves detail by `lookup`

That boundary mattered because the current Studio app already showed list data, but it had no
truthful way to inspect detail-only fields.

## Architecture Problem Found

Before this loop, the local architecture had a clear gap across all three layers:

1. infrastructure already knew the official method mapping for `tasks.flow.show`
2. but `openClawGatewayClient` did not expose a wrapper for it
3. `taskRuntimeService` could only load task-flow lists, not detail
4. `CronTasksManager` had no user path to inspect official Task Flow detail

That meant the Studio runtime board could show the latest list surface, but it still could not
reach the official inspection surface for:

- orchestration state payload
- wait payload
- blocked summary
- linked task runs
- aggregate task summary

## Design Decision

The local model already used `OpenClawTaskFlowRecord.state` as the human-readable flow status
(`running`, `waiting`, `blocked`, and so on).

Upstream detail also exposes a separate `state` JSON payload. Reusing the same field name locally
would have created a semantic collision.

So the local detail model now uses:

- `state` for the flow status string
- `statePayload` for detail-only structured state
- `waitPayload` for detail-only structured wait metadata

This keeps the list board stable while still preserving the upstream detail payload honestly.

## TDD Record

### Red

Three focused red steps were added first:

1. `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
   - expected a new `getTaskFlowDetail(instanceId, lookup)` wrapper
   - expected the official `tasks.flow.show` bridge to send `{ lookup }`
   - expected normalization of `state / wait / blocked / tasks / taskSummary`
2. `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`
   - expected OpenClaw detail delegation
   - expected non-OpenClaw instances to skip detail loading cleanly
3. `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
   - expected pure helpers for structured payload summaries
   - expected blocked summary formatting
   - expected aggregate task-summary formatting

Fresh red evidence:

- `node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
  failed because the new helper exports did not exist yet
- `node scripts/run-sdkwork-core-check.mjs`
  failed because `taskRuntimeService.getTaskFlowDetail` did not exist yet
- `node scripts/run-sdkwork-foundation-check.mjs`
  failed because `openClawGatewayClient.getTaskFlowDetail` did not exist yet

### Green

After the implementation:

- the new helper tests passed
- core service tests passed
- foundation checks passed with the new gateway wrapper
- the tasks contract gate passed with the new runtime detail UI wiring

## Fix Landed

### 1. Infrastructure now exposes the official detail surface

Updated:

- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`

Changes:

1. added `OpenClawTaskFlowDetailRecord`
2. added `OpenClawTaskFlowLinkedTaskRecord`
3. added `OpenClawTaskFlowTaskSummary`
4. added `getTaskFlowDetail(instanceId, lookup)`
5. normalized `tasks.flow.show` into:
   - status string
   - structured `statePayload`
   - structured `waitPayload`
   - blocked metadata
   - linked tasks
   - aggregate task summary

The wrapper uses the official method bridge and sends:

```json
{
  "lookup": "<flow lookup or flow id>"
}
```

### 2. Core now exposes a truthful detail lookup seam

Updated:

- `packages/sdkwork-claw-core/src/services/taskRuntimeService.ts`
- `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`

Changes:

1. added `getTaskFlowDetail(instanceId, lookup)`
2. delegated detail loading only for OpenClaw runtimes
3. returned `null` for non-OpenClaw instances instead of pretending the surface exists

### 3. Commons gained pure helpers for detail presentation

Updated:

- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.ts`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`

New pure helpers:

- `formatTaskFlowDetailPayload`
- `getTaskFlowBlockedSummary`
- `formatTaskFlowTaskSummary`

These keep the detail UI logic small and testable instead of embedding ad hoc formatting rules in
the React component.

### 4. Task runtime UI now provides a real detail inspection path

Updated:

- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`
- `scripts/sdkwork-tasks-contract.test.ts`

Behavior changes:

1. each Task Flow card now exposes a `Details` action
2. clicking the action opens an overlay that loads official detail data through
   `taskRuntimeService.getTaskFlowDetail`
3. the overlay shows:
   - flow summary and live status
   - current step, notify policy, owner, and timestamps
   - blocked summary
   - aggregate task summary
   - state payload summary plus raw JSON
   - wait payload summary plus raw JSON
   - linked task list from the official detail surface

The tasks contract gate now statically verifies that the shared manager is wired to the new
detail surface instead of only listing flows.

## Files Updated In This Loop

- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.ts`
- `packages/sdkwork-claw-infrastructure/src/services/openClawGatewayClient.test.ts`
- `packages/sdkwork-claw-core/src/services/taskRuntimeService.ts`
- `packages/sdkwork-claw-core/src/services/taskRuntimeService.test.ts`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.ts`
- `packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
- `packages/sdkwork-claw-commons/src/components/CronTasksManager.tsx`
- `scripts/sdkwork-tasks-contract.test.ts`

## Verification

Fresh commands run in this loop:

```bash
node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts
node scripts/run-sdkwork-core-check.mjs
node scripts/run-sdkwork-foundation-check.mjs
pnpm.cmd check:sdkwork-tasks
pnpm.cmd build
```

Results:

- `node --experimental-strip-types packages/sdkwork-claw-commons/src/components/taskRuntimeFlowMeta.test.ts`
  passed
- `node scripts/run-sdkwork-core-check.mjs`
  passed
- `node scripts/run-sdkwork-foundation-check.mjs`
  passed
- `pnpm.cmd check:sdkwork-tasks`
  passed
- `pnpm.cmd build`
  did not reach application compilation because the environment ran out of disk space while pnpm
  was linking Vite files into `node_modules`

The build blocker was:

```text
ENOSPC: no space left on device
```

This was an environment failure, not a runtime-detail regression.

## Review Outcome

This loop closes the clearest remaining OpenClaw task-flow parity gap after list-surface alignment:

- list board parity already existed
- detail inspection parity did not
- the local app now reaches the official detail surface instead of fabricating it from list data

## Remaining Improvement Opportunities

The next worthwhile loop should stay narrow again. The best candidates are:

1. add locale-backed copy for the new detail overlay instead of the current hard-coded English
   inspection labels
2. add a true component-level render test for the Task Flow detail overlay once the frontend build
   environment is stable again
3. re-run full `pnpm.cmd build` after disk space is recovered, because this loop could not verify
   the final browser bundle end to end
