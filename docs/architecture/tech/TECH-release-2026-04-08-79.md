> Migrated from `docs/release/release-2026-04-08-79.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-08-79

## Highlights

- Continued the real `Step 07 / CP07-3` page hotspot work by normalizing provider submit mutation metadata and consolidating provider submit orchestration through one shared page-owned runner.
- Preserved the authority split so `InstanceDetail.tsx` still owns the real `instanceService` write calls, success/error toasts, workbench reload, and dialog dismiss/reset state.
- Re-baselined the current active hotspot profile for this worktree at `InstanceDetail.tsx = 2803`, `instanceWorkbenchServiceCore.ts = 1132`, and `instanceServiceCore.ts = 1431`.

## Attempt Outcome

- Expanded page-facing mutation metadata in:
  - `packages/sdkwork-claw-instances/src/services/openClawProviderDrafts.ts`
- Expanded focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawProviderDrafts.test.ts`
- Rewired the provider submit handlers so create/update flows now share one page-owned runner in:
  - `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- Extended the contract suite so the new page runner boundary stays enforced while write-path authority remains in the page in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 evidence set:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-claw-instances/src/services/openClawProviderDrafts.ts`
- `packages/sdkwork-claw-instances/src/services/openClawProviderDrafts.test.ts`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-79.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` is still the dominant page hotspot at a fresh `2803` lines in the current worktree.
- This loop intentionally normalized only the provider submit orchestration boundary. Provider config save and provider/provider-model delete flows still remain in the page and are the next best decomposition slice.
- Rollback must revert the mutation-kind metadata, the page runner rewiring, the helper/contract test updates, and the matching review/architecture/release evidence together; reverting only one side would recreate boundary drift.

