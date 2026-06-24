> Migrated from `docs/review/step-03-install-settings-test-types-and-core-node-root-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 03 Install Settings Test Types And Core Node Root - 2026-04-08

## 1. Context

- After the earlier Step 03 market and install package contract loops, workspace lint still reported two `TS2352` blockers:
  - `packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
  - `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
- The goal of this loop was to remove those type drifts first, then continue verification until the next real blocker surfaced.

## 2. Root Cause

- Both tests were collecting real service inputs through `Record<string, unknown>` arrays. TypeScript now treats those casts as invalid structural conversions because the underlying inputs are narrower service contracts, not generic record bags.
- After fixing the casts, `providerConfigCenterService.test.ts` still failed under `node --experimental-strip-types`. That failure was not in the test logic itself: the Node entry for `@sdkwork/claw-core` resolved through `src/node.ts`, which exported `src/services/node/index.ts`, and that node-only service barrel was missing `openClawProviderRuntimeConfigService.ts`.

## 3. Changes

- `packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
  - Introduced `StudioCreateInstanceInput`, `StudioCreateInstanceRecord`, and `StudioUpdateInstanceInput` aliases derived from `StudioPlatformAPI`.
  - Re-typed the `instanceState.created` and `instanceState.updated` collectors to those real contract types.
  - Removed the `Record<string, unknown>` casts from `createInstance` and `updateInstance`.
- `packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts`
  - Imported `ProviderConfigCenterServiceOverrides`.
  - Derived `SaveProviderRoutingRecordInput` from the `providerRoutingApi.saveProviderRoutingRecord` override signature.
  - Re-typed `saveCalls` to that exact input type and removed the remaining cast.
- `packages/sdkwork-claw-core/src/services/node/index.ts`
  - Added `export * from '../openClawProviderRuntimeConfigService.ts';`
  - This restores parity between browser-root and Node-root consumption for the provider routing/runtime config helpers already used by `providerConfigCenterService.ts`.

## 4. Verification

| Command | Result | Note |
| --- | --- | --- |
| `pnpm.cmd lint` targeted scan for `openClawBootstrapService.test.ts`, `providerConfigCenterService.test.ts`, and `TS2352` | passed | returned `targeted-clean`; the Step 03 cast diagnostics are gone |
| `node --experimental-strip-types packages/removed-install-feature/src/services/openClawBootstrapService.test.ts` | passed | install/bootstrap regression slice still green after the type cleanup |
| `node --experimental-strip-types packages/sdkwork-claw-settings/src/services/providerConfigCenterService.test.ts` | passed | settings/provider routing slice now runs under the Node root export path |

## 5. Remaining Gaps

- This loop only closes the Step 03 install/settings type-cast and Node-root contract blockers.
- It does not claim that full workspace lint is green; remaining non-`TS2352` failures should be handled in later loops.
- The separate `sdkwork-claw-instances` contract track, including the `@monaco-editor/react` dependency assertion, remains open and was intentionally not mixed into this fix.

