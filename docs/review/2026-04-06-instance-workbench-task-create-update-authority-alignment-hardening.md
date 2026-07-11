# 2026-04-06 Instance Workbench Task Create/Update Authority Alignment Hardening

## Problem

The previous OpenClaw task-routing hardening closed the follow-up action split in
`packages/sdkwork-agentstudio-pc-core/src/services/taskService.ts`, and
`packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`
already routed these actions correctly for existing tasks:

- `cloneTask(...)`
- `runTaskNow(...)`
- `listTaskExecutions(...)`
- `updateTaskStatus(...)`
- `deleteTask(...)`

But the same instances workbench service still handled the two write-entry
paths below with an older rule:

- `createTask(instanceId, payload)`
- `updateTask(instanceId, id, payload)`

Those methods still treated `runtimeKind === "openclaw"` as enough evidence to
call direct gateway cron APIs, even when `detail.workbench` already existed and
was the authoritative backend surface.

## Root Cause

This was a partial migration bug inside one service:

- existing-task actions had already moved onto backend-vs-gateway route truth
- create/update task entrypoints were still using the old
  `isOpenClawDetail(detail)` shortcut

That reopened the same authority split the system review has been closing
elsewhere:

- backend-authored OpenClaw workbench tasks could render correctly
- but creating or editing tasks from the instance detail page could still jump
  to direct gateway cron APIs
- the bug was especially risky in built-in desktop sessions where backend
  workbench data is present before direct gateway write surfaces are guaranteed

## Implemented Fix

Implemented contract:

- if `detail.workbench` exists, task create/update must stay on the backend
  studio bridge
- direct gateway cron mutation is allowed only when the instance is OpenClaw
  and the backend workbench is absent

Code changes:

- added a local `hasWorkbench(detail)` helper in
  `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchServiceCore.ts`
- changed `createTask(...)` to use the gateway only for OpenClaw instances
  without backend workbench authority
- changed `updateTask(...)` to use the same rule

## Regression Coverage

Added focused coverage in:

- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`

The new regression freezes this behavior:

- backend-authored built-in OpenClaw workbench sessions must route task creation
  through `studioApi.createInstanceTask(...)`
- backend-authored built-in OpenClaw workbench sessions must route task updates
  through `studioApi.updateInstanceTask(...)`
- direct gateway methods must stay unused in that state

## Gate Hardening

This iteration also upgraded the default instances gate:

- added `scripts/run-sdkwork-instances-check.mjs`
- updated `check:sdkwork-instances` in `package.json`

The standard gate now runs focused instances source tests before the existing
contract test, including:

- `instanceWorkbenchService.test.ts`
- `instanceActionCapabilities.test.ts`
- `instanceFileWorkbench.test.ts`
- `openClawManagementCapabilities.test.ts`
- `openClawProviderWorkspacePresentation.test.ts`

## Verification

Executed in this iteration:

- `node --input-type=module -e "import('./scripts/run-node-typescript-check.mjs').then(({ runNodeTypeScriptChecks }) => runNodeTypeScriptChecks(['packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts']))"`
- `node scripts/run-sdkwork-instances-check.mjs`
- `pnpm.cmd check:sdkwork-instances`

## Outcome

Closed for this slice:

- instance-detail task create/update no longer disagree with the already-fixed
  backend-vs-gateway task route truth
- built-in or backend-authored OpenClaw workbench sessions no longer misroute
  task mutations to direct gateway cron APIs
- the instances verification gate now covers this authority rule by default

Still open after this slice:

- launched-session validation for notification, cron UI, proxy router, and
  instance-detail behavior on top of the aligned task authority
- packaged desktop startup smoke with a live built-in OpenClaw runtime outside
  the current contract/source-test environment
