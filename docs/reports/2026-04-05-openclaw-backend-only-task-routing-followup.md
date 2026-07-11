# OpenClaw Backend-Only Task Routing Follow-up

Date: 2026-04-05

Scope:
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`
- backend-authored OpenClaw workbench tasks in desktop, server, docker, and kubernetes hosted modes
- task clone/run/history/status/delete routing after workbench load

## Summary

This follow-up closes a concrete runtime correctness bug in the shared OpenClaw workbench layer.

Before this change, the workbench remembered only `taskId -> instanceId` for OpenClaw tasks. When an OpenClaw instance had a backend-authored workbench snapshot but no usable live gateway task snapshot, later task actions still assumed the task came from the live gateway.

That caused:
- `cloneTask(...)` to call `listWorkbenchCronJobs(...)` and fail
- `runTaskNow(...)` to call `runCronJob(...)` and fail
- `updateTaskStatus(...)` to call `updateCronJob(...)` and fail
- `deleteTask(...)` to call `removeCronJob(...)` and fail
- `listTaskExecutions(...)` to probe gateway history first even when the task was backend-authored

In practice, this breaks backend-only or degraded OpenClaw task management flows even when the backend workbench is otherwise usable.

## Root Cause

Evidence:
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3001`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3054`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3339`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3368`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3406`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3440`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3457`

Previous behavior:
- task routing state only stored instance identity
- merged workbench snapshots did not preserve task source
- action methods later guessed "OpenClaw task = gateway task"

That assumption is false for:
- built-in instances whose backend workbench is available before live gateway cron APIs are ready
- server/docker/kubernetes hosted modes where the backend can project task state even when a live gateway task snapshot is absent
- degraded sessions where gateway task calls fail but backend workbench data still exists

## Implemented Fix

Implemented in:
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:2991`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3209`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3339`

Changes:
- introduced explicit task route state: `taskId -> { instanceId, mode: 'backend' | 'gateway' }`
- backend workbench tasks are now remembered as `mode: 'backend'`
- when both backend and live snapshots exist, task route mode is derived per task id from the live task set instead of using one global assumption
- `cloneTask`, `runTaskNow`, `listTaskExecutions`, `updateTaskStatus`, and `deleteTask` now branch by route mode:
  - `backend` -> `studioApi.*`
  - `gateway` -> `openClawGatewayClient.*`

## Regression Coverage

New regression:
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts:2873`

What it proves:
- a backend-authored OpenClaw task remains fully operable when live gateway task APIs are unavailable
- no gateway task mutation or history method is touched for those backend-authored tasks
- task deletion still clears the runtime mapping after success

## Verification

Executed:
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`

Result:
- all commands exited with code `0`

## Remaining Risks

The following items are still open after this change.

### 1. `createTask(...)` and `updateTask(...)` still infer "OpenClaw = gateway"

Evidence:
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3315`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3325`

Current behavior:
- both methods check only `isOpenClawDetail(detail)`
- any OpenClaw detail still routes directly to gateway mutation APIs

Why this is still risky:
- this can misroute task create/update in backend-authored or degraded OpenClaw sessions where the workbench is available but live gateway task mutation is not

Status:
- not changed in this slice
- should be the next task-routing hardening pass

### 2. on-demand file and memory loaders still assume live gateway availability

Evidence:
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3261`
- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts:3272`

Current behavior:
- `listInstanceFiles(...)` loads OpenClaw file catalog through gateway-backed helpers whenever agents are present
- `listInstanceMemories(...)` probes gateway config, doctor memory status, and semantic memory search directly

Why this is still risky:
- backend-authored workbench sections can exist without a usable live gateway
- files/memory are therefore still exposed to backend-only / degraded-mode failures that look similar to the task bug just fixed

Status:
- source-inspection finding
- needs a separate red-green pass before implementation

## Recommended Next Slice

1. Add failing tests for backend-authored OpenClaw `createTask` and `updateTask` when live gateway task mutation is unavailable.
2. Decide and freeze the routing contract for instance-scoped task creation:
   - authoritative backend mutation
   - gateway-first with explicit fallback
   - or capability-driven selection
3. Add failing tests for backend-only file and memory loading paths.
4. Introduce the same `backend | gateway` source-tracking discipline for other on-demand OpenClaw workbench sections if the tests prove they need it.
