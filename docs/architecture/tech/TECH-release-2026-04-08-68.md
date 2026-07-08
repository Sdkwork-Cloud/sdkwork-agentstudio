> Migrated from `docs/release/release-2026-04-08-68.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Continued the real `Step 07` hotspot decomposition by moving remote OpenClaw provider patch construction out of `instanceServiceCore.ts` into a dedicated helper module.
- Removed duplicate fallback managed-config path resolution from both service cores by centralizing it in one shared helper.
- Reduced the service-core frontier on fresh measurement:
  - `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`: `1663 -> 1431`
  - `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`: `3818 -> 3797`

## Attempt Outcome

- Added dedicated helper ownership in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.ts`
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.test.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.test.ts`
- Rewired the two service cores so pure helper logic no longer lives inline in:
  - `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`
  - `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`
- Tightened the contract suite so the provider patch builders and fallback config-path resolver stay outside the service-core hotspot files:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 evidence set:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.test.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.test.ts`
- `packages/sdkwork-clawstudio-instances/src/services/instanceServiceCore.ts`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-68.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `pnpm.cmd check:sdkwork-instances`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` still holds the provider submit orchestration hotspot at `2792` lines, and `instanceWorkbenchServiceCore.ts` remains the largest service hotspot at `3797` lines.
- The extraction intentionally moves pure helper logic only. Authority checks, studio bridge routing, gateway routing, Provider Center constraints, and OpenClaw runtime truth-source behavior remain in the same cores as before.
- Rollback must revert the new helper modules, the two core rewires, the contract assertions, and the matching review/architecture/release evidence together; reverting only one side would reintroduce hotspot drift and duplicated fallback logic.

