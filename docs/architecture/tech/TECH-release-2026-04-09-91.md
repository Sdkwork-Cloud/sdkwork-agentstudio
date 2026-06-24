> Migrated from `docs/release/release-2026-04-09-91.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-09-91

## Highlights

- Extracted the remaining `agents` and `llmProviders` section-model assembly cluster from `InstanceDetail.tsx` into a dedicated helper module.
- Added explicit red/green coverage for the new helper boundary and updated the instance contract gate to prevent the section-model object literals from drifting back into the page.
- Re-ran the focused instance-detail verification chain, web TypeScript gate, and production build on the current worktree.

## Attempt Outcome

- Fresh RED in this loop was explicit:
  - `pnpm exec tsx packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.test.tsx`
  - failed first because `instanceDetailSectionModels.ts` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the helper file did not exist and the page still kept the section-model object literals inline
- Implemented the Step 07 extraction:
  - added `packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts`
  - exported `InstanceDetailAgentsSectionProps` for the real helper contract
  - rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` to delegate section-model assembly to the dedicated helper
  - added `packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.test.tsx`
  - updated `scripts/sdkwork-instances-contract.test.ts` to enforce the new page -> section-model helper boundary
- Current hotspot profile after the fresh current-worktree re-baseline:
  - `InstanceDetail.tsx`: `2161`
  - `instanceDetailSectionModels.ts`: `145`
  - `InstanceDetailHeader.tsx`: `162`
  - `InstanceDetailWorkbenchChrome.tsx`: `166`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- `CP07-3` remains open. This loop improves the page-side orchestration boundary and contract coverage, but it does not claim Step 07 closure.

## Change Scope

- `packages/sdkwork-claw-instances/src/components/InstanceDetailAgentsSection.tsx`
- `packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.ts`
- `packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.test.tsx`
- `packages/sdkwork-claw-instances/src/components/index.ts`
- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-section-model-helper-extraction-2026-04-09.md`
- `docs/鏋舵瀯/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-09-91.md`
- `docs/release/releases.json`

## Verification Focus

- RED:
  - `pnpm exec tsx packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- GREEN:
  - `pnpm exec tsx packages/sdkwork-claw-instances/src/components/instanceDetailSectionModels.test.tsx`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
- YELLOW:
  - repo-wide `pnpm lint`

## Risks And Rollback

- The main Step 07 risk remains future page-side re-growth if section-model assembly drifts back inline or starts accumulating truth-source logic.
- This loop intentionally does not alter transport selection, Provider Center managed authority, Local Proxy routing, or desktop plugin/runtime boundaries.
- Rollback is limited to the new helper module and test, the page rewiring, the prop export, the contract update, and the matching review / architecture / release writebacks.

