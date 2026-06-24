> Migrated from `docs/review/2026-04-06-openclaw-taskservice-backend-workbench-routing-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# OpenClaw TaskService Backend Workbench Routing Hardening

Date: 2026-04-06

Scope:
- `packages/sdkwork-claw-core/src/services/taskService.ts`
- `packages/sdkwork-claw-core/src/services/taskService.test.ts`
- `scripts/run-sdkwork-core-check.mjs`

## Summary

This iteration closed a shared-routing bug in the task layer that still treated
`runtimeKind === "openclaw"` as proof that direct gateway cron APIs were the
authoritative task surface.

That assumption was wrong for the exact deployment modes the current system
review is trying to harden:
- desktop hosted sessions where `detail.workbench` is already available before
  live gateway cron APIs converge
- server, docker, and kubernetes hosted modes where backend-authored workbench
  payloads remain the canonical task surface
- degraded OpenClaw sessions where the backend workbench still exists even
  though direct gateway task calls are unavailable

## Root Cause

Previous behavior mixed two separate truths:
- `getTasks()` could merge or expose backend-authored workbench tasks
- follow-up actions still remembered only `taskId -> instanceId`
- later task actions re-derived authority from the runtime kind and defaulted
  back to direct gateway cron APIs for OpenClaw tasks

That let backend-authored tasks render successfully but misrouted later actions
such as update, clone, run-now, history, status toggle, and delete.

## Implemented Fix

Implemented contract:
- prefer backend/studio task authority whenever `detail.workbench` exists
- fall back to direct OpenClaw gateway task APIs only when the backend
  workbench is absent

Code changes:
- introduced explicit route memory:
  - `taskId -> { instanceId, mode: 'backend' | 'gateway' }`
- `getTasks()` now records source mode per task instead of using one global
  OpenClaw assumption
- `updateTask`, `cloneTask`, `runTaskNow`, `listTaskExecutions`,
  `updateTaskStatus`, and `deleteTask` now branch by remembered route mode
  instead of raw runtime kind

## Regression Coverage

Coverage added and hardened in:
- `packages/sdkwork-claw-core/src/services/taskService.test.ts`

What the regression now freezes:
- backend-authored OpenClaw tasks stay fully operable when the backend
  workbench exists but direct gateway task APIs are absent
- follow-up task actions keep using the same authoritative route that produced
  the task snapshot
- direct gateway routing still applies for gateway-authored task sessions

## Verification

Executed:
- focused workspace-loaded task-service regression via
  `scripts/run-node-typescript-check.mjs`
- `node scripts/run-sdkwork-core-check.mjs`
- `pnpm.cmd check:sdkwork-core`
- `pnpm.cmd lint`

Result:
- all commands exited with code `0`

## Remaining Follow-up

This closed the task-routing split in `sdkwork-claw-core`, but the broader
shared-runtime review still needs:
- launched-session evidence for built-in OpenClaw `online` convergence
- instance-detail console-open and runtime-truth validation
- on-demand file and memory loaders to stop assuming a live gateway whenever
  backend workbench authority already exists

