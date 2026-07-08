> Migrated from `docs/release/release-2026-04-08-80.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-08-80

## Highlights

- Continued the real `Step 07 / CP07-3` page hotspot work by expanding the shared provider catalog runner to cover provider delete and provider-model delete flows.
- Preserved the authority split so `InstanceDetail.tsx` still owns all five real provider catalog write calls, the success/error toast surface, workbench reload, and provider reselection/deselection.
- Re-baselined the current active hotspot profile for this worktree at `InstanceDetail.tsx = 2816`, `instanceWorkbenchServiceCore.ts = 1132`, and `instanceServiceCore.ts = 1431`.

## Attempt Outcome

- Expanded page-facing delete mutation metadata in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.ts`
- Expanded focused helper coverage in:
  - `packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- Rewired provider delete flows into the existing page-owned runner in:
  - `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
- Extended the contract suite so provider delete handlers also stay routed through the shared page runner in:
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
- `docs/release/release-2026-04-08-80.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `pnpm.cmd check:sdkwork-instances`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` is still the dominant page hotspot at a fresh `2816` lines in the current worktree.
- This loop intentionally normalized only the provider delete lifecycle. The remaining standalone provider config save flow is now the next best extraction target inside the page.
- Rollback must revert the delete mutation metadata, the page runner expansion, the helper/contract test updates, and the matching review/architecture/release evidence together; reverting only one side would recreate boundary drift.

