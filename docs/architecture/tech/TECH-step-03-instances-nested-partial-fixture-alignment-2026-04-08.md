> Migrated from `docs/review/step-03-instances-nested-partial-fixture-alignment-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 03 Instances Nested Partial Fixture Alignment

## Scope

- Target blockers:
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.test.ts`
  - `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
- Goal: remove the next `sdkwork-agentstudio-pc-instances` lint blockers caused by stale shallow test-helper typing for nested `StudioInstanceDetailRecord` overrides.

## Root Cause

- Both test files exposed a local `createDetail(...)` helper typed as `Partial<StudioInstanceDetailRecord>`.
- `Partial<T>` only relaxes the top-level properties, so nested overrides such as `instance: { status: 'offline' }` or `lifecycle: { workbenchManaged: false }` were still forced to satisfy the full shared contract.
- The tests were correct semantically, but their helper signatures no longer matched how the fixtures were intentionally authored.

## Changes

- Added a local `DetailOverrides` type in both files that keeps the outer record shallow-partial while making nested `instance`, `config`, and `lifecycle` overrides explicitly `Partial<...>`.
- Kept production logic untouched in:
  - `openClawManagementCapabilities.ts`
  - `openClawProviderWorkspacePresentation.ts`

## Verification

- targeted `pnpm.cmd lint` scan produced no diagnostics for:
  - `openClawManagementCapabilities.test.ts`
  - `openClawProviderWorkspacePresentation.test.ts`
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawManagementCapabilities.test.ts`
  - Passed
- `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderWorkspacePresentation.test.ts`
  - Passed

## Architecture Writeback

- No `docs/架构/` delta was required in this loop.
- Reason: this is a test-helper typing repair only; runtime behavior and OpenClaw capability logic remain unchanged.

## Remaining Frontier

- Workspace lint has advanced beyond the `sdkwork-agentstudio-pc-instances` helper drift and is now headed by broader package blockers including:
  - `packages/sdkwork-agentstudio-pc-channels/src/services/channelService.test.ts`
  - `packages/sdkwork-agentstudio-pc-chat/src/index.ts`
  - `packages/sdkwork-agentstudio-pc-chat/src/services/openclaw/openClawGatewayClient.test.ts`

