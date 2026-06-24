> Migrated from `docs/review/step-03-instance-workbench-test-contract-alignment-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 03 Instance Workbench Test Contract Alignment

## Scope

- Target blocker: `packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- Goal: remove the next top-of-stack workspace lint blocker by aligning the test helper layer with the current `InstanceWorkbenchService` dependency contracts and `StudioWorkbenchTaskRecord` shape.

## Root Cause

- The local `openClawConfigService` test double still returned a stale partial managed-config snapshot and therefore no longer matched `InstanceWorkbenchServiceDependencies['openClawConfigService']`.
- The test-only default channel definitions were missing the now-required `label` and `placeholder` fields on `OpenClawChannelFieldDefinition`.
- Multiple task fixtures were still authored against the older task contract and omitted `sessionMode` plus `wakeUpMode`.
- Several `openClawGatewayClient` override blocks ended with `as any`, which erased contextual typing for callback parameters such as `args.agentId` and `args.name`.
- Managed config route literals and snapshot literals were duplicated in stale partial forms, so every new shared-contract field caused repeated drift.

## Changes

- Added typed local helpers in `instanceWorkbenchService.test.ts`:
  - `createChannelField(...)`
  - `createManagedConfigSnapshot(...)`
  - `createManagedConfigRoute(...)`
  - `createManagedChannelSnapshots()`
- Re-typed the shared `openClawConfigService` stub to `InstanceWorkbenchServiceDependencies['openClawConfigService']` and switched its default snapshot loader onto the full managed-config helper.
- Rebuilt the default channel definitions so every field now carries the current `key/label/placeholder` contract.
- Updated built-in and live cron-task fixtures to include the current `sessionMode` and `wakeUpMode` requirements.
- Replaced stale managed-config snapshot literals and short config-route literals with typed helpers.
- Removed broad outer `as any` casts from gateway override objects and narrowed the only intentionally malformed task collections to `unknown as LiveTask[]` at the specific return site that needs it for normalization coverage.

## Verification

- `pnpm.cmd lint 2>&1 | Select-String -Pattern 'instanceWorkbenchService\.test\.ts' -Context 0,2`
  - No remaining diagnostics for `instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
  - Passed

## Architecture Writeback

- No `docs/架构/` change was required in this loop.
- Reason: this iteration only repairs test fixtures and local test doubles; it does not alter runtime architecture, package boundaries, transport flow, or OpenClaw authority rules.

## Remaining Frontier

- Workspace lint is still blocked by:
  - `packages/sdkwork-claw-instances/src/services/openClawManagementCapabilities.test.ts`
  - `packages/sdkwork-claw-instances/src/services/openClawProviderWorkspacePresentation.test.ts`

