> Migrated from `docs/release/release-2026-04-08-70.md` on 2026-06-24.
> Owner: SDKWork maintainers

## Highlights

- Continued the real `Step 07` service hotspot decomposition by moving OpenClaw task normalization and runtime memory summarization into dedicated helper modules.
- Realigned the `sdkwork-instances` contract suite to the current `InstanceDetail.tsx -> InstanceDetailAgentsSection.tsx -> AgentWorkbenchPanel.tsx` boundary and added helper routing guards for both new service slices.
- Reduced the recorded `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts` hotspot from the prior `3693`-line baseline to a fresh `2924` lines while keeping OpenClaw authority unchanged.

## Attempt Outcome

- Added dedicated helper ownership in:
  - `packages/sdkwork-claw-instances/src/services/openClawTaskNormalization.ts`
  - `packages/sdkwork-claw-instances/src/services/openClawRuntimeMemorySupport.ts`
- Added focused helper coverage in:
  - `packages/sdkwork-claw-instances/src/services/openClawTaskNormalization.test.ts`
  - `packages/sdkwork-claw-instances/src/services/openClawRuntimeMemorySupport.test.ts`
- Rewired the workbench core so task normalization and runtime memory entry construction no longer live inline in:
  - `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`
- Extended the contract suite so the current agents-section composition and the two new helper boundaries stay enforced in:
  - `scripts/sdkwork-instances-contract.test.ts`
- Updated the ongoing Step 07 evidence set:
  - `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
  - `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`

## Change Scope

- `packages/sdkwork-claw-instances/src/services/openClawTaskNormalization.ts`
- `packages/sdkwork-claw-instances/src/services/openClawTaskNormalization.test.ts`
- `packages/sdkwork-claw-instances/src/services/openClawRuntimeMemorySupport.ts`
- `packages/sdkwork-claw-instances/src/services/openClawRuntimeMemorySupport.test.ts`
- `packages/sdkwork-claw-instances/src/services/instanceWorkbenchServiceCore.ts`
- `packages/sdkwork-claw-instances/src/services/index.ts`
- `scripts/sdkwork-instances-contract.test.ts`
- `docs/review/step-07-instance-detail分区一致性-2026-04-08.md`
- `docs/架构/134-2026-04-08-instance-detail-section-decomposition-progress.md`
- `docs/release/release-2026-04-08-70.md`
- `docs/release/releases.json`

## Verification Focus

- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawTaskNormalization.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawRuntimeMemorySupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawManagedConfigDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawProviderDrafts.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawProviderConfigPatch.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawConfigPathFallback.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawFilePathSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchFormatting.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceWorkbenchService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/instanceService.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-instances/src/services/openClawConfigSchemaSupport.test.ts`
- `node --experimental-strip-types packages/sdkwork-claw-infrastructure/src/platform/webStudio.test.ts`
- `node --experimental-strip-types scripts/sdkwork-instances-contract.test.ts`
- `pnpm.cmd check:sdkwork-instances`

## Risks And Rollback

- `Step 07` is still not closable. `CP07-3` remains open because `InstanceDetail.tsx` is still a `2553`-line page hotspot and `instanceWorkbenchServiceCore.ts` still remains above closure size at `2924` lines.
- The extraction intentionally moved pure helper logic only. Gateway selection, studio bridge routing, backend truth-source selection, and page-owned side effects remain where they were.
- Rollback must revert the two helper modules, the service-core import rewiring, the contract assertions, and the matching review/architecture/release evidence together; reverting only one side would recreate boundary drift.

