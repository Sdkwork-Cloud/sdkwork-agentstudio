> Migrated from `docs/release/release-2026-04-09-92.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-09-92

## Highlights

- Moved the remaining `memory` and `tools` section composition out of `InstanceDetail.tsx` and into the dedicated managed section components.
- Added focused managed-memory and managed-tools render coverage, and strengthened the instance contract gate so those page-local composition literals cannot drift back inline.
- Re-baselined the current dirty-worktree Step 07 hotspot profile and kept the focused instance-detail verification chain green.

## Attempt Outcome

- Implemented the Step 07 extraction:
  - `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedMemorySection.tsx` now assembles the memory section props and loading / empty-state routing
  - `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedToolsSection.tsx` now assembles the managed tool panels, the tools section props, and the final runtime-surface / empty-state gating
  - `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` now delegates those two composition responsibilities to the dedicated managed section components instead of keeping the literals inline
  - added `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedMemorySection.test.tsx`
  - added `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedToolsSection.test.tsx`
  - updated `scripts/sdkwork-instances-contract.test.ts` so the page can no longer keep `memorySectionProps`, managed-tool panel prebuilds, or `toolsSectionProps` inline, and so the row-shell evidence follows `InstanceDetailToolsSection.tsx`
- Current hotspot profile after the fresh current-worktree re-baseline:
  - `InstanceDetail.tsx`: `2102`
  - `InstanceDetailManagedMemorySection.tsx`: `93`
  - `InstanceDetailManagedToolsSection.tsx`: `258`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- `CP07-3` remains open. This loop materially improves the remaining page-side orchestration boundary, but it does not claim Step 07 closure.

## Change Scope

- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedMemorySection.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedToolsSection.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedMemorySection.test.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailManagedToolsSection.test.tsx`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-managed-memory-tools-section-composition-2026-04-09.md`
- `docs/鏋舵瀯/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-09-92.md`
- `docs/release/releases.json`

## Verification Focus

- GREEN:
  - `pnpm exec tsx packages/sdkwork-claw-instances/src/components/InstanceDetailManagedMemorySection.test.tsx`
  - `pnpm exec tsx packages/sdkwork-claw-instances/src/components/InstanceDetailManagedToolsSection.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
- YELLOW:
  - repo-wide `pnpm lint`

## Risks And Rollback

- The main Step 07 risk remains future page-side re-growth if the page starts prebuilding section props or managed panels inline again.
- This loop intentionally does not alter transport selection, Provider Center managed authority, Local Proxy routing, or desktop plugin/runtime boundaries.
- Rollback is limited to the two managed section components and their tests, the page rewiring, the contract update, and the matching review / architecture / release writebacks.

