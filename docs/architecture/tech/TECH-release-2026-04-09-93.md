> Migrated from `docs/release/release-2026-04-09-93.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Agent Studio release-2026-04-09-93

## Highlights

- Moved the remaining section router and availability composition out of `InstanceDetail.tsx` and into a dedicated `InstanceDetailSectionContent` component.
- Added focused render coverage for the new router boundary and updated the contract suite so evidence follows the real component ownership boundaries.
- Re-baselined the current dirty-worktree Step 07 hotspot profile and kept the focused instance-detail verification chain green.

## Attempt Outcome

- Fresh RED in this loop was explicit:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.test.tsx`
  - failed first because `InstanceDetailSectionContent.tsx` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the page still kept the section router inline and the component file did not exist
- Implemented the Step 07 extraction:
  - added `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx`
  - moved shared section-availability rendering into `renderInstanceDetailSectionAvailability(...)`
  - rewired `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx` so the page now delegates section switching to the dedicated router component
  - added `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.test.tsx`
  - updated `scripts/sdkwork-instances-contract.test.ts` to enforce the new router boundary and to re-anchor evidence to the real section-content / channels boundaries
- Current hotspot profile after the fresh current-worktree re-baseline:
  - `InstanceDetail.tsx`: `2009`
  - `InstanceDetailSectionContent.tsx`: `222`
  - `InstanceDetailManagedMemorySection.tsx`: `93`
  - `InstanceDetailManagedToolsSection.tsx`: `258`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- `CP07-3` remains open. This loop materially improves the remaining page-side composition boundary, but it does not claim Step 07 closure.

## Change Scope

- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.tsx`
- `packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.test.tsx`
- `packages/sdkwork-agentstudio-pc-instances/src/components/index.ts`
- `packages/sdkwork-agentstudio-pc-instances/src/pages/InstanceDetail.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-section-content-router-extraction-2026-04-09.md`
- `docs/鏋舵瀯/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-09-93.md`
- `docs/release/releases.json`

## Verification Focus

- RED:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- GREEN:
  - `pnpm exec tsx packages/sdkwork-agentstudio-pc-instances/src/components/InstanceDetailSectionContent.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/agentstudio-pc-web lint`
  - `pnpm build`
- YELLOW:
  - repo-wide `pnpm lint`

## Risks And Rollback

- The main Step 07 risk remains future page-side re-growth if section switching, availability routing, or component-boundary evidence drifts back into `InstanceDetail.tsx`.
- This loop intentionally does not alter transport selection, Provider Center managed authority, Local Proxy routing, or desktop plugin/runtime boundaries.
- Rollback is limited to the new section-content component and test, the page rewiring, the contract update, and the matching review / architecture / release writebacks.

