> Migrated from `docs/release/release-2026-04-08-73.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Continued the real `Step 07` service hotspot decomposition by moving OpenClaw provider workbench shaping into a dedicated helper module.
- Realigned the `sdkwork-instances` contract suite and service barrel to the new helper-owned boundary for managed-provider mapping, live provider mapping, provider matching, and final workbench provider composition.
- Reduced the recorded `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts` hotspot from the prior `2462`-line baseline to a fresh `2379` lines while keeping OpenClaw authority unchanged.

## Attempt Outcome

- Added dedicated helper ownership in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.ts`
- Added focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.test.ts`
- Rewired the workbench core so managed-provider mapping, live provider mapping, provider id matching, and final merged provider composition no longer live inline in:
  - `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`
- Updated the service barrel so the new provider helper boundary stays consumable from the package root in:
  - `packages/sdkwork-clawstudio-instances/src/services/index.ts`
- Extended the contract suite so the new helper boundary stays enforced in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 evidence set:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.test.ts`
- `packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchServiceCore.ts`
- `packages/sdkwork-clawstudio-instances/src/services/index.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-73.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawTaskNormalization.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawRuntimeMemorySupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderConfigPatch.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigPathFallback.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawFilePathSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawChannelWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentWorkbenchSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` is still a `2553`-line page hotspot and `instanceWorkbenchServiceCore.ts` still remains above closure size at `2379` lines.
- The extraction intentionally moved pure helper logic only. Gateway selection, studio bridge routing, backend truth-source selection, and page-owned side effects remain where they were.
- Rollback must revert the new helper module, the service-core import rewiring, the service-barrel export change, the contract assertions, and the matching review/architecture/release evidence together; reverting only one side would recreate boundary drift.

