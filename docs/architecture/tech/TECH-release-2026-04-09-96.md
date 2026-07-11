> Migrated from `docs/release/release-2026-04-09-96.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Agent Studio release-2026-04-09-96

## Highlights

- Moved the remaining provider-catalog mutation execution and completion orchestration out of `InstanceDetail.tsx` and into the shared `openClawProviderCatalogMutationSupport` helper.
- Added focused helper coverage plus contract evidence so the page must keep using the shared provider runner boundary while retaining page-owned write authority.
- Re-baselined the current dirty-worktree Step 07 hotspot profile and kept the focused instance-detail verification chain green.

## Attempt Outcome

- Fresh RED in this loop was explicit:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - failed first because `createOpenClawProviderCatalogMutationRunner(...)` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because `InstanceDetail.tsx` still kept inline `completeProviderCatalogMutation(...)`
- Implemented the Step 07 extraction:
  - extended `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts` with `createOpenClawProviderCatalogMutationRunner(...)`
  - rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now builds one injected provider-catalog runner from the shared helper and removes the inline completion/switch cluster
  - extended `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - updated `scripts/sdkwork-instances-contract.test.ts` to enforce the new provider execution boundary and preserve page-side write authority
- Current hotspot profile after the fresh current-worktree re-baseline:
  - `InstanceDetail.tsx`: `1770`
  - `openClawProviderCatalogMutationSupport.ts`: `353`
  - `openClawManagedChannelMutationSupport.ts`: `223`
  - `InstanceDetailSectionContent.tsx`: `215`
  - `InstanceDetailManagedMemorySection.tsx`: `87`
  - `InstanceDetailManagedToolsSection.tsx`: `247`
  - `instanceWorkbenchServiceCore.ts`: `1032`
  - `instanceServiceCore.ts`: `1274`
- `CP07-3` remains open. This loop materially improves the remaining page-side provider orchestration boundary, but it does not claim Step 07 closure.

## Change Scope

- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-provider-catalog-runner-extraction-2026-04-09.md`
- `docs/鏋舵瀯/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-09-96.md`
- `docs/release/releases.json`

## Verification Focus

- RED:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-agentstudio-pc-instances/src/services/openClawProviderCatalogMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
- YELLOW:
  - `pnpm lint`

## Risks And Rollback

- The main Step 07 risk remains future page-side re-growth if provider mutation execution or completion sequencing drifts back into `InstanceDetail.tsx`.
- This loop intentionally does not alter transport selection, Provider Center managed authority, Local Proxy routing, or desktop plugin/runtime boundaries.
- Rollback is limited to the updated provider helper and test, the page rewiring, the contract update, and the matching review / architecture / release writebacks.

