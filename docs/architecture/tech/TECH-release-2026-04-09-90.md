> Migrated from `docs/release/release-2026-04-09-90.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-09-90

## Highlights

- Extracted the remaining top `InstanceDetail` hero / action chrome into a dedicated header component, further reducing the page hotspot after the earlier workbench chrome split.
- Added fresh red/green coverage for the new header render boundary and updated the instance contract gate to follow the new page -> header split.
- Re-ran the focused instance-detail verification set, web TypeScript gate, and production build on the current worktree.

## Attempt Outcome

- Fresh RED in this loop was explicit:
  - `pnpm exec tsx packages/sdkwork-claw-instances/src/components/InstanceDetailHeader.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - both failed first because `InstanceDetailHeader.tsx` and the updated header-boundary contract did not exist yet
- Implemented the Step 07 extraction:
  - added `packages/sdkwork-claw-instances/src/components/InstanceDetailHeader.tsx`
  - rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` to delegate the top hero / action chrome to the dedicated component
  - updated `scripts/sdkwork-instances-contract.test.ts` so lifecycle-gating and destructive-action evidence follow the new page -> header boundary
- Current hotspot profile after the extraction:
  - `InstanceDetail.tsx`: `1981`
  - `InstanceDetailHeader.tsx`: `159`
  - `InstanceDetailWorkbenchChrome.tsx`: `159`
  - `instanceDetailWorkbenchPresentation.ts`: `273`
  - `instanceWorkbenchServiceCore.ts`: `1032`
  - `instanceServiceCore.ts`: `1274`
- `CP07-3` remains open. This loop reduces page size again but does not claim Step 07 closure.

## Change Scope

- `packages/sdkwork-claw-instances/src/components/InstanceDetailHeader.tsx`
- `packages/sdkwork-claw-instances/src/components/InstanceDetailHeader.test.tsx`
- `packages/sdkwork-claw-instances/src/components/index.ts`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-header-chrome-extraction-2026-04-09.md`
- `docs/鏋舵瀯/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-09-90.md`
- `docs/release/releases.json`

## Verification Focus

- RED:
  - `pnpm exec tsx packages/sdkwork-claw-instances/src/components/InstanceDetailHeader.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- GREEN:
  - `pnpm exec tsx packages/sdkwork-claw-instances/src/components/InstanceDetailHeader.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
- YELLOW:
  - repo-wide `pnpm lint`

## Risks And Rollback

- The main Step 07 risk remains future page-side re-growth if the header chrome drifts back inline or starts accumulating truth-source logic.
- This loop intentionally does not alter transport selection, Provider Center managed authority, Local Proxy routing, or desktop plugin/runtime boundaries.
- Rollback is limited to the new header component and test, the page rewiring, the contract update, and the matching review / architecture / release writebacks.

