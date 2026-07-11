> Migrated from `docs/review/step-03-install-bootstrap-and-recommendation-contract-alignment-2026-04-08.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Step 03 Install Bootstrap And Recommendation Contract Alignment

## Scope

- Target blockers:
  - `packages/removed-install-feature/src/services/installBootstrapService.test.ts`
  - `packages/removed-install-feature/src/services/installRecommendationService.test.ts`

## Root Cause

- `installBootstrapService.test.ts` had drifted across several current contracts at once:
  - `openClawBootstrapApi.loadBootstrapData(...)` now accepts an optional install/assessment input object
  - `openClawConfigApi.readConfigSnapshot(configPath)` now returns both `providerSnapshots` and `channelSnapshots`
  - bootstrap apply/save/initialize stubs were still typed as generic `Record<string, unknown>` instead of the current OpenClaw and provider-routing inputs/results
  - one behavioral assertion still assumed the `sdkwork` provider channel would disappear entirely, while the current implementation preserves the channel catalog and only remaps managed providers onto protocol-native install channels
- `installRecommendationService.test.ts` still built a partial assessment object that no longer satisfied `InstallChoiceAssessmentState` because the result contract now expects the full `InstallAssessmentResult` surface

## Changes

- `packages/removed-install-feature/src/services/installBootstrapService.test.ts`
  - imported and used the current OpenClaw bootstrap/config/provider-routing types
  - added typed helpers for:
    - bootstrap providers
    - channel snapshots
    - bootstrap data
    - config snapshots
    - apply-configuration results
    - provider-routing records
    - initialize-instance results
  - updated all service doubles to the current function signatures
  - corrected the SDKWork remap assertion to verify `providerCount === 0` on the preserved `sdkwork` channel instead of asserting the channel is removed
- `packages/removed-install-feature/src/services/installRecommendationService.test.ts`
  - rebuilt `createAssessment(...)` onto a typed `AssessmentOverrides` helper that materializes the full `InstallAssessmentResult` contract while still allowing partial runtime overrides

## Verification

- `node --experimental-strip-types packages/removed-install-feature/src/services/installBootstrapService.test.ts`
  - Passed
- `node --experimental-strip-types packages/removed-install-feature/src/services/installRecommendationService.test.ts`
  - Passed
- targeted lint scan for:
  - `installBootstrapService.test.ts`
  - `installRecommendationService.test.ts`
  - returned `targeted-clean`

## Architecture Writeback

- No `docs/鏋舵瀯/` delta was required because this loop only repairs install-package test fixtures and assertion expectations; runtime behavior and package boundaries are unchanged.

## Remaining Frontier

- Workspace lint is now headed by:
  - `packages/removed-install-feature/src/services/openClawBootstrapService.test.ts`
  - `packages/sdkwork-agentstudio-pc-instances/src/services/agentWorkbenchService.test.ts`
  - `packages/sdkwork-agentstudio-pc-instances/src/services/index.ts`

