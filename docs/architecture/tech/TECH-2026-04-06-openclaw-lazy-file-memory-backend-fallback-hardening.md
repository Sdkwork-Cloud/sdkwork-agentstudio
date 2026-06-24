> Migrated from `docs/review/2026-04-06-openclaw-lazy-file-memory-backend-fallback-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# OpenClaw Lazy File And Memory Backend Fallback Hardening

Date: 2026-04-06

Scope:
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`

## Summary

This iteration closed a second shared-architecture bug in the OpenClaw
workbench layer: the on-demand file and memory loaders still treated
"agents are present" as enough evidence to probe the live gateway, even when a
fresh backend-authored workbench already carried the authoritative section data.

That made lazy section behavior drift across desktop, server, docker, and
kubernetes hosted modes:
- backend-authored file or memory sections could be ignored
- degraded or backend-only OpenClaw sessions still performed gateway probes
- the UI could appear empty or stale for reasons unrelated to the authoritative
  backend workbench payload

## Root Cause

Before this change:
- `listInstanceFiles(instanceId, agents)` used only `agents.length > 0` to
  decide whether to call `listAgentFiles(...)`
- `listInstanceMemories(instanceId, agents)` always started by probing gateway
  config, doctor memory status, runtime search, and `MEMORY.md` file reads
- neither method reloaded `studioApi.getInstanceDetail(instanceId)` to check
  whether the backend workbench already supplied files or memories
- neither method honored `shouldProbeOpenClawGateway(detail)` before making
  lazy gateway calls

This was the same class of defect as the task-routing bug: runtime kind and
agent presence were standing in for capability truth.

## Implemented Fix

Added a dedicated lazy-load context path:
- `getOpenClawLazySectionContext(instanceId)`

New behavior:
- reload the latest instance detail before lazy file/memory resolution
- if the backend workbench already supplies files, return those first
- if the backend workbench already supplies memories, return those first
- if detail is present but the gateway is not probeable, do not call gateway
  file/memory APIs
- if detail reload fails entirely, preserve the old gateway fallback so lazy
  loading still works in transient detail-fetch failures

## Regression Coverage

Added red regressions in:
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`

What they now prove:
- backend-authored OpenClaw files are returned without touching the live
  gateway file catalog
- backend-authored OpenClaw memory snapshots are returned without touching
  gateway config, `MEMORY.md`, doctor-memory, or runtime-search APIs

## Verification

Executed:
- focused workspace-loaded instances regression via
  `scripts/run-node-typescript-check.mjs`
- `pnpm.cmd check:sdkwork-instances`
- `pnpm.cmd lint`

Result:
- all commands exited with code `0`

## Remaining Follow-up

This closes the lazy file/memory authority split, but the larger review loop
still needs:
- launched-session evidence for built-in OpenClaw startup, websocket reachability,
  and real runtime `online` convergence
- upward validation for instance detail, console-open, notification, and cron
  behavior on top of the hardened shared runtime truth
- the remaining OpenClaw task create/update routing review in the
  instance-workbench layer if tests show the same backend-vs-gateway drift

