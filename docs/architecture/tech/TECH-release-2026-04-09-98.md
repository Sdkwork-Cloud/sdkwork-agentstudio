> Migrated from `docs/release/release-2026-04-09-98.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-09-98

## Highlights

- Moved the remaining shared agent create/update/delete mutation execution out of `InstanceDetail.tsx` and into the dedicated `openClawAgentMutationSupport` helper.
- Added focused helper coverage plus contract evidence so the page must keep using the shared agent CRUD runner boundary while retaining validation, write authority, and page-owned cleanup state.
- Re-baselined the current dirty-worktree Step 07 hotspot profile and kept the focused instance-detail verification chain, web TypeScript gate, and production build green.

## Attempt Outcome

- Fresh RED in this loop was explicit:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.test.ts`
  - failed first because `openClawAgentMutationSupport.ts` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the shared agent mutation helper did not exist yet
- Implemented the Step 07 extraction:
  - added `packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.ts`
  - rewired `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx` so the page now builds one injected agent CRUD runner from the shared helper and removes the inline create/update/delete execution cluster from the agent handlers
  - added `packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.test.ts`
  - updated `packages/sdkwork-clawstudio-instances/src/services/index.ts`
  - updated `scripts/sdkwork-instances-contract.test.ts` to enforce the new agent mutation boundary and preserve page-side write authority
- Current hotspot profile after the fresh current-worktree re-baseline:
  - `InstanceDetail.tsx`: `1938`
  - `openClawAgentMutationSupport.ts`: `65`
  - `openClawManagedConfigMutationSupport.ts`: `39`
  - `openClawProviderCatalogMutationSupport.ts`: `373`
  - `openClawManagedChannelMutationSupport.ts`: `239`
  - `InstanceDetailSectionContent.tsx`: `222`
  - `InstanceDetailManagedMemorySection.tsx`: `93`
  - `InstanceDetailManagedToolsSection.tsx`: `258`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- `CP07-3` remains open. This loop materially improves the remaining page-side agent CRUD orchestration boundary, but it does not claim Step 07 closure.

## Change Scope

- `packages/sdkwork-clawstudio-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.ts`
- `packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.test.ts`
- `packages/sdkwork-clawstudio-instances/src/services/index.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-agent-mutation-runner-extraction-2026-04-09.md`
- `docs/鏋舵瀯/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-09-98.md`
- `docs/release/releases.json`

## Verification Focus

- RED:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-clawstudio-instances/src/services/openClawAgentMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/clawstudio-web lint`
  - `pnpm build`
- YELLOW:
  - `pnpm lint`

## Risks And Rollback

- The main Step 07 risk remains future page-side re-growth if agent CRUD mutation execution drifts back into `InstanceDetail.tsx`.
- This loop intentionally does not alter agent skill install/remove/toggle execution, transport selection, Provider Center managed authority, Local Proxy routing, or desktop plugin/runtime boundaries.
- Rollback is limited to the new agent helper and test, the page rewiring, the contract/barrel updates, and the matching review / architecture / release writebacks.

