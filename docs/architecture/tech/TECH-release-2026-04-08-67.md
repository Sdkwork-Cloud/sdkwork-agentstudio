> Migrated from `docs/release/release-2026-04-08-67.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Continued the real `Step 07` frontier by moving provider dialog draft types and draft factory helpers out of `InstanceDetail.tsx` into `openClawProviderDrafts.ts`.
- Centralized provider and provider-model post-save success side effects through one page-owned `completeProviderCatalogMutation` runner while keeping actual OpenClaw write-path invocation in the page.
- Reduced the fresh current-worktree `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` hotspot from `2811` to `2792` lines.

## Attempt Outcome

- Extended provider helper ownership in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`
- Added focused helper coverage for the migrated draft factories in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- Rewired the page to consume shared provider draft factories and a shared provider success runner in:
  - `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
- Tightened the contract suite so provider submit handlers must keep using the shared provider success runner and stable reset callbacks:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 evidence set:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-67.md`
- `docs/release/releases.json`

## Verification Focus

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

- `Step 07` is still not closable. `CP07-3` remains open because `handleSubmitProviderDialog` and `handleSubmitProviderModelDialog` still dominate the page orchestration frontier, and the two service-core hotspots remain at `3818` and `1663` lines.
- The extraction intentionally changes ownership shape only. OpenClaw provider writes still go through the existing `instanceService` paths constrained by `webStudio.test.ts`, `instanceService.test.ts`, `openClawManagementCapabilities.ts`, and `openClawProviderWorkspacePresentation.ts`.
- Rollback must revert the provider helper expansion, the page rewiring, the contract assertions, and the matching review/architecture/release evidence together; reverting only one side would reintroduce decomposition drift.

