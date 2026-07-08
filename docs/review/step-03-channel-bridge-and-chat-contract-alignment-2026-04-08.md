# Step 03 Channel Bridge And Chat Contract Alignment

## Scope

- Target blockers:
  - `packages/sdkwork-clawstudio-channels/src/services/channelService.test.ts`
  - `packages/sdkwork-clawstudio-chat/src/index.ts`
  - `packages/sdkwork-clawstudio-chat/src/services/openclaw/openClawGatewayClient.test.ts`

## Root Cause

- `channelService.test.ts` exposed two separate issues:
  - the local `window.localStorage` mock no longer satisfied the browser `Storage` interface expected by TypeScript
  - more importantly, the test revealed a real runtime contract gap: `channelService` writes through `getPlatformBridge().studio`, but the root `StudioPlatformAPI` and `LazyWebStudioPlatform` bridge did not expose the channel write methods already implemented by `WebStudioPlatform`
- `sdkwork-clawstudio-chat/src/index.ts` re-exported `externalModules.d.ts`, but that file was pure ambient declaration text and therefore not a module
- `openClawGatewayClient.test.ts` lost nested request-frame typing in `parseFrame(...)`, so `params.client.id` collapsed to `{}` at compile time

## Changes

- `packages/sdkwork-clawstudio-channels/src/services/channelService.test.ts`
  - upgraded the storage mock to a real `Storage`-shaped object
  - narrowed the mocked `window` holder to a local `unknown`-based global alias so the test can install a minimal window stub without pretending to implement the full DOM `Window`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/contracts/studio.ts`
  - added optional channel write methods to the root studio bridge contract:
    - `setInstanceChannelEnabled`
    - `saveInstanceChannelConfig`
    - `deleteInstanceChannelConfig`
- `packages/sdkwork-clawstudio-infrastructure/src/platform/lazyWebStudio.ts`
  - delegated those optional channel write methods through the lazy bridge to the real `WebStudioPlatform`
  - this closes the runtime gap that previously made `channelService` write paths fail under the default platform bridge
- `packages/sdkwork-clawstudio-chat/src/externalModules.d.ts`
  - added `export {}` so the file is treated as a module and can be re-exported from the package index
- `packages/sdkwork-clawstudio-chat/src/services/openclaw/openClawGatewayClient.test.ts`
  - replaced the overly loose `parseFrame(...)` return type with a typed `ParsedGatewayFrame` helper that preserves nested `params.auth/client/device` structure

## Verification

- targeted `pnpm.cmd lint` scan produced no diagnostics for:
  - `channelService.test.ts`
  - `sdkwork-clawstudio-chat/src/index.ts`
  - `openClawGatewayClient.test.ts`
  - `lazyWebStudio.ts`
  - `contracts/studio.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-channels/src/services/channelService.test.ts`
  - Passed
- `node --experimental-strip-types packages/sdkwork-clawstudio-chat/src/services/openclaw/openClawGatewayClient.test.ts`
  - Passed

## Architecture Writeback

- Added architecture note:
  - `docs/鏋舵瀯/97-2026-04-08-platform-bridge-channel-write-contract.md`
- Reason:
  - channel configuration writes are now explicitly part of the root studio bridge contract for browser-hosted workbench flows
  - lazy platform adapters must forward every published workbench write capability instead of relying on package-local casts

## Remaining Frontier

- Workspace lint is now headed by broader package blockers including:
  - `packages/sdkwork-clawstudio-community/src/services/communityService.test.ts`
  - `packages/sdkwork-clawstudio-dashboard/src/services/dashboardService.test.ts`
  - `packages/removed-install-feature/src/services/installProgressService.test.ts`
