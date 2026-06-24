> Migrated from `docs/review/step-03-provider-agent-test-contract-alignment-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 03 Provider Agent Test Contract Alignment - 2026-04-08

## 1. Context

- After the previous Step 03 install/settings loop, the next visible workspace lint blockers moved to:
  - `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
  - `packages/sdkwork-claw-agent/src/services/agentInstallService.test.ts`
- Both were test-contract issues rather than production logic regressions.

## 2. Root Cause

- `providerConfigCenterService.test.ts` was hand-assembling `ProviderConfigRecord` fixtures from `createDraft()`.
  That drifted from the shared provider-routing contract after `baseUrl`, normalized `config`, and other record-level required fields became non-optional on the stored record type.
- `agentInstallService.test.ts` had platform and studio stubs that no longer matched the latest infrastructure contracts.
  `PlatformAPI` now requires `showNotification`, and `StudioPlatformAPI` now requires `updateInstanceFileContent` plus `updateInstanceLlmProviderConfig`.

## 3. Changes

- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
  - Added a typed `createRuntimeConfig()` helper that always returns a full `ProviderConfigRecord['config']`.
  - Added a typed `createRecord()` helper that constructs complete `ProviderConfigRecord` fixtures with required normalized fields.
  - Replaced the scattered ad hoc record literals in the apply/list/runtime-metrics tests with `createRecord(...)`.
  - Added the missing `routeId: string` annotation in the local proxy route test stub.
- `packages/sdkwork-claw-agent/src/services/agentInstallService.test.ts`
  - Added `showNotification` to the `PlatformAPI` stub.
  - Added `updateInstanceFileContent` and `updateInstanceLlmProviderConfig` to the `StudioPlatformAPI` stub via passthrough bindings to the original studio bridge.

## 4. Verification

| Command | Result | Note |
| --- | --- | --- |
| `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts` | passed | 15 provider-center regression cases stayed green after fixture normalization |
| `pnpm.cmd lint` targeted check for `providerConfigCenterService.test.ts` | passed | returned `provider-config-center-clean` |
| `node --experimental-strip-types packages/sdkwork-claw-agent/src/services/agentInstallService.test.ts` | passed | 5 agent-install regression cases stayed green after stub alignment |
| `pnpm.cmd lint` targeted check for `agentInstallService.test.ts` | passed | returned `agent-install-clean` |

## 5. Remaining Gaps

- Fresh workspace lint evidence shows the next head blocker has moved to `packages/sdkwork-claw-apps/src/services/appStoreService.test.ts`.
- This loop intentionally did not touch the later chat/community/install/task/instances failures once the current top-of-stack provider/agent contract drift was closed.

