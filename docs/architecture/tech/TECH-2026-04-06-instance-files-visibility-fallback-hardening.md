> Migrated from `docs/review/2026-04-06-instance-files-visibility-fallback-hardening.md` on 2026-06-24.
> Owner: SDKWork maintainers

# 2026-04-06 Instance Files Visibility Fallback Hardening

## Scope

This iteration closes a real UI/workbench correctness gap behind the user-reported symptom:

- instance detail file lists appearing empty
- backend-authored or built-in file snapshots existing, but the file panel still rendering no explorer entries

## Root Cause

The file explorer in `InstanceFilesWorkspace` was using instance-mode filtering that required a valid agent context before any files became visible:

- instance mode resolved `contextAgent` from `selectedAgentId`
- `visibleFiles` was then computed from `getAgentScopedWorkbenchFiles(props.files, contextAgent)`
- if `selectedAgentId` was still `null`, stale, or the workbench carried files without agent snapshots, `contextAgent` became `null`
- once `contextAgent` was `null`, the file list collapsed to `[]`

This was a real product gap, not just a hypothetical edge case. The existing regression corpus already models file-bearing workbench snapshots whose `agents` array is empty, for example built-in/backend-authored file detail coverage in:

- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`

That means the UI was stricter than the data contract: it required agent context even when the workbench already had valid file entries.

## Changes Landed

### 1. Added an explicit instance-files visibility fallback

File:

- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceFileWorkbench.ts`

Change:

- added `getInstanceVisibleWorkbenchFiles(files, agent)`
- when `agent` is available, it keeps the existing scoped behavior
- when `agent` is unavailable, it now returns the already-known file list instead of collapsing to an empty explorer

### 2. Hardened instance-mode file workspace agent resolution

File:

- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceFilesWorkspace.tsx`

Change:

- instance-mode `contextAgent` now falls back to the first available agent when the selected id has not settled yet
- `scopeKey` now follows the resolved `contextAgent`
- instance-mode file visibility now routes through the new fallback helper

Result:

- if the instance has a valid selected agent, files stay agent-scoped as before
- if the selected agent is temporarily unavailable or missing, the workspace no longer renders a false-empty file panel
- if the workbench has file snapshots but no agent snapshot, the explorer still shows the available files instead of hiding them

## Regression Test Added

File:

- `packages/sdkwork-agentstudio-pc-instances/src/services/instanceFileWorkbench.test.ts`

New test:

- `getInstanceVisibleWorkbenchFiles falls back to all files when file snapshots exist before agent context is available`

This test proves the exact missing contract:

- file snapshots exist
- agent context is `null`
- visible files must still render instead of collapsing to `[]`

## Verification Evidence

The following command was run after the fix:

- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceFileWorkbench.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/instanceWorkbenchService.test.ts`
- `pnpm.cmd check:sdkwork-instances`

It passed and now covers:

- agent-scoped file filtering
- raw/normalized OpenClaw file id compatibility
- Windows path-case handling
- file tab state reconciliation
- remote file body lazy loading
- new no-agent fallback visibility behavior

## Additional Verification Note

An extra frontend build check was also attempted:

- `pnpm.cmd --filter @sdkwork/agentstudio-pc-web build`

That build is currently blocked by an environment/workspace dependency access error:

- `EPERM: operation not permitted, open node_modules/.pnpm/@rolldown+pluginutils@1.0.0-rc.12/.../filter-vite-plugins.js`

The same file is unreadable from PowerShell `Get-Content`, which indicates a local dependency permission/file-lock problem in `node_modules`, not a TypeScript or runtime regression introduced by this iteration.

## Impact

This closes a user-visible correctness gap in instance detail:

1. file lists no longer depend on agent state being fully hydrated before any explorer entry can appear
2. built-in or backend-authored file snapshots are no longer hidden by a renderer-side null-agent assumption
3. the file workbench becomes more tolerant of startup races and partial snapshots while keeping existing agent-scoped behavior for normal OpenClaw flows

## Remaining Gaps

This pass improves visibility, but it does not yet finish the full workbench/file matrix. The next follow-ups are:

1. run the broader `sdkwork-instances` regression suite after this fix
2. validate that agent detail and agent-scoped file tabs still behave correctly after lazy file reloads
3. clear the local `node_modules` permission/file-lock issue so a full frontend build can be re-run
4. keep checking built-in OpenClaw startup truthfulness so the explorer is not driven by stale runtime metadata

