> Migrated from `docs/release/release-2026-04-09-94.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-09-94

## Highlights

- Moved the remaining provider-catalog mutation-request construction out of `InstanceDetail.tsx` and into a dedicated `openClawProviderCatalogMutationSupport` helper.
- Added focused helper coverage plus contract evidence so the page must keep using the shared provider-catalog request builder boundary.
- Re-baselined the current dirty-worktree Step 07 hotspot profile and kept the focused instance-detail verification chain green.

## Attempt Outcome

- Fresh RED in this loop was explicit:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - failed first because `openClawProviderCatalogMutationSupport.ts` did not exist yet
- Implemented the Step 07 extraction:
  - added `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`
  - rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now builds provider-catalog mutation requests through the dedicated helper and keeps the real runner in-page
  - added `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - updated `packages/sdkwork-clawstudio-instances/src/services/index.ts`
  - updated `scripts/sdkwork-instances-contract.test.ts` to enforce the new provider-catalog request boundary and preserve page-side write authority
- Current hotspot profile after the fresh current-worktree re-baseline:
  - `InstanceDetail.tsx`: `1972`
  - `openClawProviderCatalogMutationSupport.ts`: `241`
  - `InstanceDetailSectionContent.tsx`: `222`
  - `InstanceDetailManagedMemorySection.tsx`: `93`
  - `InstanceDetailManagedToolsSection.tsx`: `258`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- `CP07-3` remains open. This loop materially improves the remaining page-side provider orchestration boundary, but it does not claim Step 07 closure.

## Change Scope

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
- `packages/sdkwork-clawstudio-instances/src/services/index.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-provider-catalog-mutation-request-extraction-2026-04-09.md`
- `docs/鏋舵瀯/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-09-94.md`
- `docs/release/releases.json`

## Verification Focus

- RED:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
- YELLOW:
  - `pnpm lint`

## Risks And Rollback

- The main Step 07 risk remains future page-side re-growth if provider mutation request construction drifts back into `InstanceDetail.tsx`.
- This loop intentionally does not alter transport selection, Provider Center managed authority, Local Proxy routing, or desktop plugin/runtime boundaries.
- Rollback is limited to the new provider-catalog helper and test, the page rewiring, the service-barrel export, the contract update, and the matching review / architecture / release writebacks.

