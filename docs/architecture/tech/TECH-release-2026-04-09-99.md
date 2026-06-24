> Migrated from `docs/release/release-2026-04-09-99.md` on 2026-06-24.
> Owner: SDKWork maintainers

# Claw Studio release-2026-04-09-99

## Highlights

- Moved the remaining agent skill install / enable / remove orchestration out of `InstanceDetail.tsx` and into the dedicated `openClawAgentSkillMutationSupport` helper.
- Added focused helper coverage plus contract evidence so the page must keep using the shared skill runner boundary while retaining all real `agentSkillManagementService.*` calls and page-owned truth-source authority.

## Attempt Outcome

- Fresh RED in this loop was explicit:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
  - failed first because `openClawAgentSkillMutationSupport.ts` did not exist yet
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - failed first because the shared agent skill mutation helper did not exist yet
- Implemented the Step 07 extraction:
  - added `packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.ts`
  - rewired `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx` so the page now builds one injected agent skill runner from the shared helper and removes the inline pending/toast/reload orchestration from the three skill handlers
  - added `packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
  - updated `packages/sdkwork-claw-instances/src/services/index.ts`
  - updated `scripts/sdkwork-instances-contract.test.ts` to enforce the new agent skill mutation boundary and keep real `agentSkillManagementService.*` calls in the page
- Current hotspot profile after the fresh current-worktree re-baseline:
  - `InstanceDetail.tsx`: `1931`
  - `openClawAgentSkillMutationSupport.ts`: `68`
  - `openClawAgentMutationSupport.ts`: `65`
  - `openClawManagedConfigMutationSupport.ts`: `39`
  - `openClawProviderCatalogMutationSupport.ts`: `373`
  - `openClawManagedChannelMutationSupport.ts`: `239`
  - `InstanceDetailSectionContent.tsx`: `222`
  - `InstanceDetailManagedMemorySection.tsx`: `93`
  - `InstanceDetailManagedToolsSection.tsx`: `258`
  - `instanceWorkbenchServiceCore.ts`: `1134`
  - `instanceServiceCore.ts`: `1431`
- `CP07-3` remains open. This loop materially improves the remaining page-side agent skill orchestration boundary, but it does not claim Step 07 closure.

## Change Scope

- `packages/sdkwork-claw-instances/src/pages/InstanceDetail.tsx`
- `packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.ts`
- `packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
- `packages/sdkwork-claw-instances/src/services/index.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-agent-skill-mutation-runner-extraction-2026-04-09.md`
- `docs/鏋舵瀯/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-09-99.md`
- `docs/release/releases.json`

## Verification Focus

- RED:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- GREEN:
  - `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawAgentSkillMutationSupport.test.ts`
  - `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
  - `pnpm check:sdkwork-instances`
  - `pnpm --filter @sdkwork/claw-web lint`
  - `pnpm build`
- YELLOW:
  - `pnpm lint`

## Risks And Rollback

- The main Step 07 risk remains future page-side re-growth if agent skill pending/toast/reload sequencing drifts back into `InstanceDetail.tsx`.
- This loop intentionally does not alter agent CRUD execution, transport selection, Provider Center managed authority, Local Proxy routing, or desktop plugin/runtime boundaries.
- Rollback is limited to the new skill helper and test, the page rewiring, the contract/barrel updates, and the matching review / architecture / release writebacks.

